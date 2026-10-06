# API Contract

Base URL: `http://localhost:8787/api` for local testing.

## Resources

### Equipment

- `GET /equipment` -> `200` and an array of equipment.
- `POST /equipment` -> `201`.
- Required POST fields: non-empty `name`, `location`, `category`; `quantity`
  defaults to `1` and must be a positive integer.

Equipment IDs are represented externally as `eq-1`, `eq-2`, and so on.

### Bookings

| Method | Path | Success |
| --- | --- | ---: |
| GET | `/bookings` | 200 |
| GET | `/bookings/:id` | 200 |
| POST | `/bookings` | 201 |
| PATCH | `/bookings/:id` | 200 |
| DELETE | `/bookings/:id` | 204 |

The booking payload is:

```json
{
  "equipmentId": "eq-1",
  "borrowerName": "Somchai Jaidee",
  "startAt": "2026-10-20T09:00:00.000Z",
  "endAt": "2026-10-20T11:00:00.000Z",
  "purpose": "Class presentation"
}
```

`PATCH` accepts any non-empty subset of these fields and may also update
`status` to `pending`, `approved`, `returned`, or `cancelled`.

## Validation and errors

- `400`: malformed JSON, missing/invalid fields, invalid IDs, or
  `startAt >= endAt`.
- `404`: booking or equipment does not exist.
- `409`: the requested time range overlaps an existing booking for the same
  equipment.
- Error body for every error status:

```json
{ "error": "A message understandable to a user or developer" }
```

The overlap rule uses half-open intervals: an interval ending exactly when a
second interval starts does not conflict. SQL request values are always
parameter-bound.
