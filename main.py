from fastapi import FastAPI
from models import Customer,db
from sqlalchemy.orm import Session
from sqlalchemy import or_
from schemas import CustomerListOut
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

@api.get("/customers",response_model=CustomerListOut)
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
        total,result = paginate(result,page,page_size)
        return {"result": result, "total": total}
    finally:
        session.close()

def paginate(query, page: int, page_size: int):
    total = query.count()
    record_start = (page-1)*page_size
    result = query.limit(page_size).offset(record_start).all()
    return total, result
    


