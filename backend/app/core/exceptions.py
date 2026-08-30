from fastapi import Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from app.core.logging import get_logger

logger = get_logger(__name__)


class AppError(Exception):
    status_code: int = status.HTTP_400_BAD_REQUEST

    def __init__(self, code: str, message: str) -> None:
        self.code = code
        self.message = message
        super().__init__(message)


class NotFoundError(AppError):
    status_code = status.HTTP_404_NOT_FOUND


class ForbiddenError(AppError):
    status_code = status.HTTP_403_FORBIDDEN


class UnauthorizedError(AppError):
    status_code = status.HTTP_401_UNAUTHORIZED


class ValidationError(AppError):
    status_code = status.HTTP_422_UNPROCESSABLE_CONTENT


class ConflictError(AppError):
    status_code = status.HTTP_409_CONFLICT


def _error_response(status_code: int, code: str, message: str) -> JSONResponse:
    return JSONResponse(
        status_code=status_code,
        content={"success": False, "error": {"code": code, "message": message}},
    )


async def app_error_handler(request: Request, exc: AppError) -> JSONResponse:
    return _error_response(exc.status_code, exc.code, exc.message)


async def validation_exception_handler(
    request: Request, exc: RequestValidationError
) -> JSONResponse:
    return _error_response(
        status.HTTP_422_UNPROCESSABLE_CONTENT,
        "VALIDATION_ERROR",
        "Request validation failed.",
    )


async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    logger.exception("Unhandled exception on %s %s", request.method, request.url.path)
    return _error_response(
        status.HTTP_500_INTERNAL_SERVER_ERROR,
        "INTERNAL_ERROR",
        "An unexpected error occurred.",
    )
