import os
import json
import uuid
import httpx
from typing import Optional

import firebase_admin
from firebase_admin import credentials, firestore
from fastapi import APIRouter, HTTPException, Request
from fastapi.concurrency import run_in_threadpool
from pydantic import BaseModel
from dotenv import load_dotenv

load_dotenv()

router = APIRouter(tags=["Payments"])

# IMPORTANT: on Railway set FAPSHI_BASE_URL=https://live.fapshi.com for real money.
# If it is missing, this falls back to the sandbox (fake money).
FAPSHI_BASE_URL = os.getenv("FAPSHI_BASE_URL", "https://sandbox.fapshi.com")

# Firestore layout (change here if yours is different):
#   users/{uid}                    -> field "balance"
#   users/{uid}/transactions/{id}  -> fields amount, status, createdAt ...
USERS_COLLECTION = "users"
TX_SUBCOLLECTION = "transactions"
BALANCE_FIELD = "balance"
PAYMENTS_COLLECTION = "fapshi_payments"  # idempotency records, one per transId


# ---------------------------------------------------------------- Firebase
def get_db():
    if not firebase_admin._apps:
        raw = os.getenv("FIREBASE_SERVICE_ACCOUNT_JSON")
        if not raw:
            raise RuntimeError("FIREBASE_SERVICE_ACCOUNT_JSON is not set on Railway")
        firebase_admin.initialize_app(credentials.Certificate(json.loads(raw)))
    return firestore.client()


# ------------------------------------------------------------------ Fapshi
def get_fapshi_headers():
    return {
        "apiuser": os.getenv("FAPSHI_API_USER", ""),
        "apikey": os.getenv("FAPSHI_API_KEY", ""),
        "Content-Type": "application/json",
    }


async def fetch_fapshi_status(trans_id: str) -> dict:
    async with httpx.AsyncClient(timeout=15.0) as client:
        response = await client.get(
            f"{FAPSHI_BASE_URL}/payment-status/{trans_id}",
            headers=get_fapshi_headers(),
        )
        data = response.json()
        if response.status_code != 200:
            print("Fapshi status error:", response.status_code, data)
            raise HTTPException(status_code=400, detail="Unable to verify status with Fapshi")
        return data


# --------------------------------------------------------- Wallet crediting
def _credit_wallet_sync(trans_id: str, uid: str, amount: int) -> bool:
    """Credits the wallet exactly once per trans_id. Returns True if credited now."""
    db = get_db()
    pay_ref = db.collection(PAYMENTS_COLLECTION).document(trans_id)
    user_ref = db.collection(USERS_COLLECTION).document(uid)

    @firestore.transactional
    def run(txn):
        snap = pay_ref.get(transaction=txn)
        if snap.exists and snap.to_dict().get("credited"):
            return False
        txn.set(user_ref, {BALANCE_FIELD: firestore.Increment(amount)}, merge=True)
        txn.set(pay_ref, {
            "uid": uid,
            "amount": amount,
            "credited": True,
            "creditedAt": firestore.SERVER_TIMESTAMP,
        })
        return True

    credited_now = run(db.transaction())

    # Update the pending transaction row the frontend created (or add one)
    tx_col = user_ref.collection(TX_SUBCOLLECTION)
    pending = list(
        tx_col.where("status", "==", "pending")
        .where("amount", "==", amount)
        .limit(1)
        .stream()
    )
    if pending:
        pending[0].reference.update({
            "status": "completed",
            "transId": trans_id,
            "completedAt": firestore.SERVER_TIMESTAMP,
        })
    elif credited_now:
        tx_col.add({
            "amount": amount,
            "currency": "XAF",
            "method": "MOMO (Fapshi)",
            "status": "completed",
            "transId": trans_id,
            "createdAt": firestore.SERVER_TIMESTAMP,
        })
    return credited_now


def _mark_failed_sync(trans_id: str, uid: str, amount: int, status: str):
    db = get_db()
    tx_col = db.collection(USERS_COLLECTION).document(uid).collection(TX_SUBCOLLECTION)
    pending = list(
        tx_col.where("status", "==", "pending")
        .where("amount", "==", amount)
        .limit(1)
        .stream()
    )
    if pending:
        pending[0].reference.update({"status": status.lower(), "transId": trans_id})


async def process_payment(trans_id: str) -> dict:
    """Asks Fapshi for the real status, then credits or marks failed."""
    data = await fetch_fapshi_status(trans_id)
    status = (data.get("status") or "").upper()
    uid = data.get("userId")
    amount = int(data.get("amount") or 0)
    credited = False

    if status == "SUCCESSFUL":
        if not uid or amount <= 0:
            raise HTTPException(status_code=422, detail="Payment has no userId/amount")
        credited = await run_in_threadpool(_credit_wallet_sync, trans_id, uid, amount)
    elif status in ("FAILED", "EXPIRED") and uid and amount > 0:
        await run_in_threadpool(_mark_failed_sync, trans_id, uid, amount, status)

    return {"trans_id": trans_id, "status": status, "credited": credited, "amount": amount}


# ------------------------------------------------------------------ Routes
class FapshiCheckoutRequest(BaseModel):
    userId: str
    email: Optional[str] = "user@fongoh.com"
    amount: float
    redirectUrl: Optional[str] = None


@router.post("/fapshi/checkout")
async def fapshi_checkout(payload: FapshiCheckoutRequest):
    fapshi_payload = {
        "amount": int(payload.amount),
        "email": payload.email or "user@fongoh.com",
        "userId": payload.userId,
        # unique every time, so two top-ups of the same amount never collide
        "externalId": f"topup_{uuid.uuid4().hex}",
    }
    if payload.redirectUrl:
        # Fapshi sends the user back here with ?transId=... added
        fapshi_payload["redirectUrl"] = payload.redirectUrl

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            response = await client.post(
                f"{FAPSHI_BASE_URL}/initiate-pay",
                json=fapshi_payload,
                headers=get_fapshi_headers(),
            )
            res_data = response.json()

            if response.status_code == 200 and "link" in res_data:
                return {"link": res_data["link"], "transId": res_data.get("transId")}

            print("Fapshi Error Response:", res_data)
            raise HTTPException(
                status_code=400,
                detail=res_data.get("message", "Failed to generate checkout link from Fapshi."),
            )

    except HTTPException:
        raise
    except httpx.ConnectError:
        raise HTTPException(status_code=503, detail="Network connection error. Cannot reach Fapshi servers.")
    except Exception as e:
        print("Checkout exception:", str(e))
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/verify-payment/{trans_id}")
async def verify_payment(trans_id: str):
    """Called by the website when the user returns. Safe to call many times."""
    try:
        return await process_payment(trans_id)
    except HTTPException:
        raise
    except httpx.ConnectError:
        raise HTTPException(status_code=503, detail="Backend lost internet connection while contacting Fapshi.")
    except Exception as e:
        print("Verification exception:", repr(e))
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/webhook")
async def fapshi_webhook(request: Request):
    """Fapshi calls this when a payment changes status, even if the user closed the page.
    We never trust the body: we only take transId and re-check with Fapshi."""
    try:
        body = await request.json()
    except Exception:
        return {"received": False}

    trans_id = body.get("transId")
    if not trans_id:
        return {"received": False}

    try:
        result = await process_payment(trans_id)
        print("Webhook processed:", result)
    except Exception as e:
        print("Webhook error:", repr(e))
        # 500 makes Fapshi retry later
        raise HTTPException(status_code=500, detail="processing failed")

    return {"received": True}
