from fastapi import APIRouter, Header, HTTPException, Depends
import firebase_admin
from firebase_admin import auth, firestore
import hashlib
import secrets

router = APIRouter(tags=["API Keys"])

def verify_token(authorization: str = Header(None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Unauthorized")
    token = authorization.split("Bearer ")[1]
    try:
        decoded = auth.verify_id_token(token)
        return decoded["uid"]
    except Exception as e:
        raise HTTPException(status_code=401, detail=str(e))

# IMPORTANT: Use standard 'def' (NOT 'async def') so FastAPI handles blocking Firestore SDK calls in threads
@router.post("/generate")
def generate_key(uid: str = Depends(verify_token)):
    try:
        db = firestore.client()
        
        raw_key = f"gnk_live_{secrets.token_hex(16)}"
        key_hash = hashlib.sha256(raw_key.encode()).hexdigest()
        masked = f"gnk_live_{raw_key[9:16]}••••••••••••••••"

        # Revoke existing active keys
        existing = db.collection("api_keys").where("userId", "==", uid).where("status", "==", "active").stream()
        batch = db.batch()
        for doc in existing:
            batch.update(doc.reference, {"status": "revoked"})
        batch.commit()

        # Save new key
        db.collection("api_keys").add({
            "userId": uid,
            "keyHash": key_hash,
            "maskedKey": masked,
            "status": "active",
            "requestsCount": 0,
            "lastUsed": "Never",
            "createdAt": firestore.SERVER_TIMESTAMP
        })

        return {"success": True, "rawSecretKey": raw_key}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
@router.post("/revoke")
def revoke_key(payload: dict, uid: str = Depends(verify_token)):
    try:
        db = firestore.client()
        key_id = payload.get("keyId")

        # If keyId is passed, revoke that specific key doc
        if key_id:
            doc_ref = db.collection("api_keys").document(key_id)
            doc = doc_ref.get()
            if not doc.exists or doc.to_dict().get("userId") != uid:
                raise HTTPException(status_code=404, detail="Key not found")
            doc_ref.update({"status": "revoked"})
            return {"success": True, "message": "Key revoked successfully"}

        # Otherwise, revoke all active keys for this user
        existing = db.collection("api_keys").where("userId", "==", uid).where("status", "==", "active").stream()
        batch = db.batch()
        for doc in existing:
            batch.update(doc.reference, {"status": "revoked"})
        batch.commit()

        return {"success": True, "message": "All active keys revoked"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

