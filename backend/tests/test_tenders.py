"""Tender tracking.

The interesting part is total_amount: it is a Postgres generated column, so
the app must never write it and must always read back what Postgres computed.
Money also has to survive JSON as an exact 2dp string, not a float.

Runs against a database holding committed demo data, so rows are uniquely
named and assertions check membership rather than absolute counts.
"""

import pytest


@pytest.fixture
async def client_id(client, employee_headers, uniq) -> str:
    resp = await client.post(
        "/api/clients",
        json={
            "contact_person_name": "Rohan Mehta",
            "company_name": f"Mehta Constructions {uniq}",
            "contact_number": "+91 98765 43210",
            "email": f"rohan-{uniq}@mehtaconstructions.com",
        },
        headers=employee_headers,
    )
    return resp.json()["data"]["id"]


@pytest.fixture
async def tender_name_id(client, admin_headers, uniq) -> str:
    resp = await client.post(
        "/api/tender-names", json={"name": f"Civil-Works-{uniq}"}, headers=admin_headers
    )
    return resp.json()["data"]["id"]


async def _create_tender(client, headers, client_id, tender_name_id, **overrides):
    payload = {
        "client_id": client_id,
        "tender_name_id": tender_name_id,
        "quantity": 10,
        "price": "2500.00",
        **overrides,
    }
    return await client.post("/api/tenders", json=payload, headers=headers)


async def test_create_tender_happy_path(client, employee_headers, client_id, tender_name_id, uniq):
    resp = await _create_tender(client, employee_headers, client_id, tender_name_id)

    assert resp.status_code == 201
    data = resp.json()["data"]
    assert data["client"]["company_name"] == f"Mehta Constructions {uniq}"
    assert data["tender_name"]["name"] == f"Civil-Works-{uniq}"
    assert data["quantity"] == 10
    assert data["price"] == "2500.00"
    assert data["total_amount"] == "25000.00"
    assert data["status"] == "Pending"
    assert data["created_by"]["full_name"] == "Test User"


async def test_status_defaults_to_pending(client, employee_headers, client_id, tender_name_id):
    resp = await _create_tender(client, employee_headers, client_id, tender_name_id)

    assert resp.json()["data"]["status"] == "Pending"


async def test_total_amount_is_computed_not_accepted(
    client, employee_headers, client_id, tender_name_id
):
    """Sending total_amount must not influence the stored value."""
    resp = await client.post(
        "/api/tenders",
        json={
            "client_id": client_id,
            "tender_name_id": tender_name_id,
            "quantity": 3,
            "price": "100.00",
            "total_amount": "999999.00",
        },
        headers=employee_headers,
    )

    assert resp.status_code == 201
    assert resp.json()["data"]["total_amount"] == "300.00"


async def test_money_is_serialized_as_exact_string(
    client, employee_headers, client_id, tender_name_id
):
    """Money must cross the wire as a fixed-2dp string, never a float."""
    resp = await _create_tender(
        client, employee_headers, client_id, tender_name_id, quantity=3, price="0.10"
    )

    data = resp.json()["data"]
    assert isinstance(data["price"], str)
    assert isinstance(data["total_amount"], str)
    assert data["price"] == "0.10"
    # 3 * 0.10 is exactly 0.30 in numeric; as a float it would be 0.30000000000000004
    assert data["total_amount"] == "0.30"


async def test_total_amount_recomputes_on_update(
    client, employee_headers, client_id, tender_name_id
):
    created = await _create_tender(client, employee_headers, client_id, tender_name_id)
    tender_id = created.json()["data"]["id"]

    resp = await client.patch(
        f"/api/tenders/{tender_id}", json={"quantity": 4}, headers=employee_headers
    )

    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["quantity"] == 4
    assert data["total_amount"] == "10000.00"


