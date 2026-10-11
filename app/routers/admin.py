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


# --------------------------------------------------------------------------
# Starter accounts: copies the accounts that used to be typed in marketplace.js
# into the database, so their stock can go down when someone buys.
# Safe to run more than once: accounts that already exist are not touched.
# TODO: set the real prices and stock (the newer accounts use placeholders).
# --------------------------------------------------------------------------
STARTER_ACCOUNTS = [
    {"id": "test-500", "title": "Test Account (500 XAF)", "price": 500, "stock": 5, "image_url": "https://img.icons8.com/color/144/gender-neutral-user.png"},
    {"id": "def-1", "title": "Old Google Voice", "price": 3500, "stock": 5, "image_url": "https://upload.wikimedia.org/wikipedia/commons/d/d7/Google_Voice_icon_%282020%29.svg"},
    {"id": "def-2", "title": "TextPlus", "price": 1500, "stock": 10, "image_url": "https://img.icons8.com/color/144/message-squared.png"},
    {"id": "def-3", "title": "ExpressVPN", "price": 2500, "stock": 8, "image_url": "https://img.icons8.com/color/144/expressvpn.png"},
    {"id": "def-4", "title": "Old Telegram", "price": 2000, "stock": 4, "image_url": "https://upload.wikimedia.org/wikipedia/commons/8/82/Telegram_logo.svg"},
    {"id": "def-5", "title": "Netflix", "price": 2000, "stock": 6, "image_url": "https://upload.wikimedia.org/wikipedia/commons/0/08/Netflix_2015_N_logo.svg"},
    {"id": "def-6", "title": "NordVPN", "price": 2500, "stock": 3, "image_url": "https://img.icons8.com/color/144/nordvpn.png"},
    {"id": "def-7", "title": "Claude Premium Account", "price": 12000, "stock": 5, "image_url": "https://upload.wikimedia.org/wikipedia/commons/b/b0/Claude_AI_symbol.svg"},
    {"id": "def-8", "title": "Facebook Ads Account", "price": 8000, "stock": 5, "image_url": "https://upload.wikimedia.org/wikipedia/commons/b/b8/2021_Facebook_icon.svg"},
    {"id": "def-9", "title": "Monetized TikTok UK", "price": 25000, "stock": 2, "image_url": "https://upload.wikimedia.org/wikipedia/en/a/a9/TikTok_logo.svg"},
    {"id": "def-10", "title": "ChatGPT Premium Account", "price": 12000, "stock": 5, "image_url": "https://upload.wikimedia.org/wikipedia/commons/0/04/ChatGPT_logo.svg"},
    {"id": "def-11", "title": "Old Facebook Account", "price": 3000, "stock": 10, "image_url": "https://img.icons8.com/color/144/facebook-new.png"},
    {"id": "def-12", "title": "Old IG Accounts", "price": 3000, "stock": 10, "image_url": "https://img.icons8.com/color/144/instagram-new.png"},
]


@router.post("/seed-accounts")
async def seed_accounts(authorization: str | None = Header(default=None)):
    require_admin(authorization)

    def work():
        col = accounts_col()
        created = 0
        for acc in STARTER_ACCOUNTS:
            ref = col.document(acc["id"])
            if not ref.get().exists:
                data = {k: v for k, v in acc.items() if k != "id"}
                data["createdAt"] = firestore.SERVER_TIMESTAMP
                ref.set(data)
                created += 1
        return created

    return {"created": await run_in_threadpool(work)}
