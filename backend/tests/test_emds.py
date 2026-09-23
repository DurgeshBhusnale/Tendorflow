"""Earnest money deposits (CH-30, CH-33, CH-34).

Money held on behalf of a client, so the question every row answers is whether
it is still with us. Open-edit like tenders: any signed-in user logs and amends
them, only admins delete.

Since CH-33 the client details are typed in rather than linked to a client
record, so these tests need no client fixture — that independence is the point
of the change.

Runs against a database holding committed demo data, so rows are uniquely
described and assertions check membership rather than absolute counts.
"""

from datetime import timedelta

from app.core.dates import today_ist


async def _create_emd(client, headers, uniq, **overrides):
    payload = {
        "client_name": f"Rohan Mehta {uniq}",
        "company_name": f"Mehta Constructions {uniq}",
        "contact_number": "9876543210",
        "amount": "5000.00",
        **overrides,
    }
    return await client.post("/api/emds", json=payload, headers=headers)


# --------------------------------------------------------------------------
# Creation
# --------------------------------------------------------------------------


async def test_create_emd_happy_path(client, employee_headers, uniq):
    resp = await _create_emd(client, employee_headers, uniq)

    assert resp.status_code == 201
    data = resp.json()["data"]
    assert data["client_name"] == f"Rohan Mehta {uniq}"
    assert data["company_name"] == f"Mehta Constructions {uniq}"
    assert data["contact_number"] == "9876543210"
    assert data["amount"] == "5000.00"
    assert data["status"] == "With Us"
    assert data["paid_to_bank_account"] is None
    assert data["emd_date"] == today_ist().isoformat()
    assert data["created_by"]["full_name"] == "Test User"


async def test_no_client_record_is_required(client, employee_headers, uniq):
    """The whole point of CH-33: log a deposit for someone not yet on file."""
    resp = await _create_emd(
        client, employee_headers, uniq, client_name="Walk-in Stranger", company_name="Nobody Ltd"
    )

    assert resp.status_code == 201
    assert resp.json()["data"]["client_name"] == "Walk-in Stranger"


async def test_paid_to_bank_account_is_recorded(client, employee_headers, uniq):
    account = "HDFC Bank, Pune Camp\nA/C 50100123456\nIFSC HDFC0000123"

    resp = await _create_emd(client, employee_headers, uniq, paid_to_bank_account=account)

    assert resp.status_code == 201
    assert resp.json()["data"]["paid_to_bank_account"] == account


async def test_blank_bank_account_is_stored_as_none(client, employee_headers, uniq):
    resp = await _create_emd(client, employee_headers, uniq, paid_to_bank_account="   ")

    assert resp.json()["data"]["paid_to_bank_account"] is None


async def test_status_defaults_to_with_us(client, employee_headers, uniq):
    """A deposit starts out held — that is why it is being logged."""
    resp = await _create_emd(client, employee_headers, uniq)

    assert resp.json()["data"]["status"] == "With Us"


async def test_contact_number_is_normalized(client, employee_headers, uniq):
    """Same Indian-mobile rule as every other phone field (CH-17)."""
    resp = await _create_emd(client, employee_headers, uniq, contact_number="+91 98765-43210")

    assert resp.json()["data"]["contact_number"] == "9876543210"


async def test_emd_can_be_backdated(client, employee_headers, uniq):
    taken_on = (today_ist() - timedelta(days=7)).isoformat()

    resp = await _create_emd(client, employee_headers, uniq, emd_date=taken_on)

    assert resp.json()["data"]["emd_date"] == taken_on


async def test_money_is_serialized_as_exact_string(client, employee_headers, uniq):
    resp = await _create_emd(client, employee_headers, uniq, amount="5000")

    assert resp.json()["data"]["amount"] == "5000.00"


# --------------------------------------------------------------------------
# Validation and auth
# --------------------------------------------------------------------------


async def test_create_emd_requires_auth(client):
    resp = await client.post(
        "/api/emds",
        json={
            "client_name": "A",
            "company_name": "B",
            "contact_number": "9876543210",
            "amount": "1.00",
        },
    )

    assert resp.status_code == 401
    assert resp.json()["error"]["code"] == "UNAUTHENTICATED"


async def test_create_emd_requires_a_client_name(client, employee_headers, uniq):
    resp = await _create_emd(client, employee_headers, uniq, client_name="")

    assert resp.status_code == 422
    assert resp.json()["error"]["code"] == "VALIDATION_ERROR"


