OBJ = {
    "name": "NGC 224",
    "alias": "Andromeda Galaxy",
    "obj_type": "Galaxy",
    "ra_h": 0.712,
    "dec_d": 41.269,
}


def test_list_empty(client):
    r = client.get("/api/catalog/")
    assert r.status_code == 200
    assert r.json() == []


def test_create(client):
    r = client.post("/api/catalog/", json=OBJ)
    assert r.status_code == 201
    data = r.json()
    assert data["name"] == OBJ["name"]
    assert data["ra_h"] == OBJ["ra_h"]
    assert data["source"] == "user"
    assert "id" in data


def test_create_duplicate(client):
    client.post("/api/catalog/", json=OBJ)
    r = client.post("/api/catalog/", json=OBJ)
    assert r.status_code == 409


def test_list_after_create(client):
    client.post("/api/catalog/", json=OBJ)
    client.post("/api/catalog/", json={**OBJ, "name": "M31"})
    r = client.get("/api/catalog/")
    assert r.status_code == 200
    assert len(r.json()) == 2


def test_delete(client):
    obj_id = client.post("/api/catalog/", json=OBJ).json()["id"]
    r = client.delete(f"/api/catalog/{obj_id}")
    assert r.status_code == 204
    assert client.get("/api/catalog/").json() == []


def test_delete_not_found(client):
    r = client.delete("/api/catalog/999")
    assert r.status_code == 404
