from pydantic import BaseModel,Field
from typing import Optional

class CustomerOut(BaseModel):

    # allowing pydantic to read from objects as by deault it can understand a dict format only
    model_config = {"from_attributes": True}

    id: int = Field(..., description="ID of the customer")
    firstname: str = Field(..., description="First name of the customer")
    lastname: str = Field(..., description="Last name of the customer")
    company: str = Field(..., description="Company the customer works for")
    email: Optional[str] = Field(None, description="Email address of the customer")
    phone: Optional[str] = Field(None, description="Phone number of the customer")
    region: str = Field(..., description="US state/region of the customer")

