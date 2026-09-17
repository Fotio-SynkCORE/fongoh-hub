from pydantic import BaseModel

class TopupRequest(BaseModel):
    user_id: int
    amount: float

class RentNumberRequest(BaseModel):
    user_id: int
    country: str
    service: str