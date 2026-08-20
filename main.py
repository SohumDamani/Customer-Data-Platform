from fastapi import FastAPI
from models import Customer,db
from sqlalchemy.orm import Session
from schemas import CustomerOut

api = FastAPI()

@api.get("/health")
def get():
    return {"status": "ok"}

@api.get("/customers",response_model=list[CustomerOut])
def get_customers():
    session = Session(db)

    result = session.query(Customer).all()

    return result
