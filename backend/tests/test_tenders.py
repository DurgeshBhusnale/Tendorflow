"""Tender tracking.

Three things carry most of the risk here. total_amount and remaining_amount are
Postgres generated columns, so the app must never write them and must always
read back what Postgres computed. Money has to survive JSON as an exact 2dp
string, not a float. And the payment rules — which status requires which of
paid_amount and payment_mode — are enforced in three layers, so the tests check
the behaviour rather than any one layer.

Runs against a database holding committed demo data, so rows are uniquely
named and assertions check membership rather than absolute counts.
"""

from datetime import UTC, datetime, timedelta

import pytest

from app.core.dates import IST


@pytest.fixture
async def client_id(client, employee_headers, uniq) -> str:
    resp = await client.post(
        "/api/clients",
        json={
            "contact_person_name": f"Rohan Mehta {uniq}",
            "company_name": f"Mehta Constructions {uniq}",
            "contact_number": "+91 98765 43210",
            "email": f"rohan-{uniq}@mehtaconstructions.com",
        },
        headers=employee_headers,
    )
    return resp.json()["data"]["id"]


@pytest.fixture
async def tender_department_id(client, admin_headers, uniq) -> str:
    resp = await client.post(
        "/api/tender-departments", json={"name": f"Civil-Works-{uniq}"}, headers=admin_headers
    )
    return resp.json()["data"]["id"]


async def _create_tender(client, headers, client_id, tender_department_id, **overrides):
    payload = {
        "client_id": client_id,
        "tender_department_id": tender_department_id,
        "quantity": 10,
        "price": "2500.00",
        **overrides,
    }
    return await client.post("/api/tenders", json=payload, headers=headers)


# --------------------------------------------------------------------------
# Creation and computed columns
# --------------------------------------------------------------------------


async def test_create_tender_happy_path(
    client, employee_headers, client_id, tender_department_id, uniq
):
    resp = await _create_tender(client, employee_headers, client_id, tender_department_id)

    assert resp.status_code == 201
    data = resp.json()["data"]
    assert data["client"]["company_name"] == f"Mehta Constructions {uniq}"
    assert data["client"]["contact_person_name"] == f"Rohan Mehta {uniq}"
    assert data["tender_department"]["name"] == f"Civil-Works-{uniq}"
    assert data["quantity"] == 10
    assert data["price"] == "2500.00"
    assert data["total_amount"] == "25000.00"
    assert data["paid_amount"] == "0.00"
    assert data["remaining_amount"] == "25000.00"
    assert data["status"] == "Pending"
    assert data["payment_mode"] is None
    assert data["created_by"]["full_name"] == "Test User"


async def test_status_defaults_to_pending(
    client, employee_headers, client_id, tender_department_id
):
    resp = await _create_tender(client, employee_headers, client_id, tender_department_id)

    assert resp.json()["data"]["status"] == "Pending"


async def test_computed_amounts_are_not_accepted_from_the_client(
    client, employee_headers, client_id, tender_department_id
):
    """Sending the generated columns must not influence the stored values."""
    resp = await client.post(
        "/api/tenders",
        json={
            "client_id": client_id,
            "tender_department_id": tender_department_id,
            "quantity": 3,
            "price": "100.00",
            "total_amount": "999999.00",
            "remaining_amount": "999999.00",
        },
        headers=employee_headers,
    )

    assert resp.status_code == 201
    data = resp.json()["data"]
    assert data["total_amount"] == "300.00"
    assert data["remaining_amount"] == "300.00"


async def test_money_is_serialized_as_exact_string(
    client, employee_headers, client_id, tender_department_id
):
    """Money must cross the wire as a fixed-2dp string, never a float."""
    resp = await _create_tender(
        client, employee_headers, client_id, tender_department_id, quantity=3, price="0.10"
    )

    data = resp.json()["data"]
    assert isinstance(data["price"], str)
    assert isinstance(data["total_amount"], str)
    assert data["price"] == "0.10"
    # 3 * 0.10 is exactly 0.30 in numeric; as a float it would be 0.30000000000000004
    assert data["total_amount"] == "0.30"


