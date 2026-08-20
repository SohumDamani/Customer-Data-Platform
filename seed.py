from sqlalchemy.orm import sessionmaker
from faker import Faker
from models import db, Customer

Session = sessionmaker(bind=db)
session = Session()

fake = Faker("en_US")

for _ in range(500):
    customer = Customer(
        firstname=fake.first_name(),
        lastname=fake.last_name(),
        company=fake.company(),
        email=fake.email(),
        phone=fake.numerify("(###) ###-####"),
        region=fake.state(),
    )
    session.add(customer)

session.commit()
print("Seeded 500 customers.")