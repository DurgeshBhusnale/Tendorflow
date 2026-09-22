"""Earnest money deposits (CH-30).

Money held on a client's behalf, so the question every row answers is whether
it is still with us. Open-edit like tenders: any signed-in user logs and amends
them, only admins delete.

Runs against a database holding committed demo data, so rows are uniquely
described and assertions check membership rather than absolute counts.
"""

from datetime import timedelta

import pytest

from app.core.dates import today_ist


@pytest.fixture
async def client_id(client, employee_headers, uniq) -> str:
    resp = await client.post(
        "/api/clients",
        json={
            "contact_person_name": f"Rohan Mehta {uniq}",
            "company_name": f"Mehta Constructions {uniq}",
            "contact_number": "9876543210",
            "email": f"rohan-{uniq}@mehtaconstructions.com",
        },
        headers=employee_headers,
    )
    return resp.json()["data"]["id"]


async def _create_emd(client, headers, client_id, **overrides):
    payload = {
        "client_id": client_id,
        "contact_number": "9876543210",
        "amount": "5000.00",
        **overrides,
    }
    return await client.post("/api/emds", json=payload, headers=headers)


# --------------------------------------------------------------------------
# Creation
# --------------------------------------------------------------------------


async def test_create_emd_happy_path(client, employee_headers, client_id, uniq):
    resp = await _create_emd(client, employee_headers, client_id)

    assert resp.status_code == 201
    data = resp.json()["data"]
    assert data["client"]["contact_person_name"] == f"Rohan Mehta {uniq}"
    assert data["client"]["company_name"] == f"Mehta Constructions {uniq}"
    assert data["contact_number"] == "9876543210"
    assert data["amount"] == "5000.00"
    assert data["status"] == "With Us"
    assert data["emd_date"] == today_ist().isoformat()
    assert data["created_by"]["full_name"] == "Test User"


async def test_status_defaults_to_with_us(client, employee_headers, client_id):
    """A deposit starts out held — that is why it is being logged."""
    resp = await _create_emd(client, employee_headers, client_id)

    assert resp.json()["data"]["status"] == "With Us"


async def test_contact_number_is_normalized(client, employee_headers, client_id):
    """Same Indian-mobile rule as every other phone field (CH-17)."""
    resp = await _create_emd(client, employee_headers, client_id, contact_number="+91 98765-43210")

    assert resp.status_code == 201
    assert resp.json()["data"]["contact_number"] == "9876543210"


async def test_contact_number_may_differ_from_the_client(client, employee_headers, client_id):
    """Whoever hands the money over is not always the standing contact."""
    resp = await _create_emd(client, employee_headers, client_id, contact_number="9123456780")

    assert resp.json()["data"]["contact_number"] == "9123456780"


async def test_emd_can_be_backdated(client, employee_headers, client_id):
    taken_on = (today_ist() - timedelta(days=7)).isoformat()

    resp = await _create_emd(client, employee_headers, client_id, emd_date=taken_on)

    assert resp.json()["data"]["emd_date"] == taken_on


async def test_money_is_serialized_as_exact_string(client, employee_headers, client_id):
    resp = await _create_emd(client, employee_headers, client_id, amount="5000")

    assert resp.json()["data"]["amount"] == "5000.00"


# --------------------------------------------------------------------------
# Validation and auth
# --------------------------------------------------------------------------


async def test_create_emd_requires_auth(client, client_id):
    resp = await client.post(
        "/api/emds",
        json={"client_id": client_id, "contact_number": "9876543210", "amount": "1.00"},
    )

    assert resp.status_code == 401
    assert resp.json()["error"]["code"] == "UNAUTHENTICATED"


async def test_create_emd_unknown_client(client, employee_headers):
    resp = await _create_emd(client, employee_headers, "00000000-0000-0000-0000-000000000000")

    assert resp.status_code == 404
    assert resp.json()["error"]["code"] == "CLIENT_NOT_FOUND"


async def test_create_emd_rejects_a_landline(client, employee_headers, client_id):
    resp = await _create_emd(client, employee_headers, client_id, contact_number="2212345678")

    assert resp.status_code == 422
    assert resp.json()["error"]["code"] == "VALIDATION_ERROR"


async def test_create_emd_rejects_a_negative_amount(client, employee_headers, client_id):
    resp = await _create_emd(client, employee_headers, client_id, amount="-1.00")

    assert resp.status_code == 422
    assert resp.json()["error"]["code"] == "VALIDATION_ERROR"


async def test_create_emd_rejects_an_unknown_status(client, employee_headers, client_id):
    resp = await _create_emd(client, employee_headers, client_id, status="Refunded")

    assert resp.status_code == 422
    assert resp.json()["error"]["code"] == "VALIDATION_ERROR"


async def test_summary_route_not_shadowed_by_the_id_route(client, employee_headers):
    """`/summary` must resolve as a literal path, not as an EMD id."""
    resp = await client.get("/api/emds/summary", headers=employee_headers)

    assert resp.status_code == 200
    assert "total_with_us" in resp.json()["data"]


# --------------------------------------------------------------------------
# Filtering and the KPI strip
# --------------------------------------------------------------------------


