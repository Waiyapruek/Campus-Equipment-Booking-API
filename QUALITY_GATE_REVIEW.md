# Quality Gate Review

## Findings and fixes

1. **What I found:** The first implementation accepted two bookings for
   overlapping times. **How I fixed it:** Added a parameter-bound overlap query
   for both POST and PATCH, excluding the booking being updated.
   **Evidence:** Test cases 4 and 7 in [TEST_EVIDENCE.md](./TEST_EVIDENCE.md)
   show `201` for the first booking and `409` for the overlapping booking.

2. **What I found:** Equal start and end times were accepted, although a
   booking must have a real time range. **How I fixed it:** Parse both values
   and require `endAt` to be strictly after `startAt`.
   **Evidence:** Test case 5 returns `400` with the validation error.

3. **What I found:** The README listed only the collection GET/POST routes and
   did not provide the required contract, schema, AI log, or quality review.
   **How I fixed it:** Documented every CRUD route and validation rule in
   [API_CONTRACT.md](./API_CONTRACT.md), added the ERD to
   [README.md](./README.md), and added the required evidence and review files.
   **Evidence:** The artifacts are present in the project root and test cases
   1–7 are reproducible against the documented Base API URL.

## Ownership / reasoning check

I chose half-open booking intervals (`startAt < otherEndAt` and
`endAt > otherStartAt`) so back-to-back bookings are allowed while any
positive-duration overlap is rejected. Inputs are normalized to UTC before
storage, and request values remain SQL parameters rather than concatenated SQL.