async def test_create_emd_requires_a_company_name(client, employee_headers, uniq):
    resp = await _create_emd(client, employee_headers, uniq, company_name="")

    assert resp.status_code == 422
    assert resp.json()["error"]["code"] == "VALIDATION_ERROR"


async def test_create_emd_rejects_a_landline(client, employee_headers, uniq):
    resp = await _create_emd(client, employee_headers, uniq, contact_number="2212345678")

    assert resp.status_code == 422
    assert resp.json()["error"]["code"] == "VALIDATION_ERROR"


async def test_create_emd_rejects_a_negative_amount(client, employee_headers, uniq):
    resp = await _create_emd(client, employee_headers, uniq, amount="-1.00")

    assert resp.status_code == 422
    assert resp.json()["error"]["code"] == "VALIDATION_ERROR"


async def test_create_emd_rejects_an_unknown_status(client, employee_headers, uniq):
    resp = await _create_emd(client, employee_headers, uniq, status="Refunded")

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


async def test_filter_by_status(client, employee_headers, uniq):
    await _create_emd(client, employee_headers, uniq, amount="1000.00")
    await _create_emd(client, employee_headers, uniq, amount="2000.00", status="Returned")

    resp = await client.get(
        "/api/emds", params={"search": uniq, "status": "Returned"}, headers=employee_headers
    )

    assert [i["amount"] for i in resp.json()["data"]["items"]] == ["2000.00"]


async def test_search_matches_name_company_and_number(client, employee_headers, uniq):
    await _create_emd(client, employee_headers, uniq, contact_number="9123456780")

    by_company = await client.get(
        "/api/emds", params={"search": f"Mehta Constructions {uniq}"}, headers=employee_headers
    )
    by_person = await client.get(
        "/api/emds", params={"search": f"Rohan Mehta {uniq}"}, headers=employee_headers
    )
    by_number = await client.get(
        "/api/emds", params={"search": "9123456780"}, headers=employee_headers
    )

    assert by_company.json()["data"]["total_count"] == 1
    assert by_person.json()["data"]["total_count"] == 1
    assert by_number.json()["data"]["total_count"] >= 1


async def test_date_filter_uses_the_emd_date(client, employee_headers, uniq):
    taken_on = (today_ist() - timedelta(days=7)).isoformat()
    today = today_ist().isoformat()
    await _create_emd(client, employee_headers, uniq, emd_date=taken_on)

    on_its_date = await client.get(
        "/api/emds",
        params={"search": uniq, "start_date": taken_on, "end_date": taken_on},
        headers=employee_headers,
    )
    on_entry_day = await client.get(
        "/api/emds",
        params={"search": uniq, "start_date": today, "end_date": today},
        headers=employee_headers,
    )

    assert on_its_date.json()["data"]["total_count"] == 1
    assert on_entry_day.json()["data"]["total_count"] == 0


async def test_summary_splits_held_from_returned(client, employee_headers, uniq):
    """The figure the page leads with is what is still owed back."""
    await _create_emd(client, employee_headers, uniq, amount="5000.00")
    await _create_emd(client, employee_headers, uniq, amount="1500.00")
    await _create_emd(client, employee_headers, uniq, amount="2000.00", status="Returned")

    resp = await client.get("/api/emds/summary", params={"search": uniq}, headers=employee_headers)

    data = resp.json()["data"]
    assert data["total_with_us"] == "6500.00"
    assert data["total_returned"] == "2000.00"
    assert data["with_us_count"] == 2
    assert data["returned_count"] == 1


async def test_summary_reports_zero_for_an_empty_filter(client, employee_headers, uniq):
    resp = await client.get(
        "/api/emds/summary", params={"search": f"nothing-matches-{uniq}"}, headers=employee_headers
    )

    assert resp.json()["data"]["total_with_us"] == "0.00"
    assert resp.json()["data"]["with_us_count"] == 0


async def test_employee_can_read_the_summary(client, employee_headers):
    """Unlike the tender summary, this is not admin-only (CH-30)."""
    resp = await client.get("/api/emds/summary", headers=employee_headers)

    assert resp.status_code == 200


# --------------------------------------------------------------------------
# Update, delete and permissions
# --------------------------------------------------------------------------


async def test_returning_a_deposit(client, employee_headers, uniq):
    """The lifecycle this module exists for: held, then handed back."""
    created = await _create_emd(client, employee_headers, uniq)

    resp = await client.patch(
        f"/api/emds/{created.json()['data']['id']}",
        json={"status": "Returned"},
        headers=employee_headers,
    )

    assert resp.status_code == 200
    assert resp.json()["data"]["status"] == "Returned"


