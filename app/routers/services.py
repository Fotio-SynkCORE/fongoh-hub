from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database import get_db
from app import models, schemas

router = APIRouter(prefix="/api/services", tags=["Services"])

@router.post("/rent-number")
def rent_number(request: schemas.RentNumberRequest, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.id == request.user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    cost = 350.0
    if user.wallet_balance < cost:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, 
            detail="Insufficient wallet balance. Please top up using Fapshi."
        )

    user.wallet_balance -= cost

    order = models.Order(
        user_id=user.id,
        service_type="VIRTUAL_NUMBER",
        cost=cost,
        status="COMPLETED",
        details={"phone_number": "+237670000000", "code": "123456"}
    )
    db.add(order)
    db.commit()
    db.refresh(user)

    return {
        "status": "SUCCESS",
        "message": "Number generated successfully",
        "details": order.details,
        "remaining_balance": user.wallet_balance
    }