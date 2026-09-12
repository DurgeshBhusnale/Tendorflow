"""Tender departments master list — admin-managed, readable by any authenticated user.

Runs against a database holding committed demo data, so new names are uniquely
suffixed and assertions check membership, not exact set equality.
"""

SEEDED = {"PMC", "Civil-Works", "Govt-Supply"}


async def test_seeded_tender_departments_present(client, employee_headers):
    """The three baseline values are inserted by the migration, not a script."""
    resp = await client.get("/api/tender-departments", headers=employee_headers)

    assert resp.status_code == 200
    assert SEEDED.issubset({t["name"] for t in resp.json()["data"]})


async def test_create_tender_department_happy_path(client, admin_headers, uniq):
    resp = await client.post(
        "/api/tender-departments", json={"name": f"PWD-Roads-{uniq}"}, headers=admin_headers
    )

    assert resp.status_code == 201
    body = resp.json()
    assert body["data"]["name"] == f"PWD-Roads-{uniq}"
    assert body["data"]["is_active"] is True


async def test_create_tender_department_requires_auth(client, uniq):
    resp = await client.post("/api/tender-departments", json={"name": f"PWD-Roads-{uniq}"})

    assert resp.status_code == 401
    assert resp.json()["error"]["code"] == "UNAUTHENTICATED"


async def test_create_tender_department_requires_admin(client, employee_headers, uniq):
    resp = await client.post(
        "/api/tender-departments", json={"name": f"PWD-Roads-{uniq}"}, headers=employee_headers
    )

    assert resp.status_code == 403
    assert resp.json()["error"]["code"] == "FORBIDDEN"


async def test_create_tender_department_duplicate_name(client, admin_headers):
    """'PMC' is already present from the migration seed."""
    resp = await client.post("/api/tender-departments", json={"name": "PMC"}, headers=admin_headers)

    assert resp.status_code == 409
    assert resp.json()["error"]["code"] == "TENDER_DEPARTMENT_EXISTS"


async def test_create_tender_department_validation_error(client, admin_headers):
    resp = await client.post("/api/tender-departments", json={"name": ""}, headers=admin_headers)

    assert resp.status_code == 422
    assert resp.json()["error"]["code"] == "VALIDATION_ERROR"


async def test_employee_can_read_tender_departments(client, employee_headers):
    resp = await client.get("/api/tender-departments", headers=employee_headers)

    assert resp.status_code == 200
    assert len(resp.json()["data"]) >= 3


async def test_active_only_filter_excludes_deactivated(client, admin_headers, uniq):
    retired_name = f"Retired-Type-{uniq}"
    created = await client.post(
        "/api/tender-departments", json={"name": retired_name}, headers=admin_headers
    )
    tender_department_id = created.json()["data"]["id"]

    await client.patch(
        f"/api/tender-departments/{tender_department_id}",
        json={"is_active": False},
        headers=admin_headers,
    )

    all_resp = await client.get("/api/tender-departments", headers=admin_headers)
    active_resp = await client.get(
        "/api/tender-departments", params={"active_only": "true"}, headers=admin_headers
    )
    all_names = {t["name"] for t in all_resp.json()["data"]}
    active_names = {t["name"] for t in active_resp.json()["data"]}

    assert retired_name in all_names
    assert retired_name not in active_names
    # deactivating one must not hide the rest
    assert SEEDED.issubset(active_names)


async def test_update_tender_department_requires_admin(
    client, admin_headers, employee_headers, uniq
):
    created = await client.post(
        "/api/tender-departments", json={"name": f"PWD-Roads-{uniq}"}, headers=admin_headers
    )
    tender_department_id = created.json()["data"]["id"]

    resp = await client.patch(
        f"/api/tender-departments/{tender_department_id}",
        json={"is_active": False},
        headers=employee_headers,
    )

    assert resp.status_code == 403
    assert resp.json()["error"]["code"] == "FORBIDDEN"


async def test_update_tender_department_not_found(client, admin_headers):
    resp = await client.patch(
        "/api/tender-departments/00000000-0000-0000-0000-000000000000",
        json={"is_active": False},
        headers=admin_headers,
    )

    assert resp.status_code == 404
    assert resp.json()["error"]["code"] == "NOT_FOUND"
