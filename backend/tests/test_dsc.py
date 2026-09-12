"""DSC key tracking.

Framed as a shared office dashboard: every authenticated user can see and edit
every key, because the point is locating a client's key when whoever logged it
is unavailable (CH-19). Deletion is admin-only.

Two rules carry the weight. 'Key Lost' is retired and must not be writable
(CH-15), and issuing a key must record who took it (CH-17) into an append-only
history (CH-18).

Runs against a database holding committed demo data, so rows are uniquely
named and assertions check membership rather than absolute counts.
"""

import pytest

WRITABLE_STATUSES = ["Key Created", "Key Issued", "Key Returned"]

ISSUANCE = {"issued_to": "Rohan Mehta", "issued_phone": "9876543210"}


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


async def _create_key(client, headers, client_id, **overrides):
    payload = {"client_id": client_id, "storage_location_notes": "Drawer 3 / Box B", **overrides}
    return await client.post("/api/dsc", json=payload, headers=headers)


async def _history(client, headers, dsc_key_id):
    resp = await client.get(f"/api/dsc/{dsc_key_id}/history", headers=headers)
    return resp.json()["data"]


# --------------------------------------------------------------------------
# Creation
# --------------------------------------------------------------------------


async def test_create_dsc_key_happy_path(client, employee_headers, client_id, uniq):
    resp = await _create_key(client, employee_headers, client_id)

    assert resp.status_code == 201
    data = resp.json()["data"]
    assert data["client"]["company_name"] == f"Mehta Constructions {uniq}"
    assert data["client"]["contact_person_name"] == f"Rohan Mehta {uniq}"
    assert data["storage_location_notes"] == "Drawer 3 / Box B"
    assert data["created_by"]["full_name"] == "Test User"


async def test_key_status_defaults_to_key_created(client, employee_headers, client_id):
    resp = await _create_key(client, employee_headers, client_id)

    assert resp.json()["data"]["key_status"] == "Key Created"


async def test_create_dsc_key_requires_auth(client, client_id):
    resp = await client.post("/api/dsc", json={"client_id": client_id})

    assert resp.status_code == 401
    assert resp.json()["error"]["code"] == "UNAUTHENTICATED"


async def test_create_dsc_key_unknown_client(client, employee_headers):
    resp = await _create_key(client, employee_headers, "00000000-0000-0000-0000-000000000000")

    assert resp.status_code == 404
    assert resp.json()["error"]["code"] == "CLIENT_NOT_FOUND"


async def test_create_dsc_key_rejects_invalid_status(client, employee_headers, client_id):
    resp = await _create_key(client, employee_headers, client_id, key_status="Key Melted")

    assert resp.status_code == 422
    assert resp.json()["error"]["code"] == "VALIDATION_ERROR"


async def test_storage_notes_are_optional(client, employee_headers, client_id):
    resp = await _create_key(client, employee_headers, client_id, storage_location_notes=None)

    assert resp.status_code == 201
    assert resp.json()["data"]["storage_location_notes"] is None


@pytest.mark.parametrize("status", WRITABLE_STATUSES)
async def test_all_lifecycle_statuses_are_settable(client, employee_headers, client_id, status):
    created = await _create_key(client, employee_headers, client_id)
    dsc_key_id = created.json()["data"]["id"]
    extra = ISSUANCE if status == "Key Issued" else {}

    resp = await client.patch(
        f"/api/dsc/{dsc_key_id}",
        json={"key_status": status, **extra},
        headers=employee_headers,
    )

    assert resp.status_code == 200
    assert resp.json()["data"]["key_status"] == status


# --------------------------------------------------------------------------
# 'Key Lost' is retired (CH-15)
# --------------------------------------------------------------------------


async def test_key_lost_cannot_be_set_on_create(client, employee_headers, client_id):
    resp = await _create_key(client, employee_headers, client_id, key_status="Key Lost")

    assert resp.status_code == 422
    assert resp.json()["error"]["code"] == "VALIDATION_ERROR"


async def test_key_lost_cannot_be_set_on_update(client, employee_headers, client_id):
    created = await _create_key(client, employee_headers, client_id)
    dsc_key_id = created.json()["data"]["id"]

    resp = await client.patch(
        f"/api/dsc/{dsc_key_id}", json={"key_status": "Key Lost"}, headers=employee_headers
    )

    assert resp.status_code == 422
    assert resp.json()["error"]["code"] == "VALIDATION_ERROR"


