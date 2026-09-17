import firebase_admin
from firebase_admin import credentials
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

# --- Firebase Admin Initialization ---
if not firebase_admin._apps:
    cred = credentials.Certificate("serviceAccountKey.json")
    firebase_admin.initialize_app(cred)

    # If you have a service account JSON file, pass it like this:
    # cred = credentials.Certificate("serviceAccountKey.json")
    # firebase_admin.initialize_app(cred)
    
    # Standard default initialization:
    firebase_admin.initialize_app()

# --- SQLAlchemy Setup ---
SQLALCHEMY_DATABASE_URL = "sqlite:///./fongohhub.db"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
import firebase_admin
from firebase_admin import credentials