async def test_client_details_can_be_corrected(client, employee_headers, uniq):
    """Typed text, so fixing a misspelled company is just an edit (CH-33)."""
    created = await _create_emd(client, employee_headers, uniq)

    resp = await client.patch(
        f"/api/emds/{created.json()['data']['id']}",
        json={"company_name": f"Mehta Constructions Pvt Ltd {uniq}"},
        headers=employee_headers,
    )

    assert resp.json()["data"]["company_name"] == f"Mehta Constructions Pvt Ltd {uniq}"


async def test_any_employee_can_update_any_emd(
    client, employee_headers, other_employee_headers, uniq
):
    created = await _create_emd(client, employee_headers, uniq)

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


async def test_employee_cannot_delete_an_emd(client, employee_headers, uniq):
    created = await _create_emd(client, employee_headers, uniq)

    resp = await client.delete(
        f"/api/emds/{created.json()['data']['id']}", headers=employee_headers
    )

    assert resp.status_code == 403
    assert resp.json()["error"]["code"] == "FORBIDDEN"


async def test_admin_can_delete_an_emd(client, admin_headers, employee_headers, uniq):
    created = await _create_emd(client, employee_headers, uniq)
    emd_id = created.json()["data"]["id"]

    resp = await client.delete(f"/api/emds/{emd_id}", headers=admin_headers)

    assert resp.status_code == 200
    follow_up = await client.get(f"/api/emds/{emd_id}", headers=admin_headers)
    assert follow_up.status_code == 404


# --------------------------------------------------------------------------
# Bulk delete (CH-34)
# --------------------------------------------------------------------------


async def test_bulk_delete_removes_every_selected_deposit(
    client, admin_headers, employee_headers, uniq
):
    ids = []
    for _ in range(3):
        created = await _create_emd(client, employee_headers, uniq)
        ids.append(created.json()["data"]["id"])

    resp = await client.post("/api/emds/bulk-delete", json={"ids": ids}, headers=admin_headers)

    assert resp.status_code == 200
    assert resp.json()["data"] == {"deleted": 3, "requested": 3}
    remaining = await client.get("/api/emds", params={"search": uniq}, headers=admin_headers)
    assert remaining.json()["data"]["total_count"] == 0


async def test_bulk_delete_leaves_unselected_deposits_alone(
    client, admin_headers, employee_headers, uniq
):
    doomed = await _create_emd(client, employee_headers, uniq)
    survivor = await _create_emd(client, employee_headers, uniq)

    resp = await client.post(
        "/api/emds/bulk-delete",
        json={"ids": [doomed.json()["data"]["id"]]},
        headers=admin_headers,
    )

    assert resp.json()["data"]["deleted"] == 1
    still_there = await client.get(
        f"/api/emds/{survivor.json()['data']['id']}", headers=admin_headers
    )
    assert still_there.status_code == 200


async def test_bulk_delete_requires_admin(client, employee_headers, uniq):
    created = await _create_emd(client, employee_headers, uniq)

    resp = await client.post(
        "/api/emds/bulk-delete",
        json={"ids": [created.json()["data"]["id"]]},
        headers=employee_headers,
    )

    assert resp.status_code == 403
    assert resp.json()["error"]["code"] == "FORBIDDEN"


async def test_bulk_delete_rejects_an_empty_list(client, admin_headers):
    resp = await client.post("/api/emds/bulk-delete", json={"ids": []}, headers=admin_headers)

    assert resp.status_code == 422
    assert resp.json()["error"]["code"] == "VALIDATION_ERROR"


async def test_bulk_delete_is_capped(client, admin_headers):
    ids = ["00000000-0000-0000-0000-000000000000"] * 101

    resp = await client.post("/api/emds/bulk-delete", json={"ids": ids}, headers=admin_headers)

    assert resp.status_code == 422
    assert resp.json()["error"]["code"] == "VALIDATION_ERROR"


async def test_bulk_delete_tolerates_an_already_deleted_id(
    client, admin_headers, employee_headers, uniq
):
    created = await _create_emd(client, employee_headers, uniq)
    emd_id = created.json()["data"]["id"]
    await client.delete(f"/api/emds/{emd_id}", headers=admin_headers)

    resp = await client.post("/api/emds/bulk-delete", json={"ids": [emd_id]}, headers=admin_headers)

    assert resp.status_code == 200
    assert resp.json()["data"] == {"deleted": 0, "requested": 1}
