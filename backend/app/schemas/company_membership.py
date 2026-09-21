from datetime import datetime
from typing import Optional
from uuid import UUID

from app.models.company_membership import CompanyRole
from app.schemas.base import BaseSchema


class CompanyMembershipCreate(BaseSchema):
    user_id: UUID
    company_id: UUID
    role: CompanyRole = CompanyRole.OWNER


class CompanyMembershipUpdate(BaseSchema):
    role: Optional[CompanyRole] = None
    is_active: Optional[bool] = None


class CompanyMembershipResponse(BaseSchema):
    id: UUID
    user_id: UUID
    company_id: UUID
    role: CompanyRole
    is_active: bool
    created_at: datetime
    updated_at: datetime