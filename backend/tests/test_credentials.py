"""Credentials vault.

Password visibility is the interesting part here: the list endpoint must never
return a real password, and the single-row endpoint must return it only when
explicitly asked. Both are asserted below.

Runs against a database holding committed demo data, so rows are uniquely
named and assertions check membership rather than absolute counts.
"""

import pytest

MASKED = "•" * 6
REAL_PASSWORD = "portalPassword123"


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
async def portal_id(client, admin_headers, uniq) -> str:
    resp = await client.post(
        "/api/portals", json={"name": f"GeM Portal {uniq}"}, headers=admin_headers
    )
    return resp.json()["data"]["id"]


async def _create_credential(client, headers, client_id, portal_id, **overrides):
    payload = {
        "client_id": client_id,
        "portal_id": portal_id,
        "login_identifier": "rohan.mehta",
        "password": REAL_PASSWORD,
        **overrides,
    }
    return await client.post("/api/credentials", json=payload, headers=headers)


async def test_create_credential_happy_path(client, employee_headers, client_id, portal_id, uniq):
    resp = await _create_credential(client, employee_headers, client_id, portal_id)

    assert resp.status_code == 201
    data = resp.json()["data"]
    assert data["client"]["company_name"] == f"Mehta Constructions {uniq}"
    assert data["portal"]["name"] == f"GeM Portal {uniq}"
    assert data["login_identifier"] == "rohan.mehta"
    assert data["created_by"]["full_name"] == "Test User"
    # even on create, the password comes back masked
    assert data["password"] == MASKED


async def test_create_credential_requires_auth(client, client_id, portal_id):
    resp = await client.post(
        "/api/credentials",
        json={"client_id": client_id, "portal_id": portal_id, "password": REAL_PASSWORD},
    )

    assert resp.status_code == 401
    assert resp.json()["error"]["code"] == "UNAUTHENTICATED"


async def test_create_credential_validation_error(client, employee_headers, client_id, portal_id):
    resp = await _create_credential(client, employee_headers, client_id, portal_id, password="")

    assert resp.status_code == 422
    assert resp.json()["error"]["code"] == "VALIDATION_ERROR"


async def test_create_credential_unknown_client(client, employee_headers, portal_id):
    resp = await _create_credential(
        client, employee_headers, "00000000-0000-0000-0000-000000000000", portal_id
    )

    assert resp.status_code == 404
    assert resp.json()["error"]["code"] == "CLIENT_NOT_FOUND"


async def test_create_credential_unknown_portal(client, employee_headers, client_id):
    resp = await _create_credential(
        client, employee_headers, client_id, "00000000-0000-0000-0000-000000000000"
    )

    assert resp.status_code == 404
    assert resp.json()["error"]["code"] == "PORTAL_NOT_FOUND"


async def test_login_identifier_is_optional(client, employee_headers, client_id, portal_id):
    resp = await _create_credential(
        client, employee_headers, client_id, portal_id, login_identifier=None
    )

    assert resp.status_code == 201
    assert resp.json()["data"]["login_identifier"] is None


async def test_list_never_reveals_password(client, employee_headers, client_id, portal_id):
    await _create_credential(client, employee_headers, client_id, portal_id)

    resp = await client.get(
        "/api/credentials", params={"client_id": client_id}, headers=employee_headers
    )

    assert resp.status_code == 200
    items = resp.json()["data"]["items"]
    assert items
    assert all(item["password"] == MASKED for item in items)


async def test_list_ignores_reveal_query_param(client, employee_headers, client_id, portal_id):
    """`reveal` is not a list-level parameter — passing it must not unmask anything."""
    await _create_credential(client, employee_headers, client_id, portal_id)

    resp = await client.get(
        "/api/credentials",
        params={"client_id": client_id, "reveal": "true"},
        headers=employee_headers,
    )

    assert resp.status_code == 200
    items = resp.json()["data"]["items"]
    assert items
    assert all(item["password"] == MASKED for item in items)


async def test_get_one_masks_by_default(client, employee_headers, client_id, portal_id):
    created = await _create_credential(client, employee_headers, client_id, portal_id)
    credential_id = created.json()["data"]["id"]

    resp = await client.get(f"/api/credentials/{credential_id}", headers=employee_headers)

    assert resp.status_code == 200
    assert resp.json()["data"]["password"] == MASKED


async def test_get_one_reveals_when_asked(client, employee_headers, client_id, portal_id):
    created = await _create_credential(client, employee_headers, client_id, portal_id)
    credential_id = created.json()["data"]["id"]

    resp = await client.get(
        f"/api/credentials/{credential_id}", params={"reveal": "true"}, headers=employee_headers
    )

    assert resp.status_code == 200
    assert resp.json()["data"]["password"] == REAL_PASSWORD


async def test_any_employee_can_reveal_anothers_credential(
    client, employee_headers, other_employee_headers, client_id, portal_id
):
    """Confirmed product decision: stored portal passwords are shared, not owner-scoped."""
    created = await _create_credential(client, employee_headers, client_id, portal_id)
    credential_id = created.json()["data"]["id"]

    resp = await client.get(
        f"/api/credentials/{credential_id}",
        params={"reveal": "true"},
        headers=other_employee_headers,
    )

    assert resp.status_code == 200
    assert resp.json()["data"]["password"] == REAL_PASSWORD


