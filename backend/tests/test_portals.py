"""Portals master list — admin-managed, readable by any authenticated user.

Runs against a database holding committed demo data, so portal names are
uniquely suffixed and assertions check membership, not exact set equality.
"""


async def test_create_portal_happy_path(client, admin_headers, uniq):
    resp = await client.post(
        "/api/portals", json={"name": f"GeM Portal {uniq}"}, headers=admin_headers
    )

    assert resp.status_code == 201
    body = resp.json()
    assert body["success"] is True
    assert body["data"]["name"] == f"GeM Portal {uniq}"
    assert body["data"]["is_active"] is True


async def test_create_portal_requires_auth(client, uniq):
    resp = await client.post("/api/portals", json={"name": f"GeM Portal {uniq}"})

    assert resp.status_code == 401
    assert resp.json()["error"]["code"] == "UNAUTHENTICATED"


async def test_create_portal_requires_admin(client, employee_headers, uniq):
    resp = await client.post(
        "/api/portals", json={"name": f"GeM Portal {uniq}"}, headers=employee_headers
    )

    assert resp.status_code == 403
    assert resp.json()["error"]["code"] == "FORBIDDEN"


async def test_create_portal_duplicate_name(client, admin_headers, uniq):
    name = f"GeM Portal {uniq}"
    await client.post("/api/portals", json={"name": name}, headers=admin_headers)
    resp = await client.post("/api/portals", json={"name": name}, headers=admin_headers)

    assert resp.status_code == 409
    assert resp.json()["error"]["code"] == "PORTAL_EXISTS"


async def test_create_portal_validation_error(client, admin_headers):
    resp = await client.post("/api/portals", json={"name": ""}, headers=admin_headers)

    assert resp.status_code == 422
    assert resp.json()["error"]["code"] == "VALIDATION_ERROR"


async def test_employee_can_read_portals(client, admin_headers, employee_headers, uniq):
    await client.post("/api/portals", json={"name": f"GeM Portal {uniq}"}, headers=admin_headers)

    resp = await client.get("/api/portals", headers=employee_headers)

    assert resp.status_code == 200
    assert f"GeM Portal {uniq}" in {p["name"] for p in resp.json()["data"]}


async def test_active_only_filter_excludes_deactivated(client, admin_headers, uniq):
    retired_name = f"Retired Portal {uniq}"
    live_name = f"Live Portal {uniq}"
    created = await client.post("/api/portals", json={"name": retired_name}, headers=admin_headers)
    portal_id = created.json()["data"]["id"]
    await client.post("/api/portals", json={"name": live_name}, headers=admin_headers)

    await client.patch(
        f"/api/portals/{portal_id}", json={"is_active": False}, headers=admin_headers
    )

    all_names = {
        p["name"] for p in (await client.get("/api/portals", headers=admin_headers)).json()["data"]
    }
    active_resp = await client.get(
        "/api/portals", params={"active_only": "true"}, headers=admin_headers
    )
    active_names = {p["name"] for p in active_resp.json()["data"]}

    assert {retired_name, live_name}.issubset(all_names)
    assert retired_name not in active_names
    # deactivating one must not hide the others
    assert live_name in active_names


async def test_deactivated_portal_still_resolves_by_id(client, admin_headers, uniq):
    """Historic credential rows keep referencing inactive portals (DATABASE_SCHEMA section 2)."""
    created = await client.post(
        "/api/portals", json={"name": f"Retired Portal {uniq}"}, headers=admin_headers
    )
    portal_id = created.json()["data"]["id"]

    resp = await client.patch(
        f"/api/portals/{portal_id}", json={"is_active": False}, headers=admin_headers
    )

    assert resp.status_code == 200
    assert resp.json()["data"]["is_active"] is False
    assert resp.json()["data"]["id"] == portal_id


async def test_update_portal_requires_admin(client, admin_headers, employee_headers, uniq):
    created = await client.post(
        "/api/portals", json={"name": f"GeM Portal {uniq}"}, headers=admin_headers
    )
    portal_id = created.json()["data"]["id"]

    resp = await client.patch(
        f"/api/portals/{portal_id}", json={"is_active": False}, headers=employee_headers
    )

    assert resp.status_code == 403
    assert resp.json()["error"]["code"] == "FORBIDDEN"


async def test_update_portal_not_found(client, admin_headers):
    resp = await client.patch(
        "/api/portals/00000000-0000-0000-0000-000000000000",
        json={"is_active": False},
        headers=admin_headers,
    )

    assert resp.status_code == 404
    assert resp.json()["error"]["code"] == "NOT_FOUND"
