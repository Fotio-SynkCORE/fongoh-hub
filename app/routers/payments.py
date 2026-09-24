import os
import httpx
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from app.database import get_db
from app import models
from dotenv import load_dotenv

load_dotenv()

# NO prefix here since app.py / main.py handles prefix="/api/payments"
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


# Updated request schema to support users without email (phone/anon auth)
class FapshiCheckoutRequest(BaseModel):
    userId: str
    email: Optional[str] = "user@fongoh.com"
    amount: float


@router.post("/fapshi/checkout")
async def fapshi_checkout(payload: FapshiCheckoutRequest):
    """
    Endpoint matched to frontend fetch request in add-funds.js
    """
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
                return {"link": res_data["link"], "transId": res_data.get("transId")}
            
            # Print for backend debugging
            print("Fapshi Error Response:", res_data)
            raise HTTPException(
                status_code=400, 
                detail=res_data.get("message", "Failed to generate checkout link from Fapshi.")
            )

    except httpx.ConnectError:
        raise HTTPException(
            status_code=503, 
            detail="Network connection error. Cannot reach Fapshi servers. Ensure active internet connection."
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/verify-payment/{trans_id}")
async def verify_payment(trans_id: str, db: Session = Depends(get_db)):
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            response = await client.get(
                f"{FAPSHI_BASE_URL}/payment-status/{trans_id}", 
                headers=get_fapshi_headers()
            )
            res_data = response.json()

            if response.status_code == 200:
                payment_status = res_data.get("status")

                trans = db.query(models.Transaction).filter(models.Transaction.trans_id == trans_id).first()
                if trans and trans.status != "SUCCESSFUL" and payment_status == "SUCCESSFUL":
                    trans.status = "SUCCESSFUL"
                    user = db.query(models.User).filter(models.User.id == trans.user_id).first()
                    if user:
                        user.wallet_balance += trans.amount
                    db.commit()

                return {"trans_id": trans_id, "status": payment_status}

            raise HTTPException(status_code=400, detail="Unable to verify status with Fapshi")
            
    except httpx.ConnectError:
        raise HTTPException(status_code=503, detail="Backend lost internet connection while contacting Fapshi.")