async def test_create_tender_requires_auth(client, client_id, tender_name_id):
    resp = await client.post(
        "/api/tenders",
        json={
            "client_id": client_id,
            "tender_name_id": tender_name_id,
            "quantity": 1,
            "price": "1.00",
        },
    )

    assert resp.status_code == 401
    assert resp.json()["error"]["code"] == "UNAUTHENTICATED"


async def test_create_tender_rejects_zero_quantity(
    client, employee_headers, client_id, tender_name_id
):
    resp = await _create_tender(client, employee_headers, client_id, tender_name_id, quantity=0)

    assert resp.status_code == 422
    assert resp.json()["error"]["code"] == "VALIDATION_ERROR"


async def test_create_tender_rejects_negative_price(
    client, employee_headers, client_id, tender_name_id
):
    resp = await _create_tender(client, employee_headers, client_id, tender_name_id, price="-1.00")

    assert resp.status_code == 422
    assert resp.json()["error"]["code"] == "VALIDATION_ERROR"


async def test_create_tender_unknown_client(client, employee_headers, tender_name_id):
    resp = await _create_tender(
        client, employee_headers, "00000000-0000-0000-0000-000000000000", tender_name_id
    )

    assert resp.status_code == 404
    assert resp.json()["error"]["code"] == "CLIENT_NOT_FOUND"


async def test_create_tender_unknown_tender_name(client, employee_headers, client_id):
    resp = await _create_tender(
        client, employee_headers, client_id, "00000000-0000-0000-0000-000000000000"
    )

    assert resp.status_code == 404
    assert resp.json()["error"]["code"] == "TENDER_NAME_NOT_FOUND"


async def test_quick_action_flips_status_to_paid(
    client, employee_headers, client_id, tender_name_id
):
    created = await _create_tender(client, employee_headers, client_id, tender_name_id)
    tender_id = created.json()["data"]["id"]

    resp = await client.patch(
        f"/api/tenders/{tender_id}", json={"status": "Paid"}, headers=employee_headers
    )

    assert resp.status_code == 200
    assert resp.json()["data"]["status"] == "Paid"


async def test_invalid_status_rejected(client, employee_headers, client_id, tender_name_id):
    created = await _create_tender(client, employee_headers, client_id, tender_name_id)
    tender_id = created.json()["data"]["id"]

    resp = await client.patch(
        f"/api/tenders/{tender_id}", json={"status": "Overdue"}, headers=employee_headers
    )

    assert resp.status_code == 422
    assert resp.json()["error"]["code"] == "VALIDATION_ERROR"


async def test_filter_by_status(client, employee_headers, client_id, tender_name_id):
    paid = await _create_tender(client, employee_headers, client_id, tender_name_id)
    await client.patch(
        f"/api/tenders/{paid.json()['data']['id']}",
        json={"status": "Paid"},
        headers=employee_headers,
    )
    await _create_tender(client, employee_headers, client_id, tender_name_id, quantity=2)

    resp = await client.get(
        "/api/tenders",
        params={"client_id": client_id, "status": "Paid"},
        headers=employee_headers,
    )

    body = resp.json()["data"]
    assert body["total_count"] == 1
    assert all(item["status"] == "Paid" for item in body["items"])


async def test_search_matches_tender_name(
    client, employee_headers, client_id, tender_name_id, uniq
):
    await _create_tender(client, employee_headers, client_id, tender_name_id)

    resp = await client.get(
        "/api/tenders", params={"search": f"Civil-Works-{uniq}"}, headers=employee_headers
    )

    body = resp.json()["data"]
    assert body["total_count"] == 1
    assert body["items"][0]["tender_name"]["name"] == f"Civil-Works-{uniq}"


