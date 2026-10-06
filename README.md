# Campus Equipment Booking API

TypeScript/Hono API running on a Cloudflare Worker with a local or remote
Cloudflare D1 SQLite database.

## Run locally

Requirements: Node.js 18+ and npm.

```powershell
npm install
npx wrangler d1 migrations apply eq-db --local
npm run dev
```

The local Base API URL is normally `http://localhost:8787/api`; the evidence
in this submission was run at `http://127.0.0.1:8788/api` because port 8787
was already occupied. The five seeded
equipment records are created by the migrations. Use `npm run deploy` to
deploy the Worker, then apply migrations with
`npx wrangler d1 migrations apply eq-db --remote`.

## API contract

All successful responses are JSON except `DELETE`, which returns `204` with no
body. Every error is JSON in the form `{ "error": "message" }`.

| Method | Path | Success | Description |
| --- | --- | ---: | --- |
| GET | `/equipment` | 200 | List equipment |
| POST | `/equipment` | 201 | Create equipment |
| GET | `/bookings` | 200 | List bookings |
| GET | `/bookings/:id` | 200 | Get one booking |
| POST | `/bookings` | 201 | Create a booking |
| PATCH | `/bookings/:id` | 200 | Partially update a booking |
| DELETE | `/bookings/:id` | 204 | Delete a booking |

Create and update booking payloads use:

```json
{
  "equipmentId": "eq-1",
  "borrowerName": "Somchai Jaidee",
  "startAt": "2026-10-20T09:00:00.000Z",
  "endAt": "2026-10-20T11:00:00.000Z",
  "purpose": "Class presentation"
}
```

Booking responses include `id`, `equipmentId`, `borrowerName`, `startAt`,
`endAt`, and `purpose` (plus status, equipment name, and created time).
`equipmentId` must refer to an existing equipment record. Times must be valid
date-time values and `startAt` must be strictly before `endAt`. Two bookings
for the same equipment may touch at an endpoint, but may not overlap; an
overlap returns `409`.

Equipment creation requires non-empty `name`, `location`, and `category`, plus
an optional positive integer `quantity`. Booking and equipment identifiers use
the `eq-{number}` format for equipment and positive integers for bookings.
Invalid or missing data returns `400`; missing resources return `404`.

## Schema / ERD

```text
equipment (1) ───────< (many) bookings
  id PK                 id PK
  name                  equipment_id FK -> equipment.id
  location              borrower_name
  category              start_date
  description           end_date
  quantity              purpose
  available_quantity    status
  created_at            created_at
```

`migrations/0001_eq-db.sql` defines the tables, foreign key, checks, and
indexes. Later migrations add equipment location and seed five records.

## Test evidence

The reproducible curl cases and their observed responses are recorded in
[TEST_EVIDENCE.md](./TEST_EVIDENCE.md). The evidence uses
`http://localhost:8787/api` and includes successful CRUD operations, invalid
input, not-found handling, and an overlap conflict.

## Type generation

```powershell
npm run cf-typegen
```
# Campus-Equipment-Booking-API