async def test_key_lost_cannot_be_filtered_on(client, employee_headers):
    resp = await client.get("/api/dsc", params={"status": "Key Lost"}, headers=employee_headers)

    assert resp.status_code == 422


# --------------------------------------------------------------------------
# Issuance details (CH-17)
# --------------------------------------------------------------------------


async def test_issuing_requires_a_name(client, employee_headers, client_id):
    created = await _create_key(client, employee_headers, client_id)
    dsc_key_id = created.json()["data"]["id"]

    resp = await client.patch(
        f"/api/dsc/{dsc_key_id}",
        json={"key_status": "Key Issued", "issued_phone": "9876543210"},
        headers=employee_headers,
    )

    assert resp.status_code == 422
    assert resp.json()["error"]["code"] == "VALIDATION_ERROR"


async def test_issuing_requires_a_phone_number(client, employee_headers, client_id):
    created = await _create_key(client, employee_headers, client_id)
    dsc_key_id = created.json()["data"]["id"]

    resp = await client.patch(
        f"/api/dsc/{dsc_key_id}",
        json={"key_status": "Key Issued", "issued_to": "Rohan Mehta"},
        headers=employee_headers,
    )

    assert resp.status_code == 422
    assert resp.json()["error"]["code"] == "VALIDATION_ERROR"


async def test_issuing_rejects_a_malformed_phone_number(client, employee_headers, client_id):
    created = await _create_key(client, employee_headers, client_id)
    dsc_key_id = created.json()["data"]["id"]

    resp = await client.patch(
        f"/api/dsc/{dsc_key_id}",
        json={"key_status": "Key Issued", "issued_to": "Rohan", "issued_phone": "12345"},
        headers=employee_headers,
    )

    assert resp.status_code == 422
    assert resp.json()["error"]["code"] == "VALIDATION_ERROR"


async def test_returning_does_not_require_issuance_details(client, employee_headers, client_id):
    """Optional on return — the details are a nice-to-have there, not a control."""
    created = await _create_key(client, employee_headers, client_id)
    dsc_key_id = created.json()["data"]["id"]

    resp = await client.patch(
        f"/api/dsc/{dsc_key_id}", json={"key_status": "Key Returned"}, headers=employee_headers
    )

    assert resp.status_code == 200
    assert resp.json()["data"]["key_status"] == "Key Returned"


async def test_issuance_details_are_not_stored_on_the_key_row(client, employee_headers, client_id):
    """They describe the event, so they belong to the history, not the key."""
    created = await _create_key(client, employee_headers, client_id)
    dsc_key_id = created.json()["data"]["id"]

    resp = await client.patch(
        f"/api/dsc/{dsc_key_id}",
        json={"key_status": "Key Issued", **ISSUANCE},
        headers=employee_headers,
    )

    assert "issued_to" not in resp.json()["data"]


# --------------------------------------------------------------------------
# History (CH-18)
# --------------------------------------------------------------------------


async def test_a_new_key_starts_with_a_creation_event(client, employee_headers, client_id):
    created = await _create_key(client, employee_headers, client_id)
    dsc_key_id = created.json()["data"]["id"]

    events = await _history(client, employee_headers, dsc_key_id)

    assert len(events) == 1
    assert events[0]["event_type"] == "Created"
    assert events[0]["created_by"]["full_name"] == "Test User"


async def test_a_key_created_as_issued_records_both_events(client, employee_headers, client_id):
    created = await _create_key(
        client, employee_headers, client_id, key_status="Key Issued", **ISSUANCE
    )
    dsc_key_id = created.json()["data"]["id"]

    events = await _history(client, employee_headers, dsc_key_id)

    assert {e["event_type"] for e in events} == {"Created", "Issued"}


async def test_issuing_records_who_took_the_key(client, employee_headers, client_id):
    created = await _create_key(client, employee_headers, client_id)
    dsc_key_id = created.json()["data"]["id"]

    await client.patch(
        f"/api/dsc/{dsc_key_id}",
        json={"key_status": "Key Issued", **ISSUANCE},
        headers=employee_headers,
    )
    events = await _history(client, employee_headers, dsc_key_id)

    # Newest first.
    assert events[0]["event_type"] == "Issued"
    assert events[0]["issued_to"] == "Rohan Mehta"
    assert events[0]["issued_phone"] == "9876543210"


