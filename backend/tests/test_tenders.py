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

from datetime import datetime, timedelta

import pytest

from app.core.dates import IST, today_ist


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


# --------------------------------------------------------------------------
# Tender date (CH-22)
# --------------------------------------------------------------------------


async def test_tender_date_defaults_to_today_in_ist(
    client, employee_headers, client_id, tender_department_id
):
    """The IST day, not the UTC one — they differ between 00:00 and 05:30 IST."""
    resp = await _create_tender(client, employee_headers, client_id, tender_department_id)

    assert resp.status_code == 201
    assert resp.json()["data"]["tender_date"] == today_ist().isoformat()


async def test_tender_can_be_logged_for_a_past_date(
    client, employee_headers, client_id, tender_department_id
):
    backdated = (today_ist() - timedelta(days=10)).isoformat()

    resp = await _create_tender(
        client, employee_headers, client_id, tender_department_id, tender_date=backdated
    )

    assert resp.status_code == 201
    assert resp.json()["data"]["tender_date"] == backdated


async def test_date_filter_uses_the_tender_date(
    client, employee_headers, client_id, tender_department_id
):
    """A backdated tender is found on its own date, not on the day it was typed in."""
    backdated = (today_ist() - timedelta(days=10)).isoformat()
    today = today_ist().isoformat()
    await _create_tender(
        client, employee_headers, client_id, tender_department_id, tender_date=backdated
    )

    on_its_date = await client.get(
        "/api/tenders",
        params={"client_id": client_id, "start_date": backdated, "end_date": backdated},
        headers=employee_headers,
    )
    on_entry_day = await client.get(
        "/api/tenders",
        params={"client_id": client_id, "start_date": today, "end_date": today},
        headers=employee_headers,
    )

    assert on_its_date.json()["data"]["total_count"] == 1
    assert on_entry_day.json()["data"]["total_count"] == 0


async def test_list_is_ordered_by_tender_date(
    client, employee_headers, client_id, tender_department_id
):
    """Newest tender date first, even when the older-dated row was typed in later."""
    today = today_ist().isoformat()
    backdated = (today_ist() - timedelta(days=3)).isoformat()
    await _create_tender(
        client, employee_headers, client_id, tender_department_id, tender_date=today
    )
    await _create_tender(
        client, employee_headers, client_id, tender_department_id, tender_date=backdated
    )

    resp = await client.get(
        "/api/tenders", params={"client_id": client_id}, headers=employee_headers
    )

    assert [t["tender_date"] for t in resp.json()["data"]["items"]] == [today, backdated]


async def test_tender_date_can_be_changed(
    client, employee_headers, client_id, tender_department_id
):
    created = await _create_tender(client, employee_headers, client_id, tender_department_id)
    corrected = (today_ist() - timedelta(days=1)).isoformat()

    resp = await client.patch(
        f"/api/tenders/{created.json()['data']['id']}",
        json={"tender_date": corrected},
        headers=employee_headers,
    )

    assert resp.status_code == 200
    assert resp.json()["data"]["tender_date"] == corrected


async def test_invalid_tender_date_rejected(
    client, employee_headers, client_id, tender_department_id
):
    resp = await _create_tender(
        client, employee_headers, client_id, tender_department_id, tender_date="31-02-2026"
    )

    assert resp.status_code == 422
    assert resp.json()["error"]["code"] == "VALIDATION_ERROR"


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


async def test_tender_department_in_use_cannot_be_deleted(
    client, admin_headers, employee_headers, client_id, tender_department_id
):
    """A department on a logged tender is part of that record (CH-21).

    Deleting it is refused rather than cascaded; deactivating still works.
    """
    await _create_tender(client, employee_headers, client_id, tender_department_id)

    deleted = await client.delete(
        f"/api/tender-departments/{tender_department_id}", headers=admin_headers
    )
    deactivated = await client.patch(
        f"/api/tender-departments/{tender_department_id}",
        json={"is_active": False},
        headers=admin_headers,
    )

    assert deleted.status_code == 409
    assert deleted.json()["error"]["code"] == "TENDER_DEPARTMENT_IN_USE"
    assert deactivated.status_code == 200
    assert deactivated.json()["data"]["is_active"] is False


