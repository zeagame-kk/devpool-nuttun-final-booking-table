"""End-to-end smoke test against the running docker compose stack.

    set -a; . ./.env; set +a; python3 -I scripts/smoke_api.py

Two throwaway users (an owner and a customer) are created in Keycloak, log in through the real
flow (API redirect -> Keycloak form -> API callback -> ticket -> token), and then walk the main
booking journey over HTTP: create a restaurant, upload its picture, book, review, and delete. The
users are deleted again at the end. Needs only the standard library; prints no tokens or passwords.
"""
import base64
import http.cookiejar
import json
import os
import re
import secrets
import sys
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timedelta, timezone
from html import unescape

KC = os.environ.get("KC_URL", "http://localhost:8180")
API = os.environ.get("API_URL", "http://localhost:8080/api/v1")
REALM = "pea"
BANGKOK = timezone(timedelta(hours=7))

# A real 1x1 PNG.
PNG = base64.b64decode(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="
)


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *args, **kwargs):
        return None


def call(opener, url, data=None, headers=None, method=None):
    request = urllib.request.Request(url, data=data, headers=headers or {}, method=method)
    try:
        response = opener.open(request, timeout=20)
        return response.status, dict(response.headers), response.read()
    except urllib.error.HTTPError as error:
        return error.code, dict(error.headers), error.read()


def check(ok, label, detail=""):
    print(("PASS  " if ok else "FAIL  ") + label + (f"  [{detail}]" if not ok and detail else ""))
    if not ok:
        raise SystemExit(1)


plain = urllib.request.build_opener()


def json_call(token, method, path, body=None):
    headers = {"Authorization": f"Bearer {token}"}
    data = None
    if body is not None:
        data = json.dumps(body).encode()
        headers["Content-Type"] = "application/json"
    status, _, raw = call(plain, API + path, data, headers, method)
    return status, (json.loads(raw) if raw else None)


def create_user(admin_headers, label):
    name = f"smoke-{label}-{secrets.token_hex(3)}"
    email = f"{name}@example.com"
    password = secrets.token_urlsafe(18)
    user = {
        "username": name, "email": email, "firstName": label.capitalize(), "lastName": "Smoke",
        "enabled": True, "emailVerified": True,
    }
    status, headers, _ = call(plain, f"{KC}/admin/realms/{REALM}/users", json.dumps(user).encode(), admin_headers, "POST")
    check(status == 201, f"created Keycloak user ({label})")
    user_id = headers["Location"].rsplit("/", 1)[1]
    status, _, _ = call(
        plain, f"{KC}/admin/realms/{REALM}/users/{user_id}/reset-password",
        json.dumps({"type": "password", "value": password, "temporary": False}).encode(), admin_headers, "PUT",
    )
    check(status == 204, f"set password ({label})")
    return {"id": user_id, "email": email, "password": password}


def login(user):
    """Run the real login flow and return an access token."""
    # Keycloak marks its cookies Secure even over http; browsers accept them from *.localhost.
    jar = http.cookiejar.CookieJar(policy=http.cookiejar.DefaultCookiePolicy(secure_protocols=("https", "http")))
    browser = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar), NoRedirect)

    _, headers, _ = call(browser, f"{API}/auth/login")
    _, _, page = call(browser, headers["Location"])
    action = unescape(re.search(r'<form[^>]*action="([^"]+)"', page.decode()).group(1))
    form = urllib.parse.urlencode({"username": user["email"], "password": user["password"], "credentialId": ""}).encode()
    _, headers, _ = call(browser, action, form, {"Content-Type": "application/x-www-form-urlencoded"}, "POST")
    _, headers, _ = call(browser, headers["Location"])
    ticket = urllib.parse.parse_qs(urllib.parse.urlparse(headers["Location"]).query)["ticket"][0]
    status, _, raw = call(plain, f"{API}/auth/exchange", json.dumps({"ticket": ticket}).encode(),
                          {"Content-Type": "application/json"}, "POST")
    check(status == 200, f"logged in as {user['email'].split('@')[0]}")
    return json.loads(raw)["accessToken"]


def multipart(field, filename, content):
    boundary = "----smoke" + secrets.token_hex(8)
    body = (
        f"--{boundary}\r\nContent-Disposition: form-data; name=\"{field}\"; filename=\"{filename}\"\r\n"
        f"Content-Type: application/octet-stream\r\n\r\n"
    ).encode() + content + f"\r\n--{boundary}--\r\n".encode()
    return body, f"multipart/form-data; boundary={boundary}"