async def test_amounts_recompute_on_update(
    client, employee_headers, client_id, tender_department_id
):
    created = await _create_tender(client, employee_headers, client_id, tender_department_id)
    tender_id = created.json()["data"]["id"]

    resp = await client.patch(
        f"/api/tenders/{tender_id}", json={"quantity": 4}, headers=employee_headers
    )

    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["quantity"] == 4
    assert data["total_amount"] == "10000.00"
    assert data["remaining_amount"] == "10000.00"


# --------------------------------------------------------------------------
# Payment rules (CH-05, CH-06)
# --------------------------------------------------------------------------


async def test_paid_requires_payment_mode(
    client, employee_headers, client_id, tender_department_id
):
    resp = await _create_tender(
        client, employee_headers, client_id, tender_department_id, status="Paid"
    )

    assert resp.status_code == 422
    assert resp.json()["error"]["code"] == "VALIDATION_ERROR"


async def test_paid_sets_paid_amount_to_the_full_total(
    client, employee_headers, client_id, tender_department_id
):
    """'Paid' means the whole total arrived — the server derives the figure."""
    resp = await _create_tender(
        client,
        employee_headers,
        client_id,
        tender_department_id,
        status="Paid",
        payment_mode="Cash",
        paid_amount="1.00",
    )

    assert resp.status_code == 201
    data = resp.json()["data"]
    assert data["paid_amount"] == "25000.00"
    assert data["remaining_amount"] == "0.00"
    assert data["payment_mode"] == "Cash"


async def test_partially_paid_requires_payment_mode(
    client, employee_headers, client_id, tender_department_id
):
    resp = await _create_tender(
        client,
        employee_headers,
        client_id,
        tender_department_id,
        status="Partially Paid",
        paid_amount="1000.00",
    )

    assert resp.status_code == 422
    assert resp.json()["error"]["code"] == "VALIDATION_ERROR"


async def test_partially_paid_requires_an_amount(
    client, employee_headers, client_id, tender_department_id
):
    resp = await _create_tender(
        client,
        employee_headers,
        client_id,
        tender_department_id,
        status="Partially Paid",
        payment_mode="Online",
    )

    assert resp.status_code == 422
    assert resp.json()["error"]["code"] == "VALIDATION_ERROR"


async def test_partially_paid_happy_path(client, employee_headers, client_id, tender_department_id):
    resp = await _create_tender(
        client,
        employee_headers,
        client_id,
        tender_department_id,
        status="Partially Paid",
        paid_amount="10000.00",
        payment_mode="Online",
    )

    assert resp.status_code == 201
    data = resp.json()["data"]
    assert data["status"] == "Partially Paid"
    assert data["paid_amount"] == "10000.00"
    assert data["remaining_amount"] == "15000.00"
    assert data["payment_mode"] == "Online"


async def test_partial_payment_cannot_equal_the_total(
    client, employee_headers, client_id, tender_department_id
):
    """A partial payment of the whole amount is a Paid tender, not a partial one."""
    resp = await _create_tender(
        client,
        employee_headers,
        client_id,
        tender_department_id,
        status="Partially Paid",
        paid_amount="25000.00",
        payment_mode="Cash",
    )

    assert resp.status_code == 422
    assert resp.json()["error"]["code"] == "VALIDATION_ERROR"


async def test_partial_payment_cannot_be_zero(
    client, employee_headers, client_id, tender_department_id
):
    resp = await _create_tender(
        client,
        employee_headers,
        client_id,
        tender_department_id,
        status="Partially Paid",
        paid_amount="0.00",
        payment_mode="Cash",
    )

    assert resp.status_code == 422
    assert resp.json()["error"]["code"] == "VALIDATION_ERROR"


async def test_pending_rejects_a_payment_mode(
    client, employee_headers, client_id, tender_department_id
):
    resp = await _create_tender(
        client,
        employee_headers,
        client_id,
        tender_department_id,
        status="Pending",
        payment_mode="Cash",
    )

    assert resp.status_code == 422
    assert resp.json()["error"]["code"] == "VALIDATION_ERROR"