# --------------------------------------------------------------------------
# Bulk delete (CH-29)
# --------------------------------------------------------------------------


async def test_bulk_delete_removes_every_selected_tender(
    client, admin_headers, employee_headers, client_id, tender_department_id
):
    """The point of the feature: clear out a client's finished tenders in one go."""
    ids = []
    for _ in range(3):
        created = await _create_tender(client, employee_headers, client_id, tender_department_id)
        ids.append(created.json()["data"]["id"])

    resp = await client.post("/api/tenders/bulk-delete", json={"ids": ids}, headers=admin_headers)

    assert resp.status_code == 200
    assert resp.json()["data"] == {"deleted": 3, "requested": 3}
    remaining = await client.get(
        "/api/tenders", params={"client_id": client_id}, headers=admin_headers
    )
    assert remaining.json()["data"]["total_count"] == 0


async def test_bulk_delete_leaves_unselected_tenders_alone(
    client, admin_headers, employee_headers, client_id, tender_department_id
):
    doomed = await _create_tender(client, employee_headers, client_id, tender_department_id)
    survivor = await _create_tender(client, employee_headers, client_id, tender_department_id)

    resp = await client.post(
        "/api/tenders/bulk-delete",
        json={"ids": [doomed.json()["data"]["id"]]},
        headers=admin_headers,
    )

    assert resp.json()["data"]["deleted"] == 1
    still_there = await client.get(
        f"/api/tenders/{survivor.json()['data']['id']}", headers=admin_headers
    )
    assert still_there.status_code == 200


async def test_bulk_delete_requires_admin(
    client, employee_headers, client_id, tender_department_id
):
    """Deletion is admin-only however many rows are involved (CH-19)."""
    created = await _create_tender(client, employee_headers, client_id, tender_department_id)

    resp = await client.post(
        "/api/tenders/bulk-delete",
        json={"ids": [created.json()["data"]["id"]]},
        headers=employee_headers,
    )

    assert resp.status_code == 403
    assert resp.json()["error"]["code"] == "FORBIDDEN"


async def test_bulk_delete_requires_auth(client):
    resp = await client.post(
        "/api/tenders/bulk-delete", json={"ids": ["00000000-0000-0000-0000-000000000000"]}
    )

    assert resp.status_code == 401
    assert resp.json()["error"]["code"] == "UNAUTHENTICATED"


async def test_bulk_delete_rejects_an_empty_list(client, admin_headers):
    """An empty request is a bug in the caller, not a no-op worth honouring."""
    resp = await client.post("/api/tenders/bulk-delete", json={"ids": []}, headers=admin_headers)

    assert resp.status_code == 422
    assert resp.json()["error"]["code"] == "VALIDATION_ERROR"


async def test_bulk_delete_is_capped(client, admin_headers):
    ids = ["00000000-0000-0000-0000-000000000000"] * 101

    resp = await client.post("/api/tenders/bulk-delete", json={"ids": ids}, headers=admin_headers)

    assert resp.status_code == 422
    assert resp.json()["error"]["code"] == "VALIDATION_ERROR"


async def test_bulk_delete_tolerates_an_already_deleted_id(
    client, admin_headers, employee_headers, client_id, tender_department_id
):
    """Deleted twice is not an error — the caller's intent already holds."""
    created = await _create_tender(client, employee_headers, client_id, tender_department_id)
    tender_id = created.json()["data"]["id"]
    await client.delete(f"/api/tenders/{tender_id}", headers=admin_headers)

    resp = await client.post(
        "/api/tenders/bulk-delete", json={"ids": [tender_id]}, headers=admin_headers
    )

    assert resp.status_code == 200
    assert resp.json()["data"] == {"deleted": 0, "requested": 1}