async def test_summary_totals_by_status(client, employee_headers, client_id, tender_name_id):
    paid = await _create_tender(
        client, employee_headers, client_id, tender_name_id, quantity=2, price="1000.00"
    )
    await client.patch(
        f"/api/tenders/{paid.json()['data']['id']}",
        json={"status": "Paid"},
        headers=employee_headers,
    )
    await _create_tender(
        client, employee_headers, client_id, tender_name_id, quantity=3, price="500.00"
    )

    resp = await client.get(
        "/api/tenders/summary", params={"client_id": client_id}, headers=employee_headers
    )

    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["total_paid_value"] == "2000.00"
    assert data["total_pending_value"] == "1500.00"
    assert data["paid_count"] == 1
    assert data["pending_count"] == 1


async def test_summary_reports_zero_for_empty_filter(client, employee_headers, client_id):
    """A client with no tenders yet must report 0.00, not null."""
    resp = await client.get(
        "/api/tenders/summary", params={"client_id": client_id}, headers=employee_headers
    )

    data = resp.json()["data"]
    assert data["total_paid_value"] == "0.00"
    assert data["total_pending_value"] == "0.00"
    assert data["paid_count"] == 0
    assert data["pending_count"] == 0


async def test_summary_route_not_shadowed_by_id_route(client, employee_headers):
    """`/summary` must resolve as a literal path, not as a tender id."""
    resp = await client.get("/api/tenders/summary", headers=employee_headers)

    assert resp.status_code == 200
    assert "total_paid_value" in resp.json()["data"]


async def test_summary_requires_auth(client):
    resp = await client.get("/api/tenders/summary")

    assert resp.status_code == 401
    assert resp.json()["error"]["code"] == "UNAUTHENTICATED"


async def test_employee_cannot_update_others_tender(
    client, employee_headers, other_employee_headers, client_id, tender_name_id
):
    created = await _create_tender(client, employee_headers, client_id, tender_name_id)
    tender_id = created.json()["data"]["id"]

    resp = await client.patch(
        f"/api/tenders/{tender_id}", json={"status": "Paid"}, headers=other_employee_headers
    )

    assert resp.status_code == 403
    assert resp.json()["error"]["code"] == "FORBIDDEN"


async def test_admin_can_update_others_tender(
    client, employee_headers, admin_headers, client_id, tender_name_id
):
    created = await _create_tender(client, employee_headers, client_id, tender_name_id)
    tender_id = created.json()["data"]["id"]

    resp = await client.patch(
        f"/api/tenders/{tender_id}", json={"status": "Paid"}, headers=admin_headers
    )

    assert resp.status_code == 200
    assert resp.json()["data"]["status"] == "Paid"


async def test_employee_cannot_delete_others_tender(
    client, employee_headers, other_employee_headers, client_id, tender_name_id
):
    created = await _create_tender(client, employee_headers, client_id, tender_name_id)
    tender_id = created.json()["data"]["id"]

    resp = await client.delete(f"/api/tenders/{tender_id}", headers=other_employee_headers)

    assert resp.status_code == 403
    assert resp.json()["error"]["code"] == "FORBIDDEN"


async def test_delete_own_tender(client, employee_headers, client_id, tender_name_id):
    created = await _create_tender(client, employee_headers, client_id, tender_name_id)
    tender_id = created.json()["data"]["id"]

    resp = await client.delete(f"/api/tenders/{tender_id}", headers=employee_headers)

    assert resp.status_code == 200
    assert resp.json()["data"]["deleted"] is True

    follow_up = await client.get(f"/api/tenders/{tender_id}", headers=employee_headers)
    assert follow_up.status_code == 404


async def test_tender_name_in_use_cannot_be_deleted_via_deactivation_path(
    client, admin_headers, employee_headers, client_id, tender_name_id
):
    """Tender names are deactivated, never deleted, while referenced."""
    await _create_tender(client, employee_headers, client_id, tender_name_id)

    resp = await client.patch(
        f"/api/tender-names/{tender_name_id}", json={"is_active": False}, headers=admin_headers
    )

    assert resp.status_code == 200
    assert resp.json()["data"]["is_active"] is False
