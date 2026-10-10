import os
import time
import asyncio
import logging

import httpx
from fastapi import APIRouter, Header, HTTPException
from fastapi.concurrency import run_in_threadpool
from firebase_admin import firestore
from pydantic import BaseModel, Field

from app.routers.services import get_uid, charge_sync

# never print the supplier URL (it contains the API key)
logging.getLogger("httpx").setLevel(logging.WARNING)

# Mounted at /api/numbers in main.py
router = APIRouter(tags=["Numbers"])

GRIZZLY_URL = "https://api.grizzlysms.com/stubs/handler_api.php"
ACTIVATIONS = "grizzly_activations"   # numbers still waiting for a code
EXPIRY_SECONDS = 19 * 60              # cancel + refund if no code after this

# Keep these two settings the same as pricing.js on the website
USD_TO_XAF = float(os.getenv("USD_TO_XAF", "600"))
MARKUP = float(os.getenv("MARKUP", "1.0"))

# -------------------------------------------------------------------------
# VERIFY THESE against the "Tables" page of the Grizzly docs before going live.
# They follow the sms-activate numbering that Grizzly says it is compatible
# with. Anything not listed here is refused instead of guessed.
# -------------------------------------------------------------------------
SERVICE_CODES = {
    "whatsapp-1": "wa",
    "whatsapp-2": "wa",
    "telegram": "tg",
    "facebook": "fb",
    "google": "go",
    "amazon": "am",
    "instagram+threads": "ig",
    "tiktok": "lf",
    "paypal": "ts",
    "apple": "wx",
    "anyother": "ot",
}

COUNTRY_CODES = {          # site country id -> Grizzly country code
    "us-virtual": "12",
    "us": "187",
    "gb": "16",
    "ca": "36",
    "fr": "78",
    "de": "43",
    "es": "56",
    "it": "86",
    "pl": "15",
    "br": "73",
    "mx": "54",
    "id": "6",
    "in": "22",
    "co": "33",
    "ph": "4",
    "za": "31",
}


class BuyNumberRequest(BaseModel):
    service_slug: str
    service: str
    country: str
    pool_id: str
    price: int = Field(gt=0)  # XAF


# ------------------------------------------------------------- supplier call
async def grizzly(action: str, **params) -> str:
    key = os.getenv("GRIZZLY_API_KEY")
    if not key:
        print("GRIZZLY_API_KEY is not set")
        raise HTTPException(status_code=503, detail="Numbers are not available right now.")

    query = {"api_key": key, "action": action}
    query.update({k: v for k, v in params.items() if v is not None})
    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            r = await client.get(GRIZZLY_URL, params=query)
        return r.text.strip()
    except httpx.HTTPError as e:
        print("Grizzly network error:", type(e).__name__)
        raise HTTPException(status_code=503, detail="Numbers are not available right now. Please try again.")


# --------------------------------------------------------------- firestore
def _order_ref(uid, order_id):
    return firestore.client().collection("users").document(uid).collection("orders").document(order_id)


def get_order_sync(uid, order_id):
    snap = _order_ref(uid, order_id).get()
    return snap.to_dict() if snap.exists else None


def save_activation_sync(uid, order_id, activation_id, phone):
    db = firestore.client()
    started = time.time()
    batch = db.batch()
    batch.update(_order_ref(uid, order_id), {
        "phone": phone,
        "activationId": activation_id,
        "startedAt": started,
        "status": "waiting_code",
    })
    batch.set(db.collection(ACTIVATIONS).document(activation_id), {
        "uid": uid,
        "orderId": order_id,
        "startedAt": started,
        "status": "waiting",
    })
    batch.commit()


def complete_sync(uid, order_id, activation_id, code):
    db = firestore.client()
    ref = _order_ref(uid, order_id)
    snap = ref.get()
    if snap.exists and snap.to_dict().get("status") == "waiting_code":
        ref.update({"status": "completed", "code": code})
    db.collection(ACTIVATIONS).document(activation_id).set({"status": "done"}, merge=True)


def refund_sync(uid, order_id, reason):
    """Gives the money back once. Safe to call twice."""
    db = firestore.client()
    user_ref = db.collection("users").document(uid)
    order_ref = _order_ref(uid, order_id)

    @firestore.transactional
    def run(txn):
        snap = order_ref.get(transaction=txn)
        if not snap.exists:
            return False
        order = snap.to_dict()
        if order.get("status") not in ("requesting", "waiting_code"):
            return False
        price = int(order.get("price") or 0)

        txn.update(user_ref, {"balance": firestore.Increment(price)})
        txn.update(order_ref, {"status": "refunded", "refundReason": reason})
        txn.set(user_ref.collection("transactions").document(), {
            "type": "refund",
            "serviceName": order.get("serviceName", "Number"),
            "amount": price,
            "status": "completed",
            "createdAt": firestore.SERVER_TIMESTAMP,
        })
        if order.get("activationId"):
            txn.set(db.collection(ACTIVATIONS).document(order["activationId"]),
                    {"status": "closed"}, merge=True)
        return True

    return run(db.transaction())