async def test_filter_by_status(client, employee_headers, client_id):
    await _create_emd(client, employee_headers, client_id, amount="1000.00")
    await _create_emd(client, employee_headers, client_id, amount="2000.00", status="Returned")

    resp = await client.get(
        "/api/emds",
        params={"client_id": client_id, "status": "Returned"},
        headers=employee_headers,
    )

    items = resp.json()["data"]["items"]
    assert [i["amount"] for i in items] == ["2000.00"]


async def test_search_matches_client_and_number(client, employee_headers, client_id, uniq):
    await _create_emd(client, employee_headers, client_id, contact_number="9123456780")

    by_company = await client.get(
        "/api/emds", params={"search": f"Mehta Constructions {uniq}"}, headers=employee_headers
    )
    by_number = await client.get(
        "/api/emds",
        params={"client_id": client_id, "search": "9123456780"},
        headers=employee_headers,
    )

    assert by_company.json()["data"]["total_count"] == 1
    assert by_number.json()["data"]["total_count"] == 1


async def test_date_filter_uses_the_emd_date(client, employee_headers, client_id):
    taken_on = (today_ist() - timedelta(days=7)).isoformat()
    today = today_ist().isoformat()
    await _create_emd(client, employee_headers, client_id, emd_date=taken_on)

    on_its_date = await client.get(
        "/api/emds",
        params={"client_id": client_id, "start_date": taken_on, "end_date": taken_on},
        headers=employee_headers,
    )
    on_entry_day = await client.get(
        "/api/emds",
        params={"client_id": client_id, "start_date": today, "end_date": today},
        headers=employee_headers,
    )

    assert on_its_date.json()["data"]["total_count"] == 1
    assert on_entry_day.json()["data"]["total_count"] == 0


async def test_summary_splits_held_from_returned(client, employee_headers, client_id):
    """The figure the page leads with is what is still owed back."""
    await _create_emd(client, employee_headers, client_id, amount="5000.00")
    await _create_emd(client, employee_headers, client_id, amount="1500.00")
    await _create_emd(client, employee_headers, client_id, amount="2000.00", status="Returned")

    resp = await client.get(
        "/api/emds/summary", params={"client_id": client_id}, headers=employee_headers
    )

    data = resp.json()["data"]
    assert data["total_with_us"] == "6500.00"
    assert data["total_returned"] == "2000.00"
    assert data["with_us_count"] == 2
    assert data["returned_count"] == 1


async def test_summary_reports_zero_for_an_empty_filter(client, employee_headers, client_id):
    resp = await client.get(
        "/api/emds/summary", params={"client_id": client_id}, headers=employee_headers
    )

    data = resp.json()["data"]
    assert data["total_with_us"] == "0.00"
    assert data["with_us_count"] == 0


async def test_employee_can_read_the_summary(client, employee_headers, client_id):
    """Unlike the tender summary, this is not admin-only (CH-30)."""
    resp = await client.get("/api/emds/summary", headers=employee_headers)

    assert resp.status_code == 200


# --------------------------------------------------------------------------
# Update, delete and permissions
# --------------------------------------------------------------------------


async def test_returning_a_deposit(client, employee_headers, client_id):
    """The lifecycle this module exists for: held, then handed back."""
    created = await _create_emd(client, employee_headers, client_id)

    resp = await client.patch(
        f"/api/emds/{created.json()['data']['id']}",
        json={"status": "Returned"},
        headers=employee_headers,
    )

    assert resp.status_code == 200
    assert resp.json()["data"]["status"] == "Returned"


async def test_any_employee_can_update_any_emd(
    client, employee_headers, other_employee_headers, client_id
):
    created = await _create_emd(client, employee_headers, client_id)

    resp = await client.patch(
        f"/api/emds/{created.json()['data']['id']}",
        json={"status": "Returned"},
        headers=other_employee_headers,
    )

    assert resp.status_code == 200
    assert resp.json()["data"]["created_by"]["full_name"] == "Other Employee"


async def test_update_unknown_emd(client, employee_headers):
    resp = await client.patch(
        "/api/emds/00000000-0000-0000-0000-000000000000",
        json={"status": "Returned"},
        headers=employee_headers,
    )

    assert resp.status_code == 404
    assert resp.json()["error"]["code"] == "NOT_FOUND"


async def test_employee_cannot_delete_an_emd(client, employee_headers, client_id):
    created = await _create_emd(client, employee_headers, client_id)

    resp = await client.delete(
        f"/api/emds/{created.json()['data']['id']}", headers=employee_headers
    )

    assert resp.status_code == 403
    assert resp.json()["error"]["code"] == "FORBIDDEN"


async def test_admin_can_delete_an_emd(client, admin_headers, employee_headers, client_id):
    created = await _create_emd(client, employee_headers, client_id)
    emd_id = created.json()["data"]["id"]

    resp = await client.delete(f"/api/emds/{emd_id}", headers=admin_headers)

    assert resp.status_code == 200
    follow_up = await client.get(f"/api/emds/{emd_id}", headers=admin_headers)
    assert follow_up.status_code == 404


async def test_deleting_a_client_removes_their_emds(
    client, admin_headers, employee_headers, client_id
):
    """emds.client_id is ON DELETE CASCADE, like every other client-owned row."""
    created = await _create_emd(client, employee_headers, client_id)
    emd_id = created.json()["data"]["id"]

    await client.delete(f"/api/clients/{client_id}", headers=admin_headers)

    resp = await client.get(f"/api/emds/{emd_id}", headers=admin_headers)
    assert resp.status_code == 404
