"""
Super Admin Pydantic schemas
"""

from typing import Optional, List, Any, Dict
from datetime import datetime
from pydantic import BaseModel, UUID4


# ============================================================================
# System Configuration Schemas
# ============================================================================

class SystemConfigurationBase(BaseModel):
    key: str
    value: Any  # Can be any JSON-serializable value
    description: Optional[str] = None
    data_type: str  # 'string', 'number', 'boolean', 'date', 'json'
    category: str = 'general'
    is_public: bool = False


class SystemConfigurationCreate(SystemConfigurationBase):
    pass


class SystemConfigurationUpdate(BaseModel):
    value: Optional[Any] = None
    description: Optional[str] = None
    category: Optional[str] = None
    is_public: Optional[bool] = None


class SystemConfiguration(SystemConfigurationBase):
    id: UUID4
    updated_at: datetime
    updated_by: Optional[UUID4] = None

    class Config:
        from_attributes = True


# ============================================================================
# Audit Log Schemas
# ============================================================================

class AuditLogBase(BaseModel):
    entity_type: str
    entity_id: Optional[UUID4] = None
    action: str
    details: Optional[Dict[str, Any]] = None


class AuditLogCreate(AuditLogBase):
    actor_id: Optional[UUID4] = None
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None


class AuditLog(AuditLogBase):
    id: UUID4
    actor_id: Optional[UUID4] = None
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class AuditLogWithActor(AuditLog):
    """Audit log with actor information"""
    actor_name: Optional[str] = None
    actor_email: Optional[str] = None

    class Config:
        from_attributes = True


# ============================================================================
# Email Template Schemas
# ============================================================================

class EmailTemplateBase(BaseModel):
    key: str
    name: str
    subject: str
    html_content: str
    text_content: Optional[str] = None
    variables: Optional[List[str]] = None
    is_active: bool = True


class EmailTemplateCreate(EmailTemplateBase):
    pass


class EmailTemplateUpdate(BaseModel):
    name: Optional[str] = None
    subject: Optional[str] = None
    html_content: Optional[str] = None
    text_content: Optional[str] = None
    variables: Optional[List[str]] = None
    is_active: Optional[bool] = None


class EmailTemplate(EmailTemplateBase):
    id: UUID4
    created_at: datetime
    updated_at: datetime
    updated_by: Optional[UUID4] = None

    class Config:
        from_attributes = True


# ============================================================================
# Team Schemas
# ============================================================================

class TeamBase(BaseModel):
    key: str
    name: str
    description: Optional[str] = None
    color: str = '#3B82F6'
    is_active: bool = True
    order_index: int = 0


class TeamCreate(TeamBase):
    pass


class TeamUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    color: Optional[str] = None
    is_active: Optional[bool] = None
    order_index: Optional[int] = None


class Team(TeamBase):
    id: UUID4
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class TeamWithAdminCount(Team):
    """Team with count of assigned admins"""
    admin_count: int = 0

    class Config:
        from_attributes = True


# ============================================================================
# User Management Schemas (extensions to existing user schemas)
# ============================================================================

class UserUpdate(BaseModel):
    """Update user information (super admin use)"""
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    role: Optional[str] = None  # 'user', 'admin', 'super_admin'
    team: Optional[str] = None  # For admins
    status: Optional[str] = None  # 'active', 'inactive', 'suspended'


class UserStatusUpdate(BaseModel):
    """Update user status with reason"""
    status: str  # 'active', 'inactive', 'suspended'
    reason: Optional[str] = None


class UserRoleUpdate(BaseModel):
    """Update user role"""
    role: str  # 'user', 'admin', 'super_admin'
    team: Optional[str] = None  # Required if role = 'admin'


class PasswordResetRequest(BaseModel):
    """Request password reset for a user"""
    user_id: UUID4
    send_email: bool = True


# ============================================================================
# Dashboard Statistics Schemas
# ============================================================================

class DashboardStats(BaseModel):
    """Super admin dashboard statistics"""
    total_users: int
    total_families: int
    total_admins: int
    total_super_admins: int
    new_users_this_week: int

    total_applications: int
    applications_this_season: int
    applications_in_progress: int
    applications_under_review: int
    applications_accepted: int
    applications_paid: int
    applications_declined: int

    total_revenue: float
    season_revenue: float
    outstanding_payments: int

    avg_completion_days: Optional[float] = None
    avg_review_days: Optional[float] = None


class TeamPerformance(BaseModel):
    """Team performance metrics"""
    team_key: str
    team_name: str
    admin_count: int
    applications_reviewed: int
    avg_review_time_days: Optional[float] = None
    approval_rate: Optional[float] = None  # Percentage


# ============================================================================
# Bulk Action Schemas
# ============================================================================

class BulkUserAction(BaseModel):
    """Bulk action on multiple users"""
    user_ids: List[UUID4]
    action: str  # 'activate', 'suspend', 'delete', 'change_role'
    action_data: Optional[Dict[str, Any]] = None  # Extra data for the action (e.g., new role, reason)


class BulkApplicationAction(BaseModel):
    """Bulk action on multiple applications"""
    application_ids: List[UUID4]
    action: str  # 'accept', 'decline', 'reset', 'delete'
    reason: Optional[str] = None


class BulkActionResult(BaseModel):
    """Result of bulk action"""
    success_count: int
    failure_count: int
    total_count: int
    failures: List[Dict[str, Any]] = []  # List of failed items with reasons


# ============================================================================
# Annual Reset Schemas
# ============================================================================

class AnnualResetRequest(BaseModel):
    """Request for annual reset operation"""
    dry_run: bool = True  # If true, only report what would happen without making changes
    exclude_paid: bool = False  # If true, skip paid applications (default: reset paid apps since they're returning campers)
    archive_year: Optional[int] = None  # Year to archive data as (defaults to current year)


class AnnualResetApplicationResult(BaseModel):
    """Result for a single application in the annual reset"""
    application_id: UUID4
    camper_name: str
    previous_status: str
    responses_deleted: int
    responses_preserved: int
    notes_deleted: int


class AnnualResetResult(BaseModel):
    """Result of annual reset operation"""
    dry_run: bool
    archive_year: int
    total_applications_processed: int
    total_responses_deleted: int
    total_responses_preserved: int
    total_notes_deleted: int
    applications_reset: List[AnnualResetApplicationResult]
    skipped_statuses: Dict[str, int]  # Count of applications skipped by status
