MEAS = {
    "filter_name": "R",
    "sky_e": 5.0,
    "airmass_obj": 1.5,
    "moon_illum": 20.0,
    "moon_dist": 45.0,
}


def _add(client, **kwargs):
    return client.post("/api/skydb/", json={**MEAS, **kwargs})


# ── CRUD ──────────────────────────────────────────────────────────────────────

def test_list_empty(client):
    r = client.get("/api/skydb/")
    assert r.status_code == 200
    assert r.json() == []


def test_create(client):
    r = _add(client)
    assert r.status_code == 201
    data = r.json()
    assert data["filter_name"] == "R"
    assert data["sky_e"] == 5.0
    assert "id" in data


def test_list_filter(client):
    _add(client, filter_name="R")
    _add(client, filter_name="V", sky_e=3.1)
    r = client.get("/api/skydb/?filter_name=V")
    assert r.status_code == 200
    rows = r.json()
    assert len(rows) == 1
    assert rows[0]["filter_name"] == "V"


def test_delete(client):
    meas_id = _add(client).json()["id"]
    r = client.delete(f"/api/skydb/{meas_id}")
    assert r.status_code == 204
    assert client.get("/api/skydb/").json() == []


def test_delete_not_found(client):
    assert client.delete("/api/skydb/999").status_code == 404


# ── Stats ─────────────────────────────────────────────────────────────────────

def test_stats_empty(client):
    r = client.get("/api/skydb/stats")
    assert r.status_code == 200
    assert r.json() == {"count": 0, "filters": {}}


def test_stats_with_data(client):
    for sky_e in [4.0, 5.0, 6.0]:
        _add(client, sky_e=sky_e, moon_illum=5.0)   # no_moon bucket
    r = client.get("/api/skydb/stats?filter_name=R")
    assert r.status_code == 200
    data = r.json()
    assert data["count"] == 3
    stats = data["filters"]["R"]
    assert stats["all"]["n"] == 3
    assert stats["all"]["mean"] == 5.0
    assert stats["no_moon"]["n"] == 3    # moon_illum=5 < 10
    assert stats["half_moon"] is None
    assert stats["full_moon"] is None


def test_stats_lunar_buckets(client):
    _add(client, sky_e=3.0, moon_illum=5.0)    # no_moon
    _add(client, sky_e=7.0, moon_illum=30.0)   # half_moon
    _add(client, sky_e=15.0, moon_illum=80.0)  # full_moon
    data = client.get("/api/skydb/stats?filter_name=R").json()
    f = data["filters"]["R"]
    assert f["no_moon"]["n"] == 1
    assert f["half_moon"]["n"] == 1
    assert f["full_moon"]["n"] == 1


# ── Predict ───────────────────────────────────────────────────────────────────

def test_predict_insufficient_data(client):
    _add(client)
    _add(client, sky_e=6.0)
    r = client.get("/api/skydb/predict?filter_name=R&airmass=1.5&moon_illum=20&moon_dist=45")
    assert r.status_code == 200
    assert r.json()["sky_e"] is None


def test_predict_returns_estimate(client):
    for sky_e in [4.0, 5.0, 6.0]:
        _add(client, sky_e=sky_e)
    r = client.get("/api/skydb/predict?filter_name=R&airmass=1.5&moon_illum=20&moon_dist=45")
    assert r.status_code == 200
    data = r.json()
    assert isinstance(data["sky_e"], float)
    assert data["n_used"] == 3


def test_predict_exact_match(client):
    # Con 3 misure identiche alle condizioni richieste, il predetto deve coincidere
    for _ in range(3):
        _add(client, sky_e=5.5, airmass_obj=1.2, moon_illum=10.0, moon_dist=60.0)
    r = client.get("/api/skydb/predict?filter_name=R&airmass=1.2&moon_illum=10&moon_dist=60")
    assert r.status_code == 200
    assert abs(r.json()["sky_e"] - 5.5) < 0.01
