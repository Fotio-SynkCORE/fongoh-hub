from fastapi import APIRouter, Header, HTTPException
from fastapi.concurrency import run_in_threadpool
from firebase_admin import auth as fb_auth, firestore
from pydantic import BaseModel, Field

# NOTE: no prefix here. main.py already mounts this router at /api/services
#   POST /api/services/boost
#   POST /api/services/buy-account
# Numbers now live in numbers.py (/api/numbers/...)
router = APIRouter(tags=["Services"])


# ---------------------------------------------------------------- requests
class BoostRequest(BaseModel):
    package_name: str
    target_link: str = Field(max_length=500)
    quantity: int = Field(gt=0)
    price: int = Field(gt=0)  # XAF


class BuyAccountRequest(BaseModel):
    account_id: str
    title: str
    price: int = Field(gt=0)  # XAF


# ----------------------------------------------------------------- helpers
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


def charge_sync(uid: str, price: int, order: dict, label: str, status: str = "processing") -> str:
    """Takes `price` XAF from the wallet, saves the order and a transaction row.
    All-or-nothing: if the balance is too low, nothing is changed."""
    db = firestore.client()
    user_ref = db.collection("users").document(uid)

    @firestore.transactional
    def run(txn):
        snap = user_ref.get(transaction=txn)
        if not snap.exists:
            raise HTTPException(status_code=404, detail="User not found")

        balance = float((snap.to_dict() or {}).get("balance") or 0)
        if balance < price:
            raise HTTPException(
                status_code=400,
                detail="Insufficient wallet balance. Please top up.",
            )

        order_ref = user_ref.collection("orders").document()
        tx_ref = user_ref.collection("transactions").document()

        txn.update(user_ref, {"balance": firestore.Increment(-price)})
        txn.set(order_ref, {
            **order,
            "price": price,
            "currency": "XAF",
            "status": status,
            "createdAt": firestore.SERVER_TIMESTAMP,
        })
        txn.set(tx_ref, {
            "type": "purchase",
            "serviceName": label,
            "amount": -price,
            "status": "completed",
            "createdAt": firestore.SERVER_TIMESTAMP,
        })
        return order_ref.id

    return run(db.transaction())


async def charge(uid: str, price: int, order: dict, label: str) -> dict:
    try:
        order_id = await run_in_threadpool(charge_sync, uid, price, order, label)
    except HTTPException:
        raise
    except Exception as e:
        print("Charge error:", repr(e))
        raise HTTPException(status_code=500, detail="Could not complete the order.")
    return {"status": "SUCCESS", "message": "Order placed", "order_id": order_id}


# ------------------------------------------------------------------ routes
@router.post("/boost")
async def boost(req: BoostRequest, authorization: str | None = Header(default=None)):
    uid = get_uid(authorization)
    return await charge(uid, req.price, {
        "type": "boost",
        "serviceName": req.package_name,
        "targetLink": req.target_link,
        "quantity": req.quantity,
    }, req.package_name)


@router.post("/buy-account")
async def buy_account(req: BuyAccountRequest, authorization: str | None = Header(default=None)):
    uid = get_uid(authorization)
    return await charge(uid, req.price, {
        "type": "account",
        "serviceName": req.title,
        "accountId": req.account_id,
    }, req.title)


# ------------------------------------------------------------------- eSIM
class BuyEsimRequest(BaseModel):
    plan_id: str
    country: str
    data_mb: int = Field(gt=0)
    days: int = Field(gt=0)
    price: int = Field(gt=0)  # XAF


@router.post("/buy-esim")
async def buy_esim(req: BuyEsimRequest, authorization: str | None = Header(default=None)):
    uid = get_uid(authorization)
    label = f"eSIM {req.country}"
    return await charge(uid, req.price, {
        "type": "esim",
        "serviceName": label,
        "country": req.country,
        "planId": req.plan_id,
        "dataMb": req.data_mb,
        "days": req.days,
    }, label)