# -------------------------------------------------------- checking for code
async def process_activation(uid, order_id, activation_id, started_at):
    text = await grizzly("getStatus", id=activation_id)

    if text.startswith("STATUS_OK:"):
        code = text.split(":", 1)[1].strip()
        await run_in_threadpool(complete_sync, uid, order_id, activation_id, code)
        try:
            await grizzly("setStatus", id=activation_id, status=6)  # mark as finished
        except Exception:
            pass
        return {"status": "completed", "code": code}

    if text.startswith("STATUS_CANCEL"):
        await run_in_threadpool(refund_sync, uid, order_id, "cancelled_by_supplier")
        return {"status": "refunded"}

    if time.time() - started_at > EXPIRY_SECONDS:
        res = await grizzly("setStatus", id=activation_id, status=8)  # cancel
        if res.startswith("ACCESS_CANCEL"):
            await run_in_threadpool(refund_sync, uid, order_id, "no_code_received")
            return {"status": "refunded"}

    return {"status": "waiting_code"}


async def sweeper_loop():
    """Runs forever on the server: refunds numbers whose code never came,
    even if the customer closed the page."""
    await asyncio.sleep(10)
    while True:
        try:
            def load():
                col = firestore.client().collection(ACTIVATIONS)
                return [(d.id, d.to_dict()) for d in col.where("status", "==", "waiting").stream()]

            for act_id, d in await run_in_threadpool(load):
                await process_activation(d["uid"], d["orderId"], act_id, d.get("startedAt", 0))
        except Exception as e:
            print("Sweeper error:", repr(e))
        await asyncio.sleep(60)


# ------------------------------------------------------------------ routes
@router.post("/buy")
async def buy_number(req: BuyNumberRequest, authorization: str | None = Header(default=None)):
    uid = get_uid(authorization)

    service_code = SERVICE_CODES.get(req.service_slug)
    country_id = req.pool_id.rsplit("-pool-", 1)[0]
    country_code = COUNTRY_CODES.get(country_id)
    if not service_code or country_code is None:
        raise HTTPException(status_code=400, detail="This service or country is not available yet.")

    # we never pay the supplier more than the customer pays us
    max_usd = max(0.01, round(req.price / (USD_TO_XAF * MARKUP), 2))

    # 1) take the money (fails here if the balance is too low)
    order_id = await run_in_threadpool(
        charge_sync, uid, req.price,
        {
            "type": "number",
            "serviceName": req.service,
            "country": req.country,
            "poolId": req.pool_id,
            "phone": "",
            "provider": "grizzly",
        },
        req.service,
        "requesting",
    )

    # 2) ask the supplier for the number, refund if anything goes wrong
    try:
        text = await grizzly(
            "getNumber", service=service_code, country=country_code, maxPrice=max_usd
        )
    except HTTPException:
        await run_in_threadpool(refund_sync, uid, order_id, "supplier_unreachable")
        raise

    if text.startswith("ACCESS_NUMBER:"):
        _, activation_id, phone = text.split(":", 2)
        await run_in_threadpool(save_activation_sync, uid, order_id, activation_id, phone)
        return {"order_id": order_id, "phone": phone, "status": "waiting_code"}

    await run_in_threadpool(refund_sync, uid, order_id, "supplier_error")
    print("Grizzly getNumber failed:", text[:80])
    if text.startswith("NO_NUMBERS"):
        raise HTTPException(
            status_code=400,
            detail="No numbers available right now for this country. You were not charged. Try another country.",
        )
    if text.startswith("NO_BALANCE") or text.startswith("BAD_KEY"):
        print("!!! CHECK THE GRIZZLY ACCOUNT: balance or API key problem")
    reason = "".join(ch for ch in text.split(":")[0] if ch.isalnum() or ch == "_")[:30] or "UNKNOWN"
    raise HTTPException(
        status_code=503,
        detail=f"Numbers are temporarily unavailable ({reason}). You were not charged.",
    )


@router.get("/status/{order_id}")
async def number_status(order_id: str, authorization: str | None = Header(default=None)):
    uid = get_uid(authorization)
    order = await run_in_threadpool(get_order_sync, uid, order_id)
    if not order or order.get("type") != "number":
        raise HTTPException(status_code=404, detail="Order not found")

    status = order.get("status")
    if status != "waiting_code":
        return {"status": status, "phone": order.get("phone"), "code": order.get("code")}

    result = await process_activation(
        uid, order_id, order["activationId"], order.get("startedAt") or time.time()
    )
    return {"phone": order.get("phone"), **result}


@router.post("/cancel/{order_id}")
async def cancel_number(order_id: str, authorization: str | None = Header(default=None)):
    uid = get_uid(authorization)
    order = await run_in_threadpool(get_order_sync, uid, order_id)
    if not order or order.get("type") != "number":
        raise HTTPException(status_code=404, detail="Order not found")
    if order.get("status") != "waiting_code":
        return {"status": order.get("status")}

    res = await grizzly("setStatus", id=order["activationId"], status=8)
    if res.startswith("ACCESS_CANCEL"):
        await run_in_threadpool(refund_sync, uid, order_id, "cancelled_by_user")
        return {"status": "refunded"}

    raise HTTPException(
        status_code=400,
        detail="You can't cancel this number yet. Please wait a little and try again.",
    )