async def test_issue_then_return_builds_a_trail(client, employee_headers, client_id):
    created = await _create_key(client, employee_headers, client_id)
    dsc_key_id = created.json()["data"]["id"]

    await client.patch(
        f"/api/dsc/{dsc_key_id}",
        json={"key_status": "Key Issued", **ISSUANCE},
        headers=employee_headers,
    )
    await client.patch(
        f"/api/dsc/{dsc_key_id}", json={"key_status": "Key Returned"}, headers=employee_headers
    )

    events = await _history(client, employee_headers, dsc_key_id)
    assert [e["event_type"] for e in events] == ["Returned", "Issued", "Created"]


async def test_reissuing_to_a_different_person_records_a_new_event(
    client, employee_headers, client_id
):
    """The status does not change on a re-issue, but the holder does."""
    created = await _create_key(
        client, employee_headers, client_id, key_status="Key Issued", **ISSUANCE
    )
    dsc_key_id = created.json()["data"]["id"]

    await client.patch(
        f"/api/dsc/{dsc_key_id}",
        json={"key_status": "Key Issued", "issued_to": "Asha Patil", "issued_phone": "9812345678"},
        headers=employee_headers,
    )

    events = await _history(client, employee_headers, dsc_key_id)
    assert [e["event_type"] for e in events].count("Issued") == 2
    assert events[0]["issued_to"] == "Asha Patil"


async def test_editing_storage_notes_records_no_event(client, employee_headers, client_id):
    created = await _create_key(client, employee_headers, client_id)
    dsc_key_id = created.json()["data"]["id"]

    await client.patch(
        f"/api/dsc/{dsc_key_id}",
        json={"storage_location_notes": "Moved to Drawer 5"},
        headers=employee_headers,
    )

    events = await _history(client, employee_headers, dsc_key_id)
    assert len(events) == 1


async def test_history_requires_auth(client, employee_headers, client_id):
    created = await _create_key(client, employee_headers, client_id)
    dsc_key_id = created.json()["data"]["id"]

    resp = await client.get(f"/api/dsc/{dsc_key_id}/history")

    assert resp.status_code == 401
    assert resp.json()["error"]["code"] == "UNAUTHENTICATED"


async def test_history_of_unknown_key_is_not_found(client, employee_headers):
    """404, not an empty list — "no history" and "no key" are different answers."""
    resp = await client.get(
        "/api/dsc/00000000-0000-0000-0000-000000000000/history", headers=employee_headers
    )

    assert resp.status_code == 404
    assert resp.json()["error"]["code"] == "NOT_FOUND"


async def test_deleting_a_key_cascades_to_its_history(
    client, admin_headers, employee_headers, client_id
):
    created = await _create_key(client, employee_headers, client_id)
    dsc_key_id = created.json()["data"]["id"]

    await client.delete(f"/api/dsc/{dsc_key_id}", headers=admin_headers)

    resp = await client.get(f"/api/dsc/{dsc_key_id}/history", headers=admin_headers)
    assert resp.status_code == 404


# --------------------------------------------------------------------------
# Listing, search and permissions
# --------------------------------------------------------------------------


async def test_any_employee_can_see_anothers_key(
    client, employee_headers, other_employee_headers, client_id
):
    """Shared dashboard: locating a key must not depend on who logged it."""
    created = await _create_key(client, employee_headers, client_id)
    dsc_key_id = created.json()["data"]["id"]

    resp = await client.get(f"/api/dsc/{dsc_key_id}", headers=other_employee_headers)

    assert resp.status_code == 200
    assert resp.json()["data"]["storage_location_notes"] == "Drawer 3 / Box B"


async def test_filter_by_client(client, employee_headers, client_id):
    await _create_key(client, employee_headers, client_id)

    resp = await client.get("/api/dsc", params={"client_id": client_id}, headers=employee_headers)

    body = resp.json()["data"]
    assert body["total_count"] == 1
    assert body["items"][0]["client"]["id"] == client_id


async def test_filter_by_status(client, employee_headers, client_id):
    issued = await _create_key(client, employee_headers, client_id)
    await client.patch(
        f"/api/dsc/{issued.json()['data']['id']}",
        json={"key_status": "Key Issued", **ISSUANCE},
        headers=employee_headers,
    )
    await _create_key(client, employee_headers, client_id)

    resp = await client.get(
        "/api/dsc",
        params={"client_id": client_id, "status": "Key Issued"},
        headers=employee_headers,
    )

    body = resp.json()["data"]
    assert body["total_count"] == 1
    assert body["items"][0]["key_status"] == "Key Issued"


