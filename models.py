from sqlalchemy.orm import DeclarativeBase
from sqlalchemy import create_engine,Column,String,Integer

db = create_engine("sqlite:///mydatbase.db",echo=True)


class Base(DeclarativeBase):
    pass

class Customer(Base):
    __tablename__ = 'customer'
    id = Column("id",Integer,primary_key=True)
    firstname = Column("firstname",String,nullable=False)
    lastname = Column("lastname",String,nullable=False)
    company = Column("company",String,nullable=False)
    email = Column("email",String)
    phone = Column("phone",String)
    region = Column("region",String,nullable=False)

Base.metadata.create_all(db)
    