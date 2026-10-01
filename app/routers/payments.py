import os
import httpx
from typing import Optional
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from dotenv import load_dotenv
import firebase_admin
from firebase_admin import credentials, firestore

load_dotenv()

# Initialize Firebase Admin if not already initialized
if not firebase_admin._apps:
    firebase_admin.initialize_app()

db = firestore.client()

router = APIRouter(tags=["Payments"])

FAPSHI_API_USER = os.getenv("FAPSHI_API_USER")
FAPSHI_API_KEY = os.getenv("FAPSHI_API_KEY")
FAPSHI_BASE_URL = os.getenv("FAPSHI_BASE_URL", "https://sandbox.fapshi.com")


def get_fapshi_headers():
    return {
        "apiuser": os.getenv("FAPSHI_API_USER", ""),
        "apikey": os.getenv("FAPSHI_API_KEY", ""),
        "Content-Type": "application/json"
    }


class FapshiCheckoutRequest(BaseModel):
    userId: str
    email: Optional[str] = "user@fongoh.com"
    amount: float


@router.post("/fapshi/checkout")
async def fapshi_checkout(payload: FapshiCheckoutRequest):
    fapshi_payload = {
        "amount": int(payload.amount),
        "email": payload.email or "user@fongoh.com",
        "userId": payload.userId,
        "externalId": f"topup_{payload.userId}_{int(payload.amount)}"
    }

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            response = await client.post(
                f"{FAPSHI_BASE_URL}/initiate-pay",
                json=fapshi_payload,
                headers=get_fapshi_headers()
            )
            res_data = response.json()

            if response.status_code == 200 and "link" in res_data:
                trans_id = res_data.get("transId") or res_data.get("id") or res_data.get("token")
                
                # Safely attach transId to the user's latest pending transaction without complex indexing
                try:
                    transactions_ref = db.collection("users").document(payload.userId).collection("transactions")
                    pending_docs = transactions_ref.limit(5).get()
                    for doc in pending_docs:
                        doc_data = doc.to_dict()
                        if doc_data.get("status") == "pending" and not doc_data.get("transId"):
                            doc.reference.update({"transId": trans_id})
                            break
                except Exception as db_err:
                    print("Could not attach transId to Firestore pending doc:", db_err)

                return {"link": res_data["link"], "transId": trans_id}
            
            print("Fapshi Error Response:", res_data)
            raise HTTPException(
                status_code=400, 
                detail=res_data.get("message", "Failed to generate checkout link from Fapshi.")
            )

    except httpx.ConnectError:
        raise HTTPException(
            status_code=503, 
            detail="Network connection error. Cannot reach Fapshi servers."
        )
    except Exception as e:
        print("Checkout exception:", str(e))
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/verify-payment/{trans_id}")
async def verify_payment(trans_id: str):
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            response = await client.get(
                f"{FAPSHI_BASE_URL}/payment-status/{trans_id}", 
                headers=get_fapshi_headers()
            )
            res_data = response.json()

            if response.status_code == 200:
                payment_status = res_data.get("status") # e.g., "SUCCESSFUL" or "COMPLETED"
                
                if payment_status in ["SUCCESSFUL", "SUCCESS", "COMPLETED"]:
                    users_ref = db.collection("users").stream()
                    target_user_id = None
                    target_tx_doc = None
                    tx_amount = 0

                    # Safe iteration to find the matching transaction across users
                    for user_doc in users_ref:
                        tx_ref = db.collection("users").document(user_doc.id).collection("transactions")
                        tx_docs = tx_ref.limit(10).get()
                        
                        for tx_doc in tx_docs:
                            tx_data = tx_doc.to_dict()
                            # Match either by saved transId or if it's the recent pending transaction
                            if tx_data.get("transId") == trans_id or (tx_data.get("status") == "pending" and not tx_data.get("transId")):
                                if tx_data.get("status") not in ["SUCCESSFUL", "completed", "SUCCESS"]:
                                    target_user_id = user_doc.id
                                    target_tx_doc = tx_doc.reference
                                    tx_amount = float(tx_data.get("amount", 0))
                                    break
                        if target_user_id:
                            break

                    if target_user_id and target_tx_doc:
                        # Update transaction status to completed
                        target_tx_doc.update({"status": "completed", "transId": trans_id})
                        
                        # Increment user wallet balance safely in Firestore
                        user_doc_ref = db.collection("users").document(target_user_id)
                        user_snapshot = user_doc_ref.get()
                        if user_snapshot.exists:
                            current_balance = float(user_snapshot.to_dict().get("balance", 0))
                            new_balance = current_balance + tx_amount
                            user_doc_ref.update({"balance": new_balance})

                return {"trans_id": trans_id, "status": payment_status}

            raise HTTPException(status_code=400, detail="Unable to verify status with Fapshi")
            
    except httpx.ConnectError:
        raise HTTPException(status_code=503, detail="Backend lost internet connection while contacting Fapshi.")
    except Exception as e:
        print("Verification exception:", str(e))
        raise HTTPException(status_code=500, detail=str(e))
