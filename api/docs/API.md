# Table Not Found API contract

Hand-written contract for the restaurant reservation and review API. The generated Swagger UI
(`/swagger/index.html`) lists the same routes; this document adds the rules behind them. Where the two
differ, the code and its tests (`api/internal/apitest`) are the truth.

## Conventions

- Base path: `/api/v1`.
- Every endpoint needs `Authorization: Bearer <access-token>`, except `/auth/*` and the picture files
  under `/uploads/*`.
- Request bodies are JSON (`Content-Type: application/json`), except the picture upload (see
  [Pictures](#pictures)). Responses are JSON. Field names are camelCase.
- Timestamps are RFC 3339 strings with any offset (`2026-10-12T18:00:00+07:00` and
  `2026-10-12T11:00:00Z` are the same moment). Opening hours are `"HH:MM"` strings.
- The user is always taken from the token. A body or query never names the owner or the booker.
  Unknown fields in a body are ignored, so sending `ownerId`, `userId` or `status` has no effect.
- Create answers `201 {"id": <int>}`. `PUT` answers `200` with the whole resource. `DELETE` and actions
  without a result (`cancel`) answer `204` with no body.
- Lists answer `{"total": <int>, "results": [...]}`. An empty list is `"results": []`, never `null`.
  Restaurants are paged (`page`, `limit`); reservations and reviews are not.
- Errors are `{"message": "...", "code": "..."}`. `code` is only present for the business rules listed in
  [Error codes](#error-codes); otherwise rely on the HTTP status.

| Status | Meaning |
| --- | --- |
| 400 | Invalid input, or a booking rule about the request itself (past, outside opening hours) |
| 401 | Missing, invalid or expired token |
| 403 | You are not allowed to do this to this resource (not the owner / not the booker) |
| 404 | The restaurant, reservation or review does not exist (a deleted restaurant does not exist) |
| 409 | The request conflicts with the current state (full, too late, already reviewed, ...) |
| 500 | Unexpected failure |

## Sign in

Unchanged from the course project: the API is the OAuth client of Keycloak, and the browser only ever
holds a short-lived one-time ticket.

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/auth/login` | Navigate the whole page here (do not `fetch`). 302 to Keycloak's sign-in form. |
| GET | `/auth/register` | Same as `/auth/login`, but Keycloak opens its sign-up form (OIDC `prompt=create`). After the form the person is signed in through the same `/auth/callback`. |
| GET | `/auth/callback` | Keycloak redirects here; the API then redirects to `{FRONTEND_URL}/auth/callback?ticket=...`. |
| POST | `/auth/exchange` | Body `{"ticket": "..."}`. The ticket works once and for 30 seconds. Answers `{accessToken, refreshToken, bearerType, expiresAt}`. |
| POST | `/auth/refresh-token` | Body `{"refreshToken": "..."}`. Answers a new credential. |
| POST | `/auth/logout` | Body `{"refreshToken": "..."}`. 204. |
| GET | `/users/me` | `{id, name, email, imageUrl, bio}`. |
| PUT | `/users/me` | Body `{imageUrl?, bio?}`. |

Accounts sign in with their **email address**, and anyone can sign up with one (the landing page's "สมัครสมาชิก" button goes to `/auth/register`). A person is created in the `users` table the first time they
sign in. Everyone is both a possible owner and a possible customer; there are no roles.

## Representations

Restaurant, as listed (`GET /restaurants`):

```json
{
  "id": 9001,
  "name": "ชาบูทองคำ",
  "address": "123 ถ.สุขุมวิท แขวงคลองเตย กรุงเทพฯ",
  "description": "ชาบูหม้อไฟ ...",
  "imageUrl": "/uploads/restaurants/9001-3f6c...c1.png",
  "seatingCapacity": 40,
  "cancellationLeadMinutes": 60,
  "owner": { "id": "5eed0000-0000-4000-8000-000000000001", "name": "คุณสมชาย เจ้าของร้าน" },
  "rating": { "average": 4.7, "total": 3 }
}
```

`description` and `imageUrl` are `null` when absent. `rating.total` is the number of reviews;
`rating.average` is their mean rounded to one decimal, and both are `0` when there are no reviews.

Restaurant detail (`GET /restaurants/{id}`, and the answer of `PUT` and of the picture upload) adds:

```json
{
  "...": "everything above",
  "openingHours": [ { "weekday": 1, "open": "11:00", "close": "22:00" } ],
  "isOwner": false,
  "myReview": { "id": 3, "rating": 5, "comment": "..." }
}
```

`weekday` is 0 (Sunday) to 6 (Saturday); a weekday that is not listed is a closed day.
`isOwner` says whether the caller owns the restaurant. `myReview` is the caller's own review, or `null`.

Reservation, as its booker sees it (`GET /reservations`, answer of `PUT /reservations/{id}`):

```json
{
  "id": 7,
  "restaurant": { "id": 9001, "name": "ชาบูทองคำ", "imageUrl": "/uploads/restaurants/9001-seed.jpg", "cancellationLeadMinutes": 60 },
  "startAt": "2026-10-12T11:00:00Z",
  "endAt": "2026-10-12T13:00:00Z",
  "guests": 4,
  "status": "confirmed",
  "createdAt": "2026-10-08T09:00:00Z"
}
```

`status` is `confirmed` or `cancelled`. `restaurant` also carries `imageUrl` (`null` when it has no picture) and
`cancellationLeadMinutes` (the rule that applies to changing or cancelling this booking). The restaurant's name,
picture and lead time are kept even after the restaurant is deleted.

Reservation, as the restaurant's owner sees it (`GET /restaurants/{id}/reservations`): the same, with
`"customer": {"id", "name"}` instead of `restaurant`. The customer's email is never included.

Review (`GET /restaurants/{id}/reviews`, answer of `PUT .../reviews/me`):

```json
{
  "id": 3, "rating": 5, "comment": "น้ำซุปหอม",
  "user": { "id": "...", "name": "สมศรี" },
  "createdAt": "2026-10-08T09:00:00Z", "updatedAt": "2026-10-08T09:00:00Z"
}
```

One of the caller's own reviews (`GET /reviews`): a review as above, with
`"restaurant": {"id", "name", "imageUrl"}` instead of `user` (`imageUrl` is `null` when the restaurant has no picture).

## Restaurants

| Method | Path | Who | Success |
| --- | --- | --- | --- |
| GET | `/restaurants` | anyone signed in | 200 list |
| GET | `/restaurants/{id}` | anyone signed in | 200 detail |
| POST | `/restaurants` | anyone signed in | 201 `{id}` |
| PUT | `/restaurants/{id}` | the owner | 200 detail |
| DELETE | `/restaurants/{id}` | the owner | 204 |
| POST | `/restaurants/{id}/image` | the owner | 200 detail |
| DELETE | `/restaurants/{id}/image` | the owner | 204 |

**List query:** `name` (case-insensitive "contains" on the name; `%` and `_` are ordinary characters; blank
means no filter), `sort` (`rating` or `reviews`, highest first; without it the newest restaurants come
first; ties always fall back to the id), `mine=true` (only restaurants you own), `page` (default 1, at most
1,000,000), `limit` (default 12, at most 100). Restaurants without reviews sort last by `rating` and `reviews`.

**Create / replace body** (the same for `POST` and `PUT`; `PUT` replaces everything, the opening hours as a
whole, and leaves the picture alone):

```json
{
  "name": "ชาบูทองคำ",
  "address": "123 ...",
  "description": "optional",
  "seatingCapacity": 40,
  "cancellationLeadMinutes": 60,
  "openingHours": [ { "weekday": 0, "open": "11:00", "close": "22:00" } ]
}
```

- `name` (at most 255 characters) and `address` must not be blank. `seatingCapacity` is at least 1.
  `cancellationLeadMinutes` is **at least 30**. Numbers must fit a 32-bit integer.
- `openingHours` has at least one entry, at most one per weekday; `open`/`close` are `HH:MM` and `close` is
  after `open` (a restaurant cannot stay open past midnight).
- Text must not contain a NUL character. Any of the above broken: `400`.
- Changing the capacity or the opening hours does **not** cancel or re-check existing reservations; only
  new and changed bookings follow the new values.

**Delete** is a soft delete. It answers `409 restaurant_has_active_reservations` while any confirmed
reservation has not ended yet; once those are cancelled or over, it succeeds. The restaurant then
disappears from lists and returns `404`, but customers' old reservations still show its name.

## Pictures

- `POST /restaurants/{id}/image` is `multipart/form-data` with the picture in the field **`file`**.
- JPEG, PNG or WebP, at most **2 MB**. The type is decided from the file's content, never its name or
  `Content-Type`; an empty file, a GIF/SVG, a text file called `.png` or a file over the limit gives
  `400 invalid_image` and changes nothing.
- The server picks the file name. The answer is the restaurant detail whose `imageUrl` is a path such as
  `/uploads/restaurants/9001-<uuid>.png`. A new upload replaces (and deletes) the old picture.
- `DELETE /restaurants/{id}/image` removes it (204, also when there was none).
- To show a picture, request `<API base URL><imageUrl>`: the files are public (`GET /api/v1/uploads/...`,
  no token) because an `<img>` tag cannot send one. Responses carry `X-Content-Type-Options: nosniff`.
- `imageUrl` cannot be set through `POST` or `PUT /restaurants`.

## Reservations

| Method | Path | Who | Success |
| --- | --- | --- | --- |
| POST | `/restaurants/{id}/reservations` | anyone signed in | 201 `{id}` |
| GET | `/reservations` | the caller | 200 list |
| PUT | `/reservations/{id}` | the booker | 200 reservation |
| POST | `/reservations/{id}/cancel` | the booker | 204 |
| GET | `/restaurants/{id}/reservations?status=` | the restaurant's owner | 200 list |
| GET | `/restaurants/{id}/availability?date=` | anyone signed in | 200 day |

**Availability** (`date` is `YYYY-MM-DD`, a Bangkok calendar day, zero-padded; anything else is `400`; an
unknown or deleted restaurant is `404`):

```json
{
  "date": "2026-10-12", "closed": false, "capacity": 10,
  "slots": [
    { "startAt": "2026-10-12T11:00:00+07:00", "endAt": "2026-10-12T12:00:00+07:00", "bookedGuests": 4, "remainingSeats": 6 }
  ]
}
```

- The day is cut into one-hour slots counted from the opening time; the last one ends at closing time and
  may be shorter. On a day the restaurant is closed, `closed` is `true` and `slots` is `[]`.
- `bookedGuests` is the most guests present **at one moment** inside the slot (the same `PeakGuests` rule
  as booking, over half-open intervals), not a sum; only `confirmed` reservations count.
  `remainingSeats` is `capacity - bookedGuests`, never below 0.
- It is a **snapshot for display**, read without the restaurant lock. A slot that shows seats can still
  answer `409 capacity_exceeded` when booked a moment later; the booking rules below are the only authority.

**Book / change body:** `{"startAt": "...", "endAt": "...", "guests": 4}`. A change cannot move the
reservation to another restaurant.

**The booking rules.** A booking is the half-open interval `[startAt, endAt)`: one that ends at 12:00 and
one that starts at 12:00 do not overlap. The server checks, in this order, and answers with the first
that fails:

1. `endAt` is after `startAt` and `guests` is at least 1 and fits a 32-bit integer, else `400`.
2. `startAt` is not before now, else `400 start_in_past`.
3. In **Bangkok time (UTC+7)** start and end fall on the same calendar day, the restaurant is open that
   weekday, and the whole span lies inside that day's opening hours (the end may be exactly the closing
   time), else `400 outside_opening_hours`. Times sent in any other offset are converted first.
4. The most guests present at the same moment, with this booking added, does not exceed the seating
   capacity, else `409 capacity_exceeded`. Confirmed bookings count; cancelled ones do not. When
   **changing** a reservation, its own current seats are not counted against it.

Everything is checked under a lock on the restaurant, so simultaneous requests can never fill the
restaurant beyond its capacity. The restaurant must exist and not be deleted, else `404`. The owner may
book their own restaurant.

**Changing and cancelling** may only be done by the booker (`403` otherwise), and only while the reservation
is `confirmed` and has not started (`409 reservation_not_active`). It must also be at least the
restaurant's `cancellationLeadMinutes` away from its **original** start (exactly that many minutes is still
allowed), else `409 too_late_to_modify` / `409 too_late_to_cancel`. A change then also has to pass rules 1-4.
Cancelling sets the status to `cancelled`; the row is kept.

**`GET /reservations`** lists every reservation the caller made, all statuses, newest start first.
**`GET /restaurants/{id}/reservations`** is the owner's read-only view of who booked; `status=confirmed` or
`status=cancelled` filters (anything else is `400`). The owner cannot change or cancel a customer's booking.

## Reviews

| Method | Path | Who | Success |
| --- | --- | --- | --- |
| POST | `/restaurants/{id}/reviews` | anyone except the owner | 201 `{id}` |
| PUT | `/restaurants/{id}/reviews/me` | the reviewer | 200 review |
| GET | `/restaurants/{id}/reviews` | anyone signed in | 200 list, newest first |
| GET | `/reviews` | the caller | 200 list, most recently edited first |

**Body:** `{"rating": 1-5, "comment": "..."}`. `rating` is a whole number from 1 to 5 and `comment` must
not be blank (and must not contain a NUL character), else `400`.

- The owner of a restaurant cannot review it: `403 cannot_review_own_restaurant`.
- One review per person per restaurant: a second `POST` is `409 already_reviewed`. Change it with
  `PUT .../reviews/me` (`404` if you have not reviewed yet). There is no way to delete a review.
- A reservation is not required to write a review.
- `GET /reviews` lists every review the caller wrote, across restaurants, with each restaurant's name. Reviews of
  restaurants that were deleted are left out. It is not paged; nobody else's reviews are ever included.

## Error codes

| `code` | Status | Meaning |
| --- | --- | --- |
| `start_in_past` | 400 | The reservation starts before now |
| `outside_opening_hours` | 400 | Not on one open day, or outside that day's hours |
| `capacity_exceeded` | 409 | Too many guests at the same time |
| `too_late_to_cancel` | 409 | Less than the cancellation lead time before the start |
| `too_late_to_modify` | 409 | Same, for changing |
| `reservation_not_active` | 409 | Already cancelled, or already started |
| `cannot_review_own_restaurant` | 403 | The owner tried to review their restaurant |
| `already_reviewed` | 409 | You already reviewed this restaurant |
| `restaurant_has_active_reservations` | 409 | Delete refused: a confirmed reservation has not ended |
| `invalid_image` | 400 | Missing, empty, too large, or not a JPEG/PNG/WebP |
