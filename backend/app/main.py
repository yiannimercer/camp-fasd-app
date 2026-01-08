"""
CAMP FASD Application Portal - Main FastAPI Application
"""

from fastapi import FastAPI, HTTPException, status, Depends
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from app.core.config import settings
from app.core.database import get_db

app = FastAPI(
    title="CAMP FASD Application Portal API",
    description="API for managing camper applications",
    version="1.0.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
async def root():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "service": "CAMP FASD Application Portal API",
        "version": "1.0.0"
    }

@app.get("/api/health")
async def health_check():
    """Detailed health check"""
    return {
        "status": "healthy",
        "database": "connected",
        "storage": "connected"
    }


# ============================================================================
# PUBLIC CONFIGURATION ENDPOINTS (No Authentication Required)
# ============================================================================
from app.models.super_admin import SystemConfiguration, Team

@app.get("/api/public/config/{key}", tags=["Public"])
async def get_public_configuration(
    key: str,
    db: Session = Depends(get_db)
):
    """
    Get public configuration by key (no authentication required).
    Only returns configurations where is_public = true.
    Used for things like status colors that need to be loaded before user logs in.
    """
    config = db.query(SystemConfiguration).filter(
        SystemConfiguration.key == key,
        SystemConfiguration.is_public == True
    ).first()

    if not config:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Configuration not found or not public"
        )

    return {"key": config.key, "value": config.value}


@app.get("/api/public/teams", tags=["Public"])
async def get_public_teams(
    db: Session = Depends(get_db)
):
    """
    Get all active teams (no authentication required).
    Returns only active teams with their colors for use in UI throughout the app.
    Used by TeamColorsContext to provide team colors app-wide.
    """
    teams = db.query(Team).filter(Team.is_active == True).order_by(Team.order_index).all()

    return [
        {
            "key": team.key,
            "name": team.name,
            "color": team.color
        }
        for team in teams
    ]


# Import and include routers
from app.api import auth, auth_google, applications, files, admin, super_admin, application_builder, medications, emails, cron, invoices, stripe_webhooks

app.include_router(auth.router, prefix="/api/auth", tags=["Authentication"])
app.include_router(auth_google.router, prefix="/api/auth", tags=["Authentication"])
app.include_router(applications.router, prefix="/api/applications", tags=["Applications"])
app.include_router(medications.router, prefix="/api", tags=["Medications & Allergies"])
app.include_router(files.router, tags=["Files"])
app.include_router(admin.router, prefix="/api", tags=["Admin"])
app.include_router(application_builder.router, prefix="/api", tags=["Application Builder"])
app.include_router(super_admin.router, prefix="/api/super-admin", tags=["Super Admin"])
app.include_router(emails.router, prefix="/api/emails", tags=["Emails"])
app.include_router(cron.router, prefix="/api/cron", tags=["Cron Jobs"])
app.include_router(invoices.router, prefix="/api", tags=["Invoices"])
app.include_router(stripe_webhooks.router, prefix="/api", tags=["Webhooks"])

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=True
    )
