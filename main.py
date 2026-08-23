from fastapi import FastAPI
from models import Customer,db
from sqlalchemy.orm import Session
from sqlalchemy import or_
from schemas import CustomerOut
from typing import Optional
from fastapi.middleware.cors import CORSMiddleware


api = FastAPI()
api.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],  # your React dev server's origin
    allow_methods=["*"],
    allow_headers=["*"],
)

@api.get("/health")
def get():
    return {"status": "ok"}

@api.get("/customers",response_model=list[CustomerOut])
def get_customers(page: int, page_size: int, search: Optional[str]=None):
    session = Session(db)
    try:
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
    finally:
        session.close()


    