async def test_bulk_delete_route_not_shadowed_by_the_id_route(client, admin_headers):
    """`/bulk-delete` must resolve as a literal path, not as a tender id."""
    resp = await client.post(
        "/api/tenders/bulk-delete",
        json={"ids": ["00000000-0000-0000-0000-000000000000"]},
        headers=admin_headers,
    )

    assert resp.status_code == 200


# --------------------------------------------------------------------------
# Payer details (CH-32)
# --------------------------------------------------------------------------


async def test_payer_details_are_optional(
    client, employee_headers, client_id, tender_department_id
):
    """Plenty of tenders are settled with nobody walking in."""
    resp = await _create_tender(client, employee_headers, client_id, tender_department_id)

    assert resp.status_code == 201
    assert resp.json()["data"]["payer_name"] is None
    assert resp.json()["data"]["payer_contact"] is None


async def test_payer_details_are_recorded(
    client, employee_headers, client_id, tender_department_id
):
    resp = await _create_tender(
        client,
        employee_headers,
        client_id,
        tender_department_id,
        payer_name="Suresh Patil",
        payer_contact="+91 98765 43210",
    )

    assert resp.status_code == 201
    data = resp.json()["data"]
    assert data["payer_name"] == "Suresh Patil"
    # Normalized to ten digits, like every other phone field (CH-17).
    assert data["payer_contact"] == "9876543210"


async def test_blank_payer_details_are_stored_as_nothing(
    client, employee_headers, client_id, tender_department_id
):
    resp = await _create_tender(
        client,
        employee_headers,
        client_id,
        tender_department_id,
        payer_name="   ",
        payer_contact="",
    )

    assert resp.status_code == 201
    assert resp.json()["data"]["payer_name"] is None
    assert resp.json()["data"]["payer_contact"] is None


async def test_a_given_payer_contact_must_be_a_real_mobile(
    client, employee_headers, client_id, tender_department_id
):
    """Optional, but a half-typed number is worse than none."""
    resp = await _create_tender(
        client, employee_headers, client_id, tender_department_id, payer_contact="12345"
    )

    assert resp.status_code == 422
    assert resp.json()["error"]["code"] == "VALIDATION_ERROR"


async def test_payer_can_change_between_payments(
    client, employee_headers, client_id, tender_department_id
):
    """The point of the field: a different person can come in next time."""
    created = await _create_tender(
        client, employee_headers, client_id, tender_department_id, payer_name="Suresh Patil"
    )

    resp = await client.patch(
        f"/api/tenders/{created.json()['data']['id']}",
        json={"payer_name": "Anita Joshi", "payer_contact": "9123456780"},
        headers=employee_headers,
    )

    assert resp.status_code == 200
    assert resp.json()["data"]["payer_name"] == "Anita Joshi"
    assert resp.json()["data"]["payer_contact"] == "9123456780"


# --------------------------------------------------------------------------
# Settling a client's dues (CH-35)
# --------------------------------------------------------------------------


async def _settle(client, headers, client_id, amount, **overrides):
    payload = {
        "client_id": client_id,
        "amount": amount,
        "payment_mode": "Cash",
        **overrides,
    }
    return await client.post("/api/tenders/settle", json=payload, headers=headers)


async def _three_pending(client, headers, client_id, tender_department_id):
    """The worked example: 3000, 3000 and 4000 pending, oldest first."""
    ids = []
    for days_ago, price in ((3, "3000.00"), (2, "3000.00"), (1, "4000.00")):
        created = await _create_tender(
            client,
            headers,
            client_id,
            tender_department_id,
            quantity=1,
            price=price,
            tender_date=(today_ist() - timedelta(days=days_ago)).isoformat(),
        )
        ids.append(created.json()["data"]["id"])
    return ids