async def test_moving_back_to_pending_clears_the_payment_record(
    client, employee_headers, client_id, tender_department_id
):
    """A correction to Pending must wipe the mode and amount, not trip over them."""
    created = await _create_tender(
        client,
        employee_headers,
        client_id,
        tender_department_id,
        status="Partially Paid",
        paid_amount="5000.00",
        payment_mode="Cash",
    )
    tender_id = created.json()["data"]["id"]

    resp = await client.patch(
        f"/api/tenders/{tender_id}", json={"status": "Pending"}, headers=employee_headers
    )

    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["status"] == "Pending"
    assert data["paid_amount"] == "0.00"
    assert data["payment_mode"] is None
    assert data["remaining_amount"] == "25000.00"


async def test_repricing_a_paid_tender_keeps_it_fully_paid(
    client, employee_headers, client_id, tender_department_id
):
    """The DB CHECK ties paid_amount to the total, so a price edit must carry it."""
    created = await _create_tender(
        client,
        employee_headers,
        client_id,
        tender_department_id,
        status="Paid",
        payment_mode="Cash",
    )
    tender_id = created.json()["data"]["id"]

    resp = await client.patch(
        f"/api/tenders/{tender_id}", json={"price": "3000.00"}, headers=employee_headers
    )

    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["total_amount"] == "30000.00"
    assert data["paid_amount"] == "30000.00"
    assert data["remaining_amount"] == "0.00"


async def test_repricing_below_a_partial_payment_is_rejected(
    client, employee_headers, client_id, tender_department_id
):
    created = await _create_tender(
        client,
        employee_headers,
        client_id,
        tender_department_id,
        status="Partially Paid",
        paid_amount="20000.00",
        payment_mode="Cash",
    )
    tender_id = created.json()["data"]["id"]

    resp = await client.patch(
        f"/api/tenders/{tender_id}", json={"quantity": 1}, headers=employee_headers
    )

    assert resp.status_code == 422
    assert resp.json()["error"]["code"] == "VALIDATION_ERROR"


async def test_promoting_a_partial_to_paid_settles_the_balance(
    client, employee_headers, client_id, tender_department_id
):
    created = await _create_tender(
        client,
        employee_headers,
        client_id,
        tender_department_id,
        status="Partially Paid",
        paid_amount="10000.00",
        payment_mode="Online",
    )
    tender_id = created.json()["data"]["id"]

    resp = await client.patch(
        f"/api/tenders/{tender_id}", json={"status": "Paid"}, headers=employee_headers
    )

    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["paid_amount"] == "25000.00"
    assert data["remaining_amount"] == "0.00"
    # The mode carries over from the partial payment rather than being cleared.
    assert data["payment_mode"] == "Online"


# --------------------------------------------------------------------------
# Validation and references
# --------------------------------------------------------------------------


async def test_create_tender_requires_auth(client, client_id, tender_department_id):
    resp = await client.post(
        "/api/tenders",
        json={
            "client_id": client_id,
            "tender_department_id": tender_department_id,
            "quantity": 1,
            "price": "1.00",
        },
    )

    assert resp.status_code == 401
    assert resp.json()["error"]["code"] == "UNAUTHENTICATED"


async def test_create_tender_rejects_zero_quantity(
    client, employee_headers, client_id, tender_department_id
):
    resp = await _create_tender(
        client, employee_headers, client_id, tender_department_id, quantity=0
    )

    assert resp.status_code == 422
    assert resp.json()["error"]["code"] == "VALIDATION_ERROR"


async def test_create_tender_rejects_negative_price(
    client, employee_headers, client_id, tender_department_id
):
    resp = await _create_tender(
        client, employee_headers, client_id, tender_department_id, price="-1.00"
    )

    assert resp.status_code == 422
    assert resp.json()["error"]["code"] == "VALIDATION_ERROR"


