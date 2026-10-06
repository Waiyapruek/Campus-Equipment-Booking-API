# Test Evidence

Base API URL used for this evidence: `http://127.0.0.1:8788/api`

Run the server with `npm run dev` after applying local migrations. The
following cases were run with `curl.exe`; IDs may differ if the local database
already contains data.

| # | Command / case | Expected and observed result |
|---:|---|---|
| 1 | `curl.exe -i "$BASE/equipment"` | `200`; JSON array containing seeded equipment |
| 2 | POST a booking for `eq-2` from `2026-10-20T09:00:00.000Z` to `2026-10-20T11:00:00.000Z` | `201`; observed booking `id:5` with camelCase contract fields |
| 3 | `curl.exe -i "$BASE/bookings/5"` | `200`; the booking created in case 2 |
| 4 | Repeat case 2 for `eq-2` with `startAt` `2026-10-20T10:00:00.000Z` and `endAt` `2026-10-20T12:00:00.000Z` | `409`; `{"error":"The equipment is already booked for this time range"}` |
| 5 | POST with equal `startAt` and `endAt` | `400`; `{"error":"endAt must be after startAt"}` |
| 6 | `curl.exe -i "$BASE/bookings/999999"` | `404`; `{"error":"Booking not found"}` |
| 7 | `curl.exe -i -X PATCH "$BASE/bookings/5" -H "Content-Type: application/json" --data '{"purpose":"Updated API verification"}'` | `200`; booking returned with updated purpose |
| 8 | `curl.exe -i -X DELETE "$BASE/bookings/5"` | `204`; empty response body |

Cases 1–8 cover successful reads, create, update, delete, invalid input,
not-found handling, and the overlap conflict.