async def test_get_one_requires_auth(client, employee_headers, client_id, portal_id):
    created = await _create_credential(client, employee_headers, client_id, portal_id)
    credential_id = created.json()["data"]["id"]

    resp = await client.get(f"/api/credentials/{credential_id}", params={"reveal": "true"})

    assert resp.status_code == 401
    assert resp.json()["error"]["code"] == "UNAUTHENTICATED"


async def test_get_one_not_found(client, employee_headers):
    resp = await client.get(
        "/api/credentials/00000000-0000-0000-0000-000000000000", headers=employee_headers
    )

    assert resp.status_code == 404
    assert resp.json()["error"]["code"] == "NOT_FOUND"


async def test_filter_by_portal(
    client, employee_headers, admin_headers, client_id, portal_id, uniq
):
    other_portal = await client.post(
        "/api/portals", json={"name": f"Other Portal {uniq}"}, headers=admin_headers
    )
    other_portal_id = other_portal.json()["data"]["id"]
    await _create_credential(client, employee_headers, client_id, portal_id)
    await _create_credential(client, employee_headers, client_id, other_portal_id)

    resp = await client.get(
        "/api/credentials", params={"portal_id": other_portal_id}, headers=employee_headers
    )

    body = resp.json()["data"]
    assert body["total_count"] == 1
    assert body["items"][0]["portal"]["id"] == other_portal_id


async def test_search_matches_company_name(client, employee_headers, client_id, portal_id, uniq):
    await _create_credential(client, employee_headers, client_id, portal_id)

    resp = await client.get(
        "/api/credentials",
        params={"search": f"Mehta Constructions {uniq}"},
        headers=employee_headers,
    )

    body = resp.json()["data"]
    assert body["total_count"] == 1
    assert body["items"][0]["client"]["company_name"] == f"Mehta Constructions {uniq}"


async def test_search_matches_portal_name(client, employee_headers, client_id, portal_id, uniq):
    await _create_credential(client, employee_headers, client_id, portal_id)

    resp = await client.get(
        "/api/credentials", params={"search": f"GeM Portal {uniq}"}, headers=employee_headers
    )

    body = resp.json()["data"]
    assert body["total_count"] == 1
    assert body["items"][0]["portal"]["name"] == f"GeM Portal {uniq}"


async def test_update_own_credential(client, employee_headers, client_id, portal_id):
    created = await _create_credential(client, employee_headers, client_id, portal_id)
    credential_id = created.json()["data"]["id"]

    resp = await client.patch(
        f"/api/credentials/{credential_id}",
        json={"password": "rotatedPassword456"},
        headers=employee_headers,
    )

    assert resp.status_code == 200
    assert resp.json()["data"]["password"] == MASKED

    revealed = await client.get(
        f"/api/credentials/{credential_id}", params={"reveal": "true"}, headers=employee_headers
    )
    assert revealed.json()["data"]["password"] == "rotatedPassword456"


async def test_employee_cannot_update_others_credential(
    client, employee_headers, other_employee_headers, client_id, portal_id
):
    created = await _create_credential(client, employee_headers, client_id, portal_id)
    credential_id = created.json()["data"]["id"]

    resp = await client.patch(
        f"/api/credentials/{credential_id}",
        json={"password": "hijacked"},
        headers=other_employee_headers,
    )

    assert resp.status_code == 403
    assert resp.json()["error"]["code"] == "FORBIDDEN"


async def test_admin_can_update_others_credential(
    client, employee_headers, admin_headers, client_id, portal_id
):
    created = await _create_credential(client, employee_headers, client_id, portal_id)
    credential_id = created.json()["data"]["id"]

    resp = await client.patch(
        f"/api/credentials/{credential_id}",
        json={"login_identifier": "admin.edited"},
        headers=admin_headers,
    )

    assert resp.status_code == 200
    assert resp.json()["data"]["login_identifier"] == "admin.edited"


async def test_employee_cannot_delete_others_credential(
    client, employee_headers, other_employee_headers, client_id, portal_id
):
    created = await _create_credential(client, employee_headers, client_id, portal_id)
    credential_id = created.json()["data"]["id"]

    resp = await client.delete(f"/api/credentials/{credential_id}", headers=other_employee_headers)

    assert resp.status_code == 403
    assert resp.json()["error"]["code"] == "FORBIDDEN"


async def test_delete_own_credential(client, employee_headers, client_id, portal_id):
    created = await _create_credential(client, employee_headers, client_id, portal_id)
    credential_id = created.json()["data"]["id"]

    resp = await client.delete(f"/api/credentials/{credential_id}", headers=employee_headers)

    assert resp.status_code == 200
    assert resp.json()["data"]["deleted"] is True

    follow_up = await client.get(f"/api/credentials/{credential_id}", headers=employee_headers)
    assert follow_up.status_code == 404


async def test_deleting_client_cascades_to_credentials(
    client, employee_headers, client_id, portal_id
):
    created = await _create_credential(client, employee_headers, client_id, portal_id)
    credential_id = created.json()["data"]["id"]

    await client.delete(f"/api/clients/{client_id}", headers=employee_headers)

    resp = await client.get(f"/api/credentials/{credential_id}", headers=employee_headers)
    assert resp.status_code == 404