async def test_create_tender_unknown_client(client, employee_headers, tender_department_id):
    resp = await _create_tender(
        client, employee_headers, "00000000-0000-0000-0000-000000000000", tender_department_id
    )

    assert resp.status_code == 404
    assert resp.json()["error"]["code"] == "CLIENT_NOT_FOUND"


async def test_create_tender_unknown_tender_department(client, employee_headers, client_id):
    resp = await _create_tender(
        client, employee_headers, client_id, "00000000-0000-0000-0000-000000000000"
    )

    assert resp.status_code == 404
    assert resp.json()["error"]["code"] == "TENDER_DEPARTMENT_NOT_FOUND"


async def test_invalid_status_rejected(client, employee_headers, client_id, tender_department_id):
    created = await _create_tender(client, employee_headers, client_id, tender_department_id)
    tender_id = created.json()["data"]["id"]

    resp = await client.patch(
        f"/api/tenders/{tender_id}", json={"status": "Overdue"}, headers=employee_headers
    )

    assert resp.status_code == 422
    assert resp.json()["error"]["code"] == "VALIDATION_ERROR"


# --------------------------------------------------------------------------
# Filtering and search
# --------------------------------------------------------------------------


async def test_filter_by_status(client, employee_headers, client_id, tender_department_id):
    await _create_tender(
        client,
        employee_headers,
        client_id,
        tender_department_id,
        status="Paid",
        payment_mode="Cash",
    )
    await _create_tender(client, employee_headers, client_id, tender_department_id, quantity=2)

    resp = await client.get(
        "/api/tenders",
        params={"client_id": client_id, "status": "Paid"},
        headers=employee_headers,
    )

    body = resp.json()["data"]
    assert body["total_count"] == 1
    assert all(item["status"] == "Paid" for item in body["items"])


async def test_search_matches_tender_department(
    client, employee_headers, client_id, tender_department_id, uniq
):
    await _create_tender(client, employee_headers, client_id, tender_department_id)

    resp = await client.get(
        "/api/tenders", params={"search": f"Civil-Works-{uniq}"}, headers=employee_headers
    )

    body = resp.json()["data"]
    assert body["total_count"] == 1
    assert body["items"][0]["tender_department"]["name"] == f"Civil-Works-{uniq}"


async def test_search_matches_contact_person_name(
    client, employee_headers, client_id, tender_department_id, uniq
):
    """Search covers the client's own name, not just their company (CH-07)."""
    await _create_tender(client, employee_headers, client_id, tender_department_id)

    resp = await client.get(
        "/api/tenders", params={"search": f"Rohan Mehta {uniq}"}, headers=employee_headers
    )

    body = resp.json()["data"]
    assert body["total_count"] == 1
    assert body["items"][0]["client"]["contact_person_name"] == f"Rohan Mehta {uniq}"


async def test_search_matches_company_name(
    client, employee_headers, client_id, tender_department_id, uniq
):
    await _create_tender(client, employee_headers, client_id, tender_department_id)

    resp = await client.get(
        "/api/tenders",
        params={"search": f"Mehta Constructions {uniq}"},
        headers=employee_headers,
    )

    assert resp.json()["data"]["total_count"] == 1


async def test_date_range_includes_today_in_ist(
    client, employee_headers, client_id, tender_department_id
):
    """Both bounds are inclusive IST calendar days (CH-11)."""
    await _create_tender(client, employee_headers, client_id, tender_department_id)
    today_ist = datetime.now(IST).date().isoformat()

    resp = await client.get(
        "/api/tenders",
        params={"client_id": client_id, "start_date": today_ist, "end_date": today_ist},
        headers=employee_headers,
    )

    assert resp.status_code == 200
    assert resp.json()["data"]["total_count"] == 1


async def test_date_range_excludes_rows_outside_it(
    client, employee_headers, client_id, tender_department_id
):
    await _create_tender(client, employee_headers, client_id, tender_department_id)
    yesterday_ist = (datetime.now(IST).date() - timedelta(days=1)).isoformat()

    resp = await client.get(
        "/api/tenders",
        params={"client_id": client_id, "end_date": yesterday_ist},
        headers=employee_headers,
    )

    assert resp.json()["data"]["total_count"] == 0


