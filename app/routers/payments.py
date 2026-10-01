import os
import httpx
from typing import Optional
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from dotenv import load_dotenv

load_dotenv()

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
                return {"trans_id": trans_id, "status": payment_status}

            raise HTTPException(status_code=400, detail="Unable to verify status with Fapshi")
            
    except httpx.ConnectError:
        raise HTTPException(status_code=503, detail="Backend lost internet connection while contacting Fapshi.")
    except Exception as e:
        print("Verification exception:", str(e))
        raise HTTPException(status_code=500, detail=str(e))
