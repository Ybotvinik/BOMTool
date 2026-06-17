"""SQLAlchemy ORM models.

Importing this package registers every model on ``Base.metadata`` so that
Alembic autogenerate and ``create_all`` can see the full schema.
"""

from app.models.user import User
from app.models.customer import Customer
from app.models.project import Project
from app.models.bom_version import BomVersion
from app.models.bom_line import BomLine
from app.models.supplier_quote import SupplierQuote, SupplierQuoteLine
from app.models.pricing import PricingSnapshot, PricingLine
from app.models.export_report import ExportReport
from app.models.procurement_file import ProcurementFile, ProcurementFileLine
from app.models.project_file import ProjectFile
from app.models.official_pricing import (
    OfficialPriceLine,
    OfficialPriceSnapshot,
    OfficialSupplierPriceResult,
    OfficialSupplierQuery,
)
from app.models.activity_log import ActivityLog

__all__ = [
    "User",
    "Customer",
    "Project",
    "BomVersion",
    "BomLine",
    "SupplierQuote",
    "SupplierQuoteLine",
    "PricingSnapshot",
    "PricingLine",
    "ExportReport",
    "ProcurementFile",
    "ProcurementFileLine",
    "ProjectFile",
    "ActivityLog",
    "OfficialSupplierQuery",
    "OfficialSupplierPriceResult",
    "OfficialPriceSnapshot",
    "OfficialPriceLine",
]