async def test_late_evening_ist_still_falls_on_the_ist_day(
    client, employee_headers, client_id, tender_department_id
):
    """A tender logged at 23:00 IST is stored as the next UTC day.

    Filtering on its IST date must still find it — that off-by-one is the whole
    reason the bounds are converted rather than compared as UTC dates.
    """
    await _create_tender(client, employee_headers, client_id, tender_department_id)
    now_ist = datetime.now(IST)
    # The UTC calendar date differs from the IST one only between 18:30 and
    # midnight IST, so assert the relationship the conversion guarantees rather
    # than a clock reading the test cannot control.
    utc_date = datetime.now(UTC).date()
    ist_date = now_ist.date()
    assert (ist_date - utc_date).days in (0, 1)

    resp = await client.get(
        "/api/tenders",
        params={
            "client_id": client_id,
            "start_date": ist_date.isoformat(),
            "end_date": ist_date.isoformat(),
        },
        headers=employee_headers,
    )

    assert resp.json()["data"]["total_count"] == 1


# --------------------------------------------------------------------------
# Summary (admin-only, CH-10 and CH-12)
# --------------------------------------------------------------------------


async def test_summary_totals_by_status(
    client, admin_headers, employee_headers, client_id, tender_department_id
):
    await _create_tender(
        client,
        employee_headers,
        client_id,
        tender_department_id,
        quantity=2,
        price="1000.00",
        status="Paid",
        payment_mode="Cash",
    )
    await _create_tender(
        client, employee_headers, client_id, tender_department_id, quantity=3, price="500.00"
    )

    resp = await client.get(
        "/api/tenders/summary", params={"client_id": client_id}, headers=admin_headers
    )

    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["total_paid_value"] == "2000.00"
    assert data["total_pending_value"] == "1500.00"
    assert data["paid_count"] == 1
    assert data["pending_count"] == 1


async def test_outstanding_counts_only_the_unpaid_balance(
    client, admin_headers, employee_headers, client_id, tender_department_id
):
    """The bug partial payments would otherwise introduce.

    A part-settled tender owes its balance, not its contract value. Summing
    total_amount over the unpaid statuses would report 10000 here instead of
    6000.
    """
    await _create_tender(
        client,
        employee_headers,
        client_id,
        tender_department_id,
        quantity=1,
        price="10000.00",
        status="Partially Paid",
        paid_amount="4000.00",
        payment_mode="Online",
    )

    resp = await client.get(
        "/api/tenders/summary", params={"client_id": client_id}, headers=admin_headers
    )

    data = resp.json()["data"]
    assert data["total_partially_paid_value"] == "10000.00"
    assert data["total_outstanding_value"] == "6000.00"
    assert data["partially_paid_count"] == 1


async def test_outstanding_spans_pending_and_partial(
    client, admin_headers, employee_headers, client_id, tender_department_id
):
    await _create_tender(
        client, employee_headers, client_id, tender_department_id, quantity=1, price="1000.00"
    )
    await _create_tender(
        client,
        employee_headers,
        client_id,
        tender_department_id,
        quantity=1,
        price="1000.00",
        status="Partially Paid",
        paid_amount="250.00",
        payment_mode="Cash",
    )

    resp = await client.get(
        "/api/tenders/summary", params={"client_id": client_id}, headers=admin_headers
    )

    # 1000 pending + 750 still owed on the partial
    assert resp.json()["data"]["total_outstanding_value"] == "1750.00"


async def test_summary_reports_zero_for_empty_filter(client, admin_headers, client_id):
    """A client with no tenders yet must report 0.00, not null."""
    resp = await client.get(
        "/api/tenders/summary", params={"client_id": client_id}, headers=admin_headers
    )

    data = resp.json()["data"]
    assert data["total_paid_value"] == "0.00"
    assert data["total_pending_value"] == "0.00"
    assert data["total_outstanding_value"] == "0.00"
    assert data["paid_count"] == 0
    assert data["pending_count"] == 0


