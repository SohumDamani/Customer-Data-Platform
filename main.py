from fastapi import FastAPI
from models import Customer,db
from sqlalchemy.orm import Session
from schemas import CustomerOut

api = FastAPI()

@api.get("/health")
def get():
    return {"status": "ok"}

@api.get("/customers",response_model=list[CustomerOut])
def get_customers(page: int, page_size: int):
    session = Session(db)
    # so page 1 
    record_start = (page-1)*page_size
    result = session.query(Customer).limit(page_size).offset(record_start).all()
    return result
