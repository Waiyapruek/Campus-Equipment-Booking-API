## Run the API

Install the dependencies from the project root:

```txt
npm install
```

Apply all D1 migrations to the local database before starting the API:

```txt
npx wrangler d1 migrations apply eq-db --local
```

Start the local Cloudflare Worker:

```txt
npm run dev
```

The API is available at `http://localhost:8787`. Its routes are mounted under
the `/api` base path, such as `http://localhost:8787/api/equipment`.

To deploy the Worker to Cloudflare:

```txt
npm run deploy
```

## Database

This API uses Cloudflare D1 through the `DB` binding, configured for the
`eq-db` database in `wrangler.jsonc`. The migrations include the schema and
five sample equipment records. Apply them locally with:

```txt
npx wrangler d1 migrations apply eq-db --local
```

Apply pending migrations to the deployed database with:

```txt
npx wrangler d1 migrations apply eq-db --remote
```

The remote database ID is configured in `wrangler.jsonc`.

Available endpoints:

- `GET /api/equipment` lists equipment.
- `POST /api/equipment` creates equipment with `name`, `location` (for example,
  `Building 1`), and `category`, plus optional `description` and positive
  integer `quantity`. Equipment
  IDs are returned in the `eq-{number}` format.
- `GET /api/booking` lists bookings.
- `POST /api/booking` creates a booking with `equipmentId` (for example,
  `eq-1`), `borrowerName`,
  `startAt`, `endAt` (`YYYY-MM-DDTHH:mm`), and `purpose`.

To generate or synchronize types from the Worker configuration, run:

```txt
npm run cf-typegen
```

Pass the `CloudflareBindings` as generics when instantiating `Hono`:

```ts
// src/index.ts
const app = new Hono<{ Bindings: CloudflareBindings }>()
```
