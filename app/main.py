import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import firebase_admin
from firebase_admin import credentials

# Initialize Firebase Admin AT STARTUP
if not firebase_admin._apps:
    base_dir = os.path.dirname(os.path.abspath(__file__))
    key_path = os.path.join(os.path.dirname(base_dir), "serviceAccountKey.json")
    
    if os.path.exists(key_path):
        cred = credentials.Certificate(key_path)
        firebase_admin.initialize_app(cred)
        print("Firebase Admin initialized successfully.")
    else:
        print(f"ERROR: Could not find serviceAccountKey.json at {key_path}")

from app.routers import payments, services, api_keys

app = FastAPI(title="Fongoh Hub API Engine")

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include Routers with explicit prefixing and tags
app.include_router(payments.router, prefix="/api/payments", tags=["Payments"])
app.include_router(services.router, prefix="/api/services", tags=["Services"])
app.include_router(api_keys.router, prefix="/api/keys", tags=["API Keys"])

@app.get("/")
def root():
    return {"status": "online", "message": "Fongoh Hub API Engine Running"}

