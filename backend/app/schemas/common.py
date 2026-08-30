from typing import Any

from pydantic import BaseModel


class Envelope[T](BaseModel):
    success: bool
    data: T | None = None
    error: dict[str, Any] | None = None


def ok(data: Any) -> dict[str, Any]:
    return {"success": True, "data": data}


def paginated(items: list[Any], total_count: int, page: int, page_size: int) -> dict[str, Any]:
    return {
        "success": True,
        "data": {
            "items": items,
            "total_count": total_count,
            "page": page,
            "page_size": page_size,
        },
    }