async def test_outstanding_reports_what_is_owed(
    client, employee_headers, client_id, tender_department_id
):
    await _three_pending(client, employee_headers, client_id, tender_department_id)

    resp = await client.get(
        "/api/tenders/outstanding", params={"client_id": client_id}, headers=employee_headers
    )

    assert resp.status_code == 200
    assert resp.json()["data"] == {"outstanding": "10000.00", "unpaid_count": 3}


async def test_outstanding_is_not_admin_only(client, employee_headers, client_id):
    """One client's balance is desk information, unlike the business totals (CH-12)."""
    resp = await client.get(
        "/api/tenders/outstanding", params={"client_id": client_id}, headers=employee_headers
    )

    assert resp.status_code == 200


async def test_settlement_spreads_across_tenders_oldest_first(
    client, employee_headers, client_id, tender_department_id
):
    """The worked example: 5000 against 3000 + 3000 + 4000."""
    first, second, third = await _three_pending(
        client, employee_headers, client_id, tender_department_id
    )

    resp = await _settle(client, employee_headers, client_id, "5000.00")

    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["amount_applied"] == "5000.00"
    assert data["outstanding_before"] == "10000.00"
    assert data["outstanding_after"] == "5000.00"

    # The oldest is settled in full, the next takes the remainder, the third is
    # never touched.
    assert [a["applied"] for a in data["allocations"]] == ["3000.00", "2000.00"]
    assert [a["new_status"] for a in data["allocations"]] == ["Paid", "Partially Paid"]

    listed = await client.get(
        "/api/tenders", params={"client_id": client_id}, headers=employee_headers
    )
    rows = {t["id"]: t for t in listed.json()["data"]["items"]}
    assert rows[first]["status"] == "Paid"
    assert rows[first]["remaining_amount"] == "0.00"
    assert rows[second]["status"] == "Partially Paid"
    assert rows[second]["paid_amount"] == "2000.00"
    assert rows[second]["remaining_amount"] == "1000.00"
    assert rows[third]["status"] == "Pending"
    assert rows[third]["paid_amount"] == "0.00"


async def test_settlement_records_the_payment_mode(
    client, employee_headers, client_id, tender_department_id
):
    first, _, _ = await _three_pending(client, employee_headers, client_id, tender_department_id)

    await _settle(client, employee_headers, client_id, "3000.00", payment_mode="Online")

    resp = await client.get(f"/api/tenders/{first}", headers=employee_headers)
    assert resp.json()["data"]["payment_mode"] == "Online"


async def test_settlement_tops_up_an_already_partial_tender(
    client, employee_headers, client_id, tender_department_id
):
    """A part-paid tender is the oldest debt, so it is filled before the next."""
    created = await _create_tender(
        client,
        employee_headers,
        client_id,
        tender_department_id,
        quantity=1,
        price="3000.00",
        status="Partially Paid",
        paid_amount="1000.00",
        payment_mode="Cash",
    )
    tender_id = created.json()["data"]["id"]

    resp = await _settle(client, employee_headers, client_id, "2000.00")

    assert resp.status_code == 200
    assert resp.json()["data"]["allocations"][0]["previously_paid"] == "1000.00"
    follow_up = await client.get(f"/api/tenders/{tender_id}", headers=employee_headers)
    assert follow_up.json()["data"]["status"] == "Paid"


async def test_settlement_can_clear_everything(
    client, employee_headers, client_id, tender_department_id
):
    await _three_pending(client, employee_headers, client_id, tender_department_id)

    resp = await _settle(client, employee_headers, client_id, "10000.00")

    assert resp.json()["data"]["outstanding_after"] == "0.00"
    after = await client.get(
        "/api/tenders/outstanding", params={"client_id": client_id}, headers=employee_headers
    )
    assert after.json()["data"] == {"outstanding": "0.00", "unpaid_count": 0}


