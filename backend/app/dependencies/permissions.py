from uuid import UUID

from fastapi import Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database.db import get_db
from app.dependencies.auth import get_current_user
from app.models import (
    User,
    PlatformRole,
    CompanyMembership,
    CompanyRole,
)


# ============================================================
# PLATFORM-LEVEL AUTHORIZATION
# ============================================================

class PlatformRoleChecker:
    def __init__(
        self,
        allowed_roles: list[PlatformRole],
    ):
        self.allowed_roles = allowed_roles

    def __call__(
        self,
        current_user: User = Depends(get_current_user),
    ) -> User:

        if current_user.platform_role not in self.allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Operation not permitted for your platform role",
            )

        return current_user


# ============================================================
# COMPANY-LEVEL AUTHORIZATION
# ============================================================

class CompanyRoleChecker:
    def __init__(
        self,
        allowed_roles: list[CompanyRole],
    ):
        self.allowed_roles = allowed_roles

    def __call__(
        self,
        company_id: UUID,
        current_user: User = Depends(get_current_user),
        db: Session = Depends(get_db),
    ) -> User:

        # Find membership for THIS logged-in user
        # inside THIS specific company
        membership = db.scalar(
            select(CompanyMembership).where(
                CompanyMembership.user_id == current_user.id,
                CompanyMembership.company_id == company_id,
                CompanyMembership.is_active.is_(True),
            )
        )

        # User does not belong to this company
        if membership is None:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You are not a member of this company",
            )

        # User belongs to company,
        # but does not have the required role
        if membership.role not in self.allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Operation not permitted for your company role",
            )

        # Return the actual authenticated user
        return current_user


# ============================================================
# PLATFORM PERMISSIONS
# ============================================================

require_super_admin = PlatformRoleChecker(
    [
        PlatformRole.SUPER_ADMIN,
    ]
)
require_normal_user = PlatformRoleChecker(
    [
        PlatformRole.USER,
    ]
)
require_authenticated_user = PlatformRoleChecker(
    [
        PlatformRole.SUPER_ADMIN,
        PlatformRole.USER,
    ]
)


# ============================================================
# COMPANY PERMISSIONS
# ============================================================

# Only company OWNER
require_company_owner = CompanyRoleChecker(
    [
        CompanyRole.OWNER,
    ]
)


# OWNER + PROJECT_MANAGER
require_project_manager = CompanyRoleChecker(
    [
        CompanyRole.OWNER,
        CompanyRole.PROJECT_MANAGER,
    ]
)


# OWNER + PROJECT_MANAGER + SITE_ENGINEER
require_site_management = CompanyRoleChecker(
    [
        CompanyRole.OWNER,
        CompanyRole.PROJECT_MANAGER,
        CompanyRole.SITE_ENGINEER,
    ]
)


# OWNER + FINANCE
require_finance = CompanyRoleChecker(
    [
        CompanyRole.OWNER,
        CompanyRole.FINANCE,
    ]
)


# OWNER + SALES
require_sales = CompanyRoleChecker(
    [
        CompanyRole.OWNER,
        CompanyRole.SALES,
    ]
)


# Any active member of the company
require_company_member = CompanyRoleChecker(
    [
        CompanyRole.OWNER,
        CompanyRole.PROJECT_MANAGER,
        CompanyRole.SITE_ENGINEER,
        CompanyRole.SALES,
        CompanyRole.FINANCE,
    ]
)