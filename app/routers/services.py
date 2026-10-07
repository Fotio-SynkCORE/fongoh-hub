from fastapi import APIRouter, Header, HTTPException
from fastapi.concurrency import run_in_threadpool
from firebase_admin import auth as fb_auth, firestore
from pydantic import BaseModel, Field

# NOTE: no prefix here. main.py already mounts this router at /api/services,
# so the buy route is POST /api/services/buy-number
router = APIRouter(tags=["Services"])


class BuyNumberRequest(BaseModel):
    service: str
    country: str
    pool_id: str
    price: int = Field(gt=0)  # price in XAF


def get_uid(authorization: str | None) -> str:
    """Reads the logged-in user from the Firebase token sent by the website."""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Please sign in again.")
    try:
        decoded = fb_auth.verify_id_token(authorization.split(" ", 1)[1])
        return decoded["uid"]
    except Exception as e:
        print("Token error:", repr(e))
        raise HTTPException(status_code=401, detail="Session expired. Please sign in again.")


def buy_sync(uid: str, req: BuyNumberRequest) -> str:
    db = firestore.client()
    user_ref = db.collection("users").document(uid)

    @firestore.transactional
    def run(txn):
        snap = user_ref.get(transaction=txn)
        if not snap.exists:
            raise HTTPException(status_code=404, detail="User not found")

        balance = float((snap.to_dict() or {}).get("balance") or 0)
        if balance < req.price:
            raise HTTPException(
                status_code=400,
                detail="Insufficient wallet balance. Please top up.",
            )

        order_ref = user_ref.collection("orders").document()
        tx_ref = user_ref.collection("transactions").document()

        txn.update(user_ref, {"balance": firestore.Increment(-req.price)})
        txn.set(order_ref, {
            "serviceName": req.service,
            "country": req.country,
            "poolId": req.pool_id,
            "price": req.price,
            "currency": "XAF",
            "phone": "",
            "status": "processing",  # becomes "active" once the number is delivered
            "createdAt": firestore.SERVER_TIMESTAMP,
        })
        txn.set(tx_ref, {
            "type": "purchase",
            "serviceName": req.service,
            "amount": -req.price,
            "status": "completed",
            "createdAt": firestore.SERVER_TIMESTAMP,
        })
        return order_ref.id

    return run(db.transaction())


@router.post("/buy-number")
async def buy_number(req: BuyNumberRequest, authorization: str | None = Header(default=None)):
    uid = get_uid(authorization)
    try:
        order_id = await run_in_threadpool(buy_sync, uid, req)
    except HTTPException:
        raise
    except Exception as e:
        print("Buy number error:", repr(e))
        raise HTTPException(status_code=500, detail="Could not complete the order.")

    return {
        "status": "SUCCESS",
        "message": "Order placed",
        "order_id": order_id,
    }
