import os
import json
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import firebase_admin
from firebase_admin import credentials

# Initialize Firebase Admin AT STARTUP
if not firebase_admin._apps:
    # 1. Try reading from Railway Environment Variable
    firebase_json_env = os.getenv("FIREBASE_SERVICE_ACCOUNT")
    
    if firebase_json_env:
        cred_dict = json.loads(firebase_json_env)
        cred = credentials.Certificate(cred_dict)
        firebase_admin.initialize_app(cred)
        print("Firebase Admin initialized via Environment Variable.")
    else:
        # 2. Fallback to local serviceAccountKey.json for offline testing
        base_dir = os.path.dirname(os.path.abspath(__file__))
        key_path = os.path.join(os.path.dirname(base_dir), "serviceAccountKey.json")
        
        if os.path.exists(key_path):
            cred = credentials.Certificate(key_path)
            firebase_admin.initialize_app(cred)
            print("Firebase Admin initialized via local JSON file.")
        else:
            print("ERROR: Could not find Firebase credentials.")

from app.routers import payments, services, api_keys

app = FastAPI(title="Fongoh Hub API Engine")

# Allowed origins for frontend requests
origins = [
    "https://fongoh-hub.netlify.app",
    "http://localhost:5500",
    "http://127.0.0.1:5500",
    "*"
]

# Configure CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include Routers
app.include_router(payments.router, prefix="/api/payments", tags=["Payments"])
app.include_router(services.router, prefix="/api/services", tags=["Services"])
app.include_router(api_keys.router, prefix="/api/keys", tags=["API Keys"])

@app.get("/")
def root():
    return {"status": "online", "message": "Fongoh Hub API Engine Running"}