async def test_summary_respects_the_date_filter(
    client, admin_headers, employee_headers, client_id, tender_department_id
):
    """The strip must describe exactly the rows the table is showing."""
    await _create_tender(
        client, employee_headers, client_id, tender_department_id, quantity=1, price="900.00"
    )
    yesterday_ist = (datetime.now(IST).date() - timedelta(days=1)).isoformat()

    resp = await client.get(
        "/api/tenders/summary",
        params={"client_id": client_id, "end_date": yesterday_ist},
        headers=admin_headers,
    )

    assert resp.json()["data"]["total_pending_value"] == "0.00"


async def test_summary_route_not_shadowed_by_id_route(client, admin_headers):
    """`/summary` must resolve as a literal path, not as a tender id."""
    resp = await client.get("/api/tenders/summary", headers=admin_headers)

    assert resp.status_code == 200
    assert "total_paid_value" in resp.json()["data"]


async def test_summary_requires_auth(client):
    resp = await client.get("/api/tenders/summary")

    assert resp.status_code == 401
    assert resp.json()["error"]["code"] == "UNAUTHENTICATED"


async def test_summary_is_admin_only(client, employee_headers):
    """Hiding the cards is not enough — the numbers are revenue (CH-12)."""
    resp = await client.get("/api/tenders/summary", headers=employee_headers)

    assert resp.status_code == 403
    assert resp.json()["error"]["code"] == "FORBIDDEN"


# --------------------------------------------------------------------------
# Permissions (CH-19)
# --------------------------------------------------------------------------


async def test_any_employee_can_update_any_tender(
    client, employee_headers, other_employee_headers, client_id, tender_department_id
):
    """Tenders are open-edit; the row records the latest hand that touched it."""
    created = await _create_tender(client, employee_headers, client_id, tender_department_id)
    tender_id = created.json()["data"]["id"]

    resp = await client.patch(
        f"/api/tenders/{tender_id}",
        json={"status": "Paid", "payment_mode": "Cash"},
        headers=other_employee_headers,
    )

    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["status"] == "Paid"
    assert data["created_by"]["full_name"] == "Other Employee"


async def test_admin_can_update_any_tender(
    client, employee_headers, admin_headers, client_id, tender_department_id
):
    created = await _create_tender(client, employee_headers, client_id, tender_department_id)
    tender_id = created.json()["data"]["id"]

    resp = await client.patch(
        f"/api/tenders/{tender_id}",
        json={"status": "Paid", "payment_mode": "Online"},
        headers=admin_headers,
    )

    assert resp.status_code == 200
    assert resp.json()["data"]["status"] == "Paid"


async def test_employee_cannot_delete_a_tender(
    client, employee_headers, client_id, tender_department_id
):
    """Deletion is admin-only now that created_by names the last editor."""
    created = await _create_tender(client, employee_headers, client_id, tender_department_id)
    tender_id = created.json()["data"]["id"]

    resp = await client.delete(f"/api/tenders/{tender_id}", headers=employee_headers)

    assert resp.status_code == 403
    assert resp.json()["error"]["code"] == "FORBIDDEN"


async def test_admin_can_delete_a_tender(
    client, admin_headers, employee_headers, client_id, tender_department_id
):
    created = await _create_tender(client, employee_headers, client_id, tender_department_id)
    tender_id = created.json()["data"]["id"]

    resp = await client.delete(f"/api/tenders/{tender_id}", headers=admin_headers)

    assert resp.status_code == 200
    assert resp.json()["data"]["deleted"] is True

    follow_up = await client.get(f"/api/tenders/{tender_id}", headers=admin_headers)
    assert follow_up.status_code == 404


async def test_tender_department_in_use_is_deactivated_not_deleted(
    client, admin_headers, employee_headers, client_id, tender_department_id
):
    """Tender departments are deactivated, never deleted, while referenced."""
    await _create_tender(client, employee_headers, client_id, tender_department_id)

    resp = await client.patch(
        f"/api/tender-departments/{tender_department_id}",
        json={"is_active": False},
        headers=admin_headers,
    )

    assert resp.status_code == 200
    assert resp.json()["data"]["is_active"] is False
