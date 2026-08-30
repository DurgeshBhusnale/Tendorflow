from fastapi import FastAPI
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.core.exceptions import (
    AppError,
    app_error_handler,
    unhandled_exception_handler,
    validation_exception_handler,
)
from app.core.logging import configure_logging
from app.routers import (
    auth,
    clients,
    credentials,
    dashboard,
    dsc,
    health,
    portals,
    tender_names,
    tenders,
    users,
)


def create_app() -> FastAPI:
    configure_logging()
    settings = get_settings()

    app = FastAPI(title="Tender App API")

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.add_exception_handler(AppError, app_error_handler)
    app.add_exception_handler(RequestValidationError, validation_exception_handler)
    app.add_exception_handler(Exception, unhandled_exception_handler)

    app.include_router(health.router)
    app.include_router(auth.router)
    app.include_router(users.router)
    app.include_router(clients.router)
    app.include_router(portals.router)
    app.include_router(tender_names.router)
    app.include_router(credentials.router)
    app.include_router(tenders.router)
    app.include_router(dsc.router)
    app.include_router(dashboard.router)

    return app


app = create_app()