async def test_search_matches_storage_notes(client, employee_headers, client_id, uniq):
    """Finding a key by where it physically is, is the point of the module."""
    await _create_key(
        client, employee_headers, client_id, storage_location_notes=f"Drawer 7 / Box Z {uniq}"
    )

    resp = await client.get(
        "/api/dsc", params={"search": f"Drawer 7 / Box Z {uniq}"}, headers=employee_headers
    )

    body = resp.json()["data"]
    assert body["total_count"] == 1
    assert body["items"][0]["storage_location_notes"] == f"Drawer 7 / Box Z {uniq}"


async def test_search_matches_company_name(client, employee_headers, client_id, uniq):
    await _create_key(client, employee_headers, client_id)

    resp = await client.get(
        "/api/dsc", params={"search": f"Mehta Constructions {uniq}"}, headers=employee_headers
    )

    assert resp.json()["data"]["total_count"] == 1


async def test_search_matches_contact_person_name(client, employee_headers, client_id, uniq):
    await _create_key(client, employee_headers, client_id)

    resp = await client.get(
        "/api/dsc", params={"search": f"Rohan Mehta {uniq}"}, headers=employee_headers
    )

    assert resp.json()["data"]["total_count"] == 1


async def test_update_storage_notes(client, employee_headers, client_id):
    created = await _create_key(client, employee_headers, client_id)
    dsc_key_id = created.json()["data"]["id"]

    resp = await client.patch(
        f"/api/dsc/{dsc_key_id}",
        json={"storage_location_notes": "Moved to Drawer 5 / Box A"},
        headers=employee_headers,
    )

    assert resp.status_code == 200
    assert resp.json()["data"]["storage_location_notes"] == "Moved to Drawer 5 / Box A"


async def test_any_employee_can_update_any_key(
    client, employee_headers, other_employee_headers, client_id
):
    created = await _create_key(client, employee_headers, client_id)
    dsc_key_id = created.json()["data"]["id"]

    resp = await client.patch(
        f"/api/dsc/{dsc_key_id}",
        json={"key_status": "Key Returned"},
        headers=other_employee_headers,
    )

    assert resp.status_code == 200
    assert resp.json()["data"]["created_by"]["full_name"] == "Other Employee"


async def test_admin_can_update_any_key(client, employee_headers, admin_headers, client_id):
    created = await _create_key(client, employee_headers, client_id)
    dsc_key_id = created.json()["data"]["id"]

    resp = await client.patch(
        f"/api/dsc/{dsc_key_id}", json={"key_status": "Key Returned"}, headers=admin_headers
    )

    assert resp.status_code == 200
    assert resp.json()["data"]["key_status"] == "Key Returned"


async def test_employee_cannot_delete_a_key(client, employee_headers, client_id):
    created = await _create_key(client, employee_headers, client_id)
    dsc_key_id = created.json()["data"]["id"]

    resp = await client.delete(f"/api/dsc/{dsc_key_id}", headers=employee_headers)

    assert resp.status_code == 403
    assert resp.json()["error"]["code"] == "FORBIDDEN"


async def test_admin_can_delete_a_key(client, admin_headers, employee_headers, client_id):
    created = await _create_key(client, employee_headers, client_id)
    dsc_key_id = created.json()["data"]["id"]

    resp = await client.delete(f"/api/dsc/{dsc_key_id}", headers=admin_headers)

    assert resp.status_code == 200
    assert resp.json()["data"]["deleted"] is True

    follow_up = await client.get(f"/api/dsc/{dsc_key_id}", headers=admin_headers)
    assert follow_up.status_code == 404


async def test_get_dsc_key_not_found(client, employee_headers):
    resp = await client.get(
        "/api/dsc/00000000-0000-0000-0000-000000000000", headers=employee_headers
    )

    assert resp.status_code == 404
    assert resp.json()["error"]["code"] == "NOT_FOUND"


async def test_deleting_client_cascades_to_dsc_keys(
    client, admin_headers, employee_headers, client_id
):
    created = await _create_key(client, employee_headers, client_id)
    dsc_key_id = created.json()["data"]["id"]

    await client.delete(f"/api/clients/{client_id}", headers=admin_headers)

    resp = await client.get(f"/api/dsc/{dsc_key_id}", headers=admin_headers)
    assert resp.status_code == 404
