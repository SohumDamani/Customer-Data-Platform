from fastapi import FastAPI
from models import Customer,db
from sqlalchemy.orm import Session
from sqlalchemy import or_
from schemas import CustomerOut
from typing import Optional

api = FastAPI()

@api.get("/health")
def get():
    return {"status": "ok"}

@api.get("/customers",response_model=list[CustomerOut])
def get_customers(page: int, page_size: int, search: Optional[str]=None):
    session = Session(db)
    # so page 1 
    result = session.query(Customer)
    if search:
        result = result.filter(
            or_(
            Customer.firstname.like(f"%{search}%"),
            Customer.lastname.like(f"%{search}%"),
            Customer.company.like(f"%{search}%")
            ))
    record_start = (page-1)*page_size
    result = result.limit(page_size).offset(record_start).all()
    return result


