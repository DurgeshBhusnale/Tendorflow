"""Business expenses (CH-27).

Admin-only in full, unlike every other record module: this is the cost side of
the ledger whose revenue totals employees already cannot see (CH-12), so an
employee gets 403 from reads as well as writes.

Runs against a database holding committed demo data, so rows are uniquely
described and assertions check membership rather than absolute counts.
"""

from datetime import timedelta

from app.core.dates import today_ist


async def _create_expense(client, headers, **overrides):
    payload = {"amount": "250.50", "details": "Printer toner", **overrides}
    return await client.post("/api/expenses", json=payload, headers=headers)


# --------------------------------------------------------------------------
# Creation
# --------------------------------------------------------------------------


async def test_create_expense_happy_path(client, admin_headers, uniq):
    resp = await _create_expense(client, admin_headers, details=f"Printer toner {uniq}")

    assert resp.status_code == 201
    data = resp.json()["data"]
    assert data["amount"] == "250.50"
    assert data["details"] == f"Printer toner {uniq}"
    assert data["status"] == "Pending"
    assert data["expense_date"] == today_ist().isoformat()
    assert data["created_by"]["full_name"] == "Test Admin"


async def test_expense_details_have_no_length_cap(client, admin_headers, uniq):
    """The note is the record of where the money went, so it is never truncated."""
    long_details = f"{uniq} " + ("why this was bought, at length. " * 200)

    resp = await _create_expense(client, admin_headers, details=long_details)

    assert resp.status_code == 201
    assert resp.json()["data"]["details"] == long_details


async def test_create_expense_can_be_backdated(client, admin_headers, uniq):
    spent_on = (today_ist() - timedelta(days=10)).isoformat()

    resp = await _create_expense(
        client, admin_headers, details=f"Toner {uniq}", expense_date=spent_on
    )

    assert resp.status_code == 201
    assert resp.json()["data"]["expense_date"] == spent_on


async def test_create_expense_as_paid(client, admin_headers, uniq):
    resp = await _create_expense(client, admin_headers, details=f"Toner {uniq}", status="Paid")

    assert resp.status_code == 201
    assert resp.json()["data"]["status"] == "Paid"


async def test_money_is_serialized_as_exact_string(client, admin_headers, uniq):
    resp = await _create_expense(client, admin_headers, details=f"Toner {uniq}", amount="1200")

    assert resp.json()["data"]["amount"] == "1200.00"


# --------------------------------------------------------------------------
# Validation and auth
# --------------------------------------------------------------------------


async def test_create_expense_requires_auth(client):
    resp = await client.post("/api/expenses", json={"amount": "10.00", "details": "x"})

    assert resp.status_code == 401
    assert resp.json()["error"]["code"] == "UNAUTHENTICATED"


async def test_create_expense_requires_admin(client, employee_headers):
    resp = await _create_expense(client, employee_headers)

    assert resp.status_code == 403
    assert resp.json()["error"]["code"] == "FORBIDDEN"


async def test_listing_expenses_requires_admin(client, employee_headers):
    """Reads are admin-only too — the figures are the point, not just the writes."""
    resp = await client.get("/api/expenses", headers=employee_headers)

    assert resp.status_code == 403
    assert resp.json()["error"]["code"] == "FORBIDDEN"


async def test_summary_requires_admin(client, employee_headers):
    resp = await client.get("/api/expenses/summary", headers=employee_headers)

    assert resp.status_code == 403
    assert resp.json()["error"]["code"] == "FORBIDDEN"


async def test_create_expense_rejects_empty_details(client, admin_headers):
    resp = await _create_expense(client, admin_headers, details="")

    assert resp.status_code == 422
    assert resp.json()["error"]["code"] == "VALIDATION_ERROR"


async def test_create_expense_rejects_negative_amount(client, admin_headers):
    resp = await _create_expense(client, admin_headers, amount="-1.00")

    assert resp.status_code == 422
    assert resp.json()["error"]["code"] == "VALIDATION_ERROR"


async def test_create_expense_rejects_unknown_status(client, admin_headers):
    resp = await _create_expense(client, admin_headers, status="Partially Paid")

    assert resp.status_code == 422
    assert resp.json()["error"]["code"] == "VALIDATION_ERROR"


async def test_summary_route_not_shadowed_by_id_route(client, admin_headers):
    """`/summary` must resolve as a literal path, not as an expense id."""
    resp = await client.get("/api/expenses/summary", headers=admin_headers)

    assert resp.status_code == 200
    assert "total_amount" in resp.json()["data"]


# --------------------------------------------------------------------------
# Filtering and the KPI strip
# --------------------------------------------------------------------------


async def test_filter_by_status(client, admin_headers, uniq):
    await _create_expense(client, admin_headers, details=f"Paid one {uniq}", status="Paid")
    await _create_expense(client, admin_headers, details=f"Pending one {uniq}")

    resp = await client.get(
        "/api/expenses", params={"search": uniq, "status": "Paid"}, headers=admin_headers
    )

    items = resp.json()["data"]["items"]
    assert [i["details"] for i in items] == [f"Paid one {uniq}"]


async def test_search_matches_the_details(client, admin_headers, uniq):
    await _create_expense(client, admin_headers, details=f"Diesel for the generator {uniq}")

    resp = await client.get(
        "/api/expenses", params={"search": f"generator {uniq}"}, headers=admin_headers
    )

    assert resp.json()["data"]["total_count"] == 1


