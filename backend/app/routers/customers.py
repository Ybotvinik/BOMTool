from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user_id
from app.models import Customer
from app.schemas.customer import CustomerCreate, CustomerRead, CustomerUpdate
from app.services.activity import log_activity

router = APIRouter(prefix="/customers", tags=["customers"])


@router.get("", response_model=list[CustomerRead])
def list_customers(db: Session = Depends(get_db)) -> list[Customer]:
    return list(db.scalars(select(Customer).order_by(Customer.name)))


@router.post("", response_model=CustomerRead, status_code=status.HTTP_201_CREATED)
def create_customer(
    payload: CustomerCreate,
    db: Session = Depends(get_db),
    user_id: int | None = Depends(get_current_user_id),
) -> Customer:
    customer = Customer(**payload.model_dump())
    db.add(customer)
    db.commit()
    db.refresh(customer)
    log_activity(
        db,
        user_id=user_id,
        action_type="customer.create",
        entity_type="customer",
        entity_name=customer.name,
        change_summary=f"Created customer '{customer.name}'",
    )
    return customer


@router.get("/{customer_id}", response_model=CustomerRead)
def get_customer(customer_id: int, db: Session = Depends(get_db)) -> Customer:
    customer = db.get(Customer, customer_id)
    if customer is None:
        raise HTTPException(status_code=404, detail="Customer not found")
    return customer


@router.patch("/{customer_id}", response_model=CustomerRead)
def update_customer(
    customer_id: int,
    payload: CustomerUpdate,
    db: Session = Depends(get_db),
    user_id: int | None = Depends(get_current_user_id),
) -> Customer:
    customer = db.get(Customer, customer_id)
    if customer is None:
        raise HTTPException(status_code=404, detail="Customer not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(customer, field, value)
    db.commit()
    db.refresh(customer)
    log_activity(
        db,
        user_id=user_id,
        action_type="customer.update",
        entity_type="customer",
        entity_name=customer.name,
        change_summary=f"Updated customer '{customer.name}'",
    )
    return customer


@router.delete("/{customer_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_customer(
    customer_id: int,
    db: Session = Depends(get_db),
    user_id: int | None = Depends(get_current_user_id),
) -> None:
    customer = db.get(Customer, customer_id)
    if customer is None:
        raise HTTPException(status_code=404, detail="Customer not found")
    name = customer.name
    db.delete(customer)
    db.commit()
    log_activity(
        db,
        user_id=user_id,
        action_type="customer.delete",
        entity_type="customer",
        entity_name=name,
        change_summary=f"Deleted customer '{name}'",
    )