def upload_image(token, restaurant_id, filename, content):
    body, content_type = multipart("file", filename, content)
    return call(plain, f"{API}/restaurants/{restaurant_id}/image", body,
                {"Authorization": f"Bearer {token}", "Content-Type": content_type}, "POST")


def main():
    status, _, raw = call(plain, f"{KC}/realms/master/protocol/openid-connect/token", urllib.parse.urlencode({
        "grant_type": "password", "client_id": "admin-cli", "username": "admin",
        "password": os.environ["KC_ADMIN_PASSWORD"],
    }).encode())
    admin_headers = {"Authorization": f"Bearer {json.loads(raw)['access_token']}", "Content-Type": "application/json"}

    created = []
    try:
        owner = create_user(admin_headers, "owner")
        created.append(owner)
        customer = create_user(admin_headers, "customer")
        created.append(customer)
        owner_token, customer_token = login(owner), login(customer)

        # --- restaurant -------------------------------------------------------------------
        name = "ชาบูทดสอบ " + secrets.token_hex(2)
        every_day = [{"weekday": day, "open": "11:00", "close": "22:00"} for day in range(7)]
        status, body = json_call(owner_token, "POST", "/restaurants", {
            "name": name, "address": "99 ถ.ทดสอบ", "seatingCapacity": 10,
            "cancellationLeadMinutes": 60, "openingHours": every_day,
        })
        check(status == 201, "owner creates a restaurant", f"{status} {body}")
        restaurant_id = body["id"]

        # --- picture: the API runs as a non-root user and must be able to write the volume ---
        status, _, raw = upload_image(owner_token, restaurant_id, "front.png", PNG)
        check(status == 200, "owner uploads a PNG (the upload folder is writable)", f"{status} {raw[:200]}")
        image_url = json.loads(raw)["imageUrl"]
        check(image_url.startswith("/uploads/restaurants/") and image_url.endswith(".png"), "image URL looks right", image_url)
        status, headers, served = call(plain, API + image_url)
        check(status == 200 and served == PNG, "the picture is served to anyone, byte for byte")
        check(headers.get("Content-Type") == "image/png" and headers.get("X-Content-Type-Options") == "nosniff",
              "served as image/png with nosniff")
        status, _, _ = upload_image(owner_token, restaurant_id, "evil.png", b"not a picture")
        check(status == 400, "a text file called .png is refused")
        status, _, _ = upload_image(customer_token, restaurant_id, "front.png", PNG)
        check(status == 403, "a customer cannot upload a picture for someone else's restaurant")

        # --- browse -----------------------------------------------------------------------
        status, body = json_call(customer_token, "GET", "/restaurants?name=" + urllib.parse.quote(name))
        check(status == 200 and body["total"] == 1 and body["results"][0]["imageUrl"] == image_url, "customer finds it by name")

        # --- reserve ----------------------------------------------------------------------
        tomorrow = (datetime.now(BANGKOK) + timedelta(days=1)).replace(hour=18, minute=0, second=0, microsecond=0)
        start, end = tomorrow.isoformat(), (tomorrow + timedelta(hours=2)).isoformat()
        status, body = json_call(customer_token, "POST", f"/restaurants/{restaurant_id}/reservations",
                                 {"startAt": start, "endAt": end, "guests": 6})
        check(status == 201, "customer books 6 seats", f"{status} {body}")
        reservation_id = body["id"]
        status, body = json_call(customer_token, "POST", f"/restaurants/{restaurant_id}/reservations",
                                 {"startAt": start, "endAt": end, "guests": 5})
        check(status == 409 and body.get("code") == "capacity_exceeded", "6 + 5 seats in a 10-seat restaurant is refused")
        status, body = json_call(customer_token, "GET", "/reservations")
        restaurant_ref = body["results"][0]["restaurant"] if status == 200 else {}
        check(status == 200 and restaurant_ref.get("name") == name, "customer sees the booking")
        check(restaurant_ref.get("imageUrl") == image_url and restaurant_ref.get("cancellationLeadMinutes") == 60,
              "the booking carries the restaurant's picture and cancellation lead time", str(restaurant_ref))
        day = tomorrow.strftime("%Y-%m-%d")
        status, body = json_call(customer_token, "GET", f"/restaurants/{restaurant_id}/availability?date={day}")
        remaining = {slot["startAt"][11:16]: slot["remainingSeats"] for slot in body["slots"]} if status == 200 else {}
        check(status == 200 and not body["closed"] and body["capacity"] == 10 and len(body["slots"]) == 11, "availability lists eleven hourly slots", f"{status} {body}")
        check(remaining.get("17:00") == 10 and remaining.get("18:00") == 4 and remaining.get("19:00") == 4 and remaining.get("20:00") == 10,
              "the 6 booked seats show in the 18:00 and 19:00 slots only", str(remaining))
        status, _ = json_call(customer_token, "GET", f"/restaurants/{restaurant_id}/availability?date=tomorrow")
        check(status == 400, "availability refuses a date that is not YYYY-MM-DD")
        status, body = json_call(owner_token, "GET", f"/restaurants/{restaurant_id}/reservations")
        check(status == 200 and body["total"] == 1 and "@" not in json.dumps(body), "owner sees who booked, without an email")
        status, _ = json_call(customer_token, "GET", f"/restaurants/{restaurant_id}/reservations")
        check(status == 403, "a customer cannot read the owner's list")

        # --- review -----------------------------------------------------------------------
        status, body = json_call(customer_token, "POST", f"/restaurants/{restaurant_id}/reviews", {"rating": 5, "comment": "อร่อยมาก"})
        check(status == 201, "customer reviews 5 stars", f"{status} {body}")
        status, body = json_call(customer_token, "POST", f"/restaurants/{restaurant_id}/reviews", {"rating": 4, "comment": "อีกที"})
        check(status == 409 and body.get("code") == "already_reviewed", "a second review is refused")
        status, body = json_call(owner_token, "POST", f"/restaurants/{restaurant_id}/reviews", {"rating": 5, "comment": "ร้านฉัน"})
        check(status == 403 and body.get("code") == "cannot_review_own_restaurant", "the owner cannot review their own restaurant")
        status, body = json_call(customer_token, "GET", "/reviews")
        check(status == 200 and body["total"] == 1 and body["results"][0]["restaurant"] == {"id": restaurant_id, "name": name, "imageUrl": image_url}
              and body["results"][0]["rating"] == 5, "GET /reviews lists my review with the restaurant's name")
        status, body = json_call(owner_token, "GET", "/reviews")
        check(status == 200 and body == {"total": 0, "results": []}, "the owner has written no reviews")
        status, body = json_call(customer_token, "GET", f"/restaurants/{restaurant_id}")
        check(status == 200 and body["rating"] == {"average": 5.0, "total": 1} and body["myReview"]["rating"] == 5 and not body["isOwner"],
              "restaurant shows rating 5.0 (1) and my review")
        status, body = json_call(customer_token, "GET", "/restaurants?sort=rating")
        averages = [item["rating"]["average"] for item in body["results"]]
        check(status == 200 and averages == sorted(averages, reverse=True) and averages[0] == 5.0,
              "sorted by rating, highest average first")

        # --- delete guard, then cancel, then delete ---------------------------------------
        status, body = json_call(owner_token, "DELETE", f"/restaurants/{restaurant_id}")
        check(status == 409 and body.get("code") == "restaurant_has_active_reservations", "cannot delete while a booking is active")
        status, _ = json_call(customer_token, "POST", f"/reservations/{reservation_id}/cancel")
        check(status == 204, "customer cancels (well before the lead time)")
        status, _ = json_call(owner_token, "DELETE", f"/restaurants/{restaurant_id}")
        check(status == 204, "owner deletes the restaurant")
        status, _ = json_call(owner_token, "GET", f"/restaurants/{restaurant_id}")
        check(status == 404, "it is gone")
        status, _ = json_call(customer_token, "GET", f"/restaurants/{restaurant_id}/availability?date={day}")
        check(status == 404, "its availability is gone too")
        status, body = json_call(customer_token, "GET", "/reviews")
        check(status == 200 and body["total"] == 0, "my review of the deleted restaurant is no longer listed")
        status, body = json_call(customer_token, "GET", "/reservations")
        check(status == 200 and body["results"][0]["restaurant"]["name"] == name and body["results"][0]["status"] == "cancelled",
              "the cancelled booking still shows the deleted restaurant's name")
    finally:
        for user in created:
            status, _, _ = call(plain, f"{KC}/admin/realms/{REALM}/users/{user['id']}", headers=admin_headers, method="DELETE")
            print("cleanup: user deleted" if status == 204 else f"cleanup: DELETE returned {status}")

    print("ALL CHECKS PASSED")


if __name__ == "__main__":
    sys.exit(main())
