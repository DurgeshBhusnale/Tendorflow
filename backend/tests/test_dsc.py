"""DSC key tracking.

Framed as a shared office dashboard: every authenticated user can see every
key, because the point is locating a client's key when whoever logged it is
unavailable. Ownership still gates writes.

Runs against a database holding committed demo data, so rows are uniquely
named and assertions check membership rather than absolute counts.
"""

import pytest

ALL_STATUSES = ["Key Created", "Key Issued", "Key Returned", "Key Lost"]


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


async def _create_key(client, headers, client_id, **overrides):
    payload = {"client_id": client_id, "storage_location_notes": "Drawer 3 / Box B", **overrides}
    return await client.post("/api/dsc", json=payload, headers=headers)


async def test_create_dsc_key_happy_path(client, employee_headers, client_id, uniq):
    resp = await _create_key(client, employee_headers, client_id)

    assert resp.status_code == 201
    data = resp.json()["data"]
    assert data["client"]["company_name"] == f"Mehta Constructions {uniq}"
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


@pytest.mark.parametrize("status", ALL_STATUSES)
async def test_all_lifecycle_statuses_are_settable(client, employee_headers, client_id, status):
    created = await _create_key(client, employee_headers, client_id)
    dsc_key_id = created.json()["data"]["id"]

    resp = await client.patch(
        f"/api/dsc/{dsc_key_id}", json={"key_status": status}, headers=employee_headers
    )

    assert resp.status_code == 200
    assert resp.json()["data"]["key_status"] == status


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
        json={"key_status": "Key Issued"},
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


async def test_employee_cannot_update_others_key(
    client, employee_headers, other_employee_headers, client_id
):
    created = await _create_key(client, employee_headers, client_id)
    dsc_key_id = created.json()["data"]["id"]

    resp = await client.patch(
        f"/api/dsc/{dsc_key_id}",
        json={"key_status": "Key Lost"},
        headers=other_employee_headers,
    )

    assert resp.status_code == 403
    assert resp.json()["error"]["code"] == "FORBIDDEN"


async def test_admin_can_update_others_key(client, employee_headers, admin_headers, client_id):
    created = await _create_key(client, employee_headers, client_id)
    dsc_key_id = created.json()["data"]["id"]

    resp = await client.patch(
        f"/api/dsc/{dsc_key_id}", json={"key_status": "Key Returned"}, headers=admin_headers
    )

    assert resp.status_code == 200
    assert resp.json()["data"]["key_status"] == "Key Returned"


async def test_employee_cannot_delete_others_key(
    client, employee_headers, other_employee_headers, client_id
):
    created = await _create_key(client, employee_headers, client_id)
    dsc_key_id = created.json()["data"]["id"]

    resp = await client.delete(f"/api/dsc/{dsc_key_id}", headers=other_employee_headers)

    assert resp.status_code == 403
    assert resp.json()["error"]["code"] == "FORBIDDEN"


async def test_delete_own_key(client, employee_headers, client_id):
    created = await _create_key(client, employee_headers, client_id)
    dsc_key_id = created.json()["data"]["id"]

    resp = await client.delete(f"/api/dsc/{dsc_key_id}", headers=employee_headers)

    assert resp.status_code == 200
    assert resp.json()["data"]["deleted"] is True

    follow_up = await client.get(f"/api/dsc/{dsc_key_id}", headers=employee_headers)
    assert follow_up.status_code == 404


async def test_get_dsc_key_not_found(client, employee_headers):
    resp = await client.get(
        "/api/dsc/00000000-0000-0000-0000-000000000000", headers=employee_headers
    )

    assert resp.status_code == 404
    assert resp.json()["error"]["code"] == "NOT_FOUND"


async def test_deleting_client_cascades_to_dsc_keys(client, employee_headers, client_id):
    created = await _create_key(client, employee_headers, client_id)
    dsc_key_id = created.json()["data"]["id"]

    await client.delete(f"/api/clients/{client_id}", headers=employee_headers)

    resp = await client.get(f"/api/dsc/{dsc_key_id}", headers=employee_headers)
    assert resp.status_code == 404
