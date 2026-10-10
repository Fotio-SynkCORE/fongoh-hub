import os
from fastapi import APIRouter, Header, HTTPException
from fastapi.concurrency import run_in_threadpool
from firebase_admin import auth as fb_auth, firestore
from pydantic import BaseModel, Field

# Mounted at /api/admin in main.py
router = APIRouter(tags=["Admin"])

# Admin emails. Add more in Railway with a variable ADMIN_EMAILS (comma separated).
ADMIN_EMAILS = {
    e.strip().lower()
    for e in os.getenv("ADMIN_EMAILS", "fongohborisndiy@gmail.com").split(",")
    if e.strip()
}

DEFAULT_IMAGE = "https://img.icons8.com/color/144/gender-neutral-user.png"


class AccountIn(BaseModel):
    title: str = Field(min_length=1, max_length=80)
    price: int = Field(gt=0)   # XAF
    stock: int = Field(ge=0)
    image_url: str = Field(default="", max_length=500)


def require_admin(authorization: str | None) -> str:
    """Only a signed-in user whose VERIFIED email is in ADMIN_EMAILS gets through."""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Please sign in.")
    try:
        decoded = fb_auth.verify_id_token(authorization.split(" ", 1)[1])
    except Exception as e:
        print("Admin token error:", repr(e))
        raise HTTPException(status_code=401, detail="Session expired. Please sign in again.")

    email = (decoded.get("email") or "").lower()
    if email not in ADMIN_EMAILS or not decoded.get("email_verified"):
        raise HTTPException(status_code=403, detail="Not allowed.")
    return decoded["uid"]


def accounts_col():
    return firestore.client().collection("accounts")


def _clean(a: AccountIn) -> dict:
    return {
        "title": a.title.strip(),
        "price": a.price,
        "stock": a.stock,
        "image_url": a.image_url.strip() or DEFAULT_IMAGE,
    }


@router.get("/accounts")
async def list_accounts(authorization: str | None = Header(default=None)):
    require_admin(authorization)

    def work():
        return [{"id": d.id, **d.to_dict()} for d in accounts_col().stream()]

    return {"accounts": await run_in_threadpool(work)}


@router.post("/accounts")
async def create_account(a: AccountIn, authorization: str | None = Header(default=None)):
    require_admin(authorization)

    def work():
        ref = accounts_col().document()
        ref.set({**_clean(a), "createdAt": firestore.SERVER_TIMESTAMP})
        return ref.id

    return {"id": await run_in_threadpool(work)}


@router.put("/accounts/{account_id}")
async def update_account(account_id: str, a: AccountIn, authorization: str | None = Header(default=None)):
    require_admin(authorization)

    def work():
        ref = accounts_col().document(account_id)
        if not ref.get().exists:
            raise HTTPException(status_code=404, detail="Account not found")
        ref.update(_clean(a))

    await run_in_threadpool(work)
    return {"ok": True}


@router.delete("/accounts/{account_id}")
async def delete_account(account_id: str, authorization: str | None = Header(default=None)):
    require_admin(authorization)
    await run_in_threadpool(lambda: accounts_col().document(account_id).delete())
    return {"ok": True}
