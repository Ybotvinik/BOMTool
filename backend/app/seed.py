"""Idempotent seed data for local development.

Run with:  python -m app.seed
"""

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.models import BomVersion, Customer, Project, User
from app.services.activity import log_activity

SEED_USERS = [
    {"name": "Yaniv Botvinik", "initials": "YB", "email": "yaniv@glintech.example"},
    {"name": "Diana", "initials": "DI", "email": "diana@glintech.example"},
    {"name": "Yossi Cohen", "initials": "YC", "email": "yossi@glintech.example"},
    {"name": "Other User", "initials": "OU", "email": "other@glintech.example"},
]


def _get_or_create_user(db: Session, data: dict) -> User:
    user = db.scalar(select(User).where(User.name == data["name"]))
    if user is None:
        user = User(**data)
        db.add(user)
        db.flush()
    return user


def seed() -> None:
    db = SessionLocal()
    try:
        users = [_get_or_create_user(db, u) for u in SEED_USERS]
        admin = users[0]

        customer = db.scalar(select(Customer).where(Customer.name == "Elbit Systems"))
        if customer is None:
            customer = Customer(
                name="Elbit Systems",
                contact_name="Procurement Desk",
                contact_email="procurement@elbit.example",
            )
            db.add(customer)
            db.flush()

        project = db.scalar(select(Project).where(Project.code == "ELB-RCB-003"))
        if project is None:
            project = Project(
                customer_id=customer.id,
                name="Radar Control Board v3",
                code="ELB-RCB-003",
                build_quantity=1000,
                status="NEW",
            )
            db.add(project)
            db.flush()

            version = BomVersion(
                project_id=project.id,
                version_label="v3.0",
                status="In Review",
                source="seed",
                is_active=True,
                created_by_id=admin.id,
            )
            db.add(version)
            db.flush()
            project.active_version_id = version.id

            log_activity(
                db,
                user_id=admin.id,
                action_type="project.create",
                project_id=project.id,
                entity_type="project",
                entity_name=project.name,
                change_summary="Seeded sample project Radar Control Board v3",
                commit=False,
            )

        db.commit()
        print("Seed complete: users, customer (Elbit Systems), project (ELB-RCB-003).")
    finally:
        db.close()


if __name__ == "__main__":
    seed()