async def test_overpayment_is_refused(client, employee_headers, client_id, tender_department_id):
    """Taking more than is owed would be money the app cannot account for."""
    await _three_pending(client, employee_headers, client_id, tender_department_id)

    resp = await _settle(client, employee_headers, client_id, "12000.00")

    assert resp.status_code == 422
    assert resp.json()["error"]["code"] == "AMOUNT_EXCEEDS_OUTSTANDING"
    # Nothing moved.
    after = await client.get(
        "/api/tenders/outstanding", params={"client_id": client_id}, headers=employee_headers
    )
    assert after.json()["data"]["outstanding"] == "10000.00"


async def test_settling_with_nothing_outstanding_is_refused(
    client, employee_headers, client_id, tender_department_id
):
    await _create_tender(
        client,
        employee_headers,
        client_id,
        tender_department_id,
        status="Paid",
        payment_mode="Cash",
    )

    resp = await _settle(client, employee_headers, client_id, "100.00")

    assert resp.status_code == 422
    assert resp.json()["error"]["code"] == "NOTHING_OUTSTANDING"


async def test_preview_changes_nothing(client, employee_headers, client_id, tender_department_id):
    """The plan the user confirms comes from the code that carries it out."""
    await _three_pending(client, employee_headers, client_id, tender_department_id)

    resp = await _settle(client, employee_headers, client_id, "5000.00", preview=True)

    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["preview"] is True
    assert [a["applied"] for a in data["allocations"]] == ["3000.00", "2000.00"]
    # ...and the tenders are untouched.
    after = await client.get(
        "/api/tenders/outstanding", params={"client_id": client_id}, headers=employee_headers
    )
    assert after.json()["data"]["outstanding"] == "10000.00"


async def test_settlement_rejects_a_zero_amount(client, employee_headers, client_id):
    resp = await _settle(client, employee_headers, client_id, "0.00")

    assert resp.status_code == 422
    assert resp.json()["error"]["code"] == "VALIDATION_ERROR"


async def test_settlement_requires_a_payment_mode(client, employee_headers, client_id):
    resp = await client.post(
        "/api/tenders/settle",
        json={"client_id": client_id, "amount": "100.00"},
        headers=employee_headers,
    )

    assert resp.status_code == 422
    assert resp.json()["error"]["code"] == "VALIDATION_ERROR"


async def test_settlement_unknown_client(client, employee_headers):
    resp = await _settle(client, employee_headers, "00000000-0000-0000-0000-000000000000", "100.00")

    assert resp.status_code == 404
    assert resp.json()["error"]["code"] == "CLIENT_NOT_FOUND"


async def test_settlement_requires_auth(client, client_id):
    resp = await client.post(
        "/api/tenders/settle",
        json={"client_id": client_id, "amount": "100.00", "payment_mode": "Cash"},
    )

    assert resp.status_code == 401
    assert resp.json()["error"]["code"] == "UNAUTHENTICATED"


async def test_settlement_only_touches_the_named_client(
    client, employee_headers, client_id, tender_department_id, uniq
):
    """Money paid by one client must never pay down the debt of another."""
    other = await client.post(
        "/api/clients",
        json={
            "contact_person_name": f"Other Person {uniq}",
            "company_name": f"Other Company {uniq}",
            "contact_number": "9123456780",
            "email": f"other-{uniq}@example.com",
        },
        headers=employee_headers,
    )
    other_id = other.json()["data"]["id"]
    await _create_tender(
        client, employee_headers, other_id, tender_department_id, quantity=1, price="5000.00"
    )
    await _three_pending(client, employee_headers, client_id, tender_department_id)

    await _settle(client, employee_headers, client_id, "5000.00")

    untouched = await client.get(
        "/api/tenders/outstanding", params={"client_id": other_id}, headers=employee_headers
    )
    assert untouched.json()["data"]["outstanding"] == "5000.00"
