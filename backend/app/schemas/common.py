from pydantic import BaseModel, ConfigDict


class ORMModel(BaseModel):
    """Base schema that reads attributes from ORM objects."""

    model_config = ConfigDict(from_attributes=True)