async def test_date_filter_uses_the_expense_date(client, admin_headers, uniq):
    """A backdated expense is found on its own date, not the day it was typed in."""
    spent_on = (today_ist() - timedelta(days=10)).isoformat()
    today = today_ist().isoformat()
    await _create_expense(client, admin_headers, details=f"Toner {uniq}", expense_date=spent_on)

    on_its_date = await client.get(
        "/api/expenses",
        params={"search": uniq, "start_date": spent_on, "end_date": spent_on},
        headers=admin_headers,
    )
    on_entry_day = await client.get(
        "/api/expenses",
        params={"search": uniq, "start_date": today, "end_date": today},
        headers=admin_headers,
    )

    assert on_its_date.json()["data"]["total_count"] == 1
    assert on_entry_day.json()["data"]["total_count"] == 0


async def test_list_is_ordered_by_expense_date(client, admin_headers, uniq):
    today = today_ist().isoformat()
    backdated = (today_ist() - timedelta(days=3)).isoformat()
    await _create_expense(client, admin_headers, details=f"Today {uniq}", expense_date=today)
    await _create_expense(client, admin_headers, details=f"Older {uniq}", expense_date=backdated)

    resp = await client.get("/api/expenses", params={"search": uniq}, headers=admin_headers)

    assert [i["expense_date"] for i in resp.json()["data"]["items"]] == [today, backdated]


async def test_summary_splits_paid_and_pending(client, admin_headers, uniq):
    """The paid and pending figures must add up to the total (CH-27)."""
    await _create_expense(
        client, admin_headers, details=f"Paid {uniq}", amount="1000.00", status="Paid"
    )
    await _create_expense(client, admin_headers, details=f"Pending {uniq}", amount="250.50")

    resp = await client.get("/api/expenses/summary", params={"search": uniq}, headers=admin_headers)

    data = resp.json()["data"]
    assert data["paid_amount"] == "1000.00"
    assert data["pending_amount"] == "250.50"
    assert data["total_amount"] == "1250.50"
    assert data["paid_count"] == 1
    assert data["pending_count"] == 1
    assert data["total_count"] == 2


async def test_summary_reports_zero_for_an_empty_filter(client, admin_headers, uniq):
    resp = await client.get(
        "/api/expenses/summary", params={"search": f"nothing-matches-{uniq}"}, headers=admin_headers
    )

    data = resp.json()["data"]
    assert data["total_amount"] == "0.00"
    assert data["total_count"] == 0


async def test_summary_respects_the_date_filter(client, admin_headers, uniq):
    """The strip must describe exactly the rows the table is showing."""
    await _create_expense(client, admin_headers, details=f"Toner {uniq}", amount="900.00")
    yesterday = (today_ist() - timedelta(days=1)).isoformat()

    resp = await client.get(
        "/api/expenses/summary",
        params={"search": uniq, "end_date": yesterday},
        headers=admin_headers,
    )

    assert resp.json()["data"]["total_amount"] == "0.00"


# --------------------------------------------------------------------------
# Update and delete
# --------------------------------------------------------------------------


async def test_update_expense(client, admin_headers, uniq):
    created = await _create_expense(client, admin_headers, details=f"Toner {uniq}")
    expense_id = created.json()["data"]["id"]

    resp = await client.patch(
        f"/api/expenses/{expense_id}",
        json={"status": "Paid", "amount": "300.00", "details": f"Toner and paper {uniq}"},
        headers=admin_headers,
    )

    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["status"] == "Paid"
    assert data["amount"] == "300.00"
    assert data["details"] == f"Toner and paper {uniq}"


async def test_update_expense_requires_admin(client, admin_headers, employee_headers, uniq):
    created = await _create_expense(client, admin_headers, details=f"Toner {uniq}")

    resp = await client.patch(
        f"/api/expenses/{created.json()['data']['id']}",
        json={"status": "Paid"},
        headers=employee_headers,
    )

    assert resp.status_code == 403
    assert resp.json()["error"]["code"] == "FORBIDDEN"


async def test_update_unknown_expense(client, admin_headers):
    resp = await client.patch(
        "/api/expenses/00000000-0000-0000-0000-000000000000",
        json={"status": "Paid"},
        headers=admin_headers,
    )

    assert resp.status_code == 404
    assert resp.json()["error"]["code"] == "NOT_FOUND"


async def test_delete_expense(client, admin_headers, uniq):
    created = await _create_expense(client, admin_headers, details=f"Toner {uniq}")
    expense_id = created.json()["data"]["id"]

    resp = await client.delete(f"/api/expenses/{expense_id}", headers=admin_headers)

    assert resp.status_code == 200
    assert resp.json()["data"]["deleted"] is True
    follow_up = await client.get(f"/api/expenses/{expense_id}", headers=admin_headers)
    assert follow_up.status_code == 404


async def test_delete_expense_requires_admin(client, admin_headers, employee_headers, uniq):
    created = await _create_expense(client, admin_headers, details=f"Toner {uniq}")

    resp = await client.delete(
        f"/api/expenses/{created.json()['data']['id']}", headers=employee_headers
    )

    assert resp.status_code == 403
    assert resp.json()["error"]["code"] == "FORBIDDEN"
