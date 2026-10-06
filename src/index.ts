import { Hono } from 'hono'

type bindings = {
  DB: D1Database
}

type CreateBooking = {
  equipmentId: string
  borrowerName: string
  startAt: string // YYYY-MM-DDTHH:mm
  endAt: string // YYYY-MM-DDTHH:mm
  purpose: string
}

type UpdateBooking = Partial<{
  equipmentId: string
  borrowerName: string
  startAt: string
  endAt: string
  purpose: string
  status: 'pending' | 'approved' | 'returned' | 'cancelled'
}>

const BASE_URL = "/api"
const app = new Hono<{ Bindings: CloudflareBindings }>().basePath(BASE_URL)
const dateTimePattern =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})?$/

const bookingSelect = `SELECT b.id, printf('eq-%d', b.equipment_id) AS equipmentId,
                              e.name AS equipmentName, b.borrower_name AS borrowerName,
                              b.start_date AS startAt, b.end_date AS endAt,
                              b.purpose, b.status, b.created_at AS createdAt
                       FROM bookings b
                       JOIN equipment e ON e.id = b.equipment_id`

const parseBookingDate = (value: string) => {
  if (!dateTimePattern.test(value)) {
    return null
  }

  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

const hasBookingConflict = async (
  database: D1Database,
  equipmentId: number,
  startAt: string,
  endAt: string,
  excludedBookingId?: number,
) => {
  const conflict = await database
    .prepare(
      `SELECT 1
       FROM bookings
       WHERE equipment_id = ?
         AND (? IS NULL OR id != ?)
         AND start_date < ?
         AND end_date > ?
       LIMIT 1`,
    )
    .bind(
      equipmentId,
      excludedBookingId ?? null,
      excludedBookingId ?? null,
      endAt,
      startAt,
    )
    .first()

  return Boolean(conflict)
}

app.get('/equipment', async (c) => {  
  const result = await c.env['DB']
    .prepare(
      `SELECT printf('eq-%d', id) AS id, name, category, description,
              quantity, available_quantity, location, created_at
       FROM equipment
       ORDER BY name`,
    )
    .all()

  return c.json(result.results)
})

app.post('/equipment', async (c) => {
  let body: {
    name?: string
    location?: string
    category?: string
    description?: string
    quantity?: number
  }

  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Request body must be valid JSON' }, 400)
  }

  const quantity = body.quantity ?? 1
  if (
    !body.name?.trim() ||
    !body.location?.trim() ||
    !body.category?.trim() ||
    !Number.isInteger(quantity) ||
    quantity < 1
  ) {
    return c.json(
      { error: 'name, location, category, and a positive integer quantity are required' },
      400,
    )
  }

  const equipment = await c.env['DB']
    .prepare(
      `INSERT INTO equipment
        (name, location, category, description, quantity, available_quantity)
       VALUES (?, ?, ?, ?, ?, ?)
       RETURNING printf('eq-%d', id) AS id, name, location, category,
                 description, quantity, available_quantity, created_at`,
    )
    .bind(
      body.name.trim(),
      body.location.trim(),
      body.category.trim(),
      body.description?.trim() || null,
      quantity,
      quantity,
    )
    .first()

  if (!equipment) {
    return c.json({ error: 'Unable to create equipment' }, 500)
  }

  return c.json(equipment, 201)
})

app.get('/bookings', async (c) => {
  const result = await c.env['DB']
    .prepare(
      `${bookingSelect}
       ORDER BY b.start_date, b.created_at`,
    )
    .all()

  return c.json(result.results)
})

app.get('/bookings/:id', async (c) => {
  const bookingIdParam = c.req.param('id')
  const bookingId = Number(bookingIdParam)
  if (
    /^\d+$/.test(bookingIdParam) &&
    (!Number.isInteger(bookingId) || bookingId < 1)
  ) {
    return c.json({ error: 'Booking id must be a positive integer' }, 400)
  }

  const booking = await c.env['DB']
    .prepare(`${bookingSelect} WHERE b.id = ?`)
    .bind(Number.isInteger(bookingId) && bookingId > 0 ? bookingId : bookingIdParam)
    .first()

  if (!booking) {
    return c.json({ error: 'Booking not found' }, 404)
  }

  return c.json(booking)
})

app.post('/bookings', async (c) => {
  let body: Partial<CreateBooking>

  try {
    body = await c.req.json<Partial<CreateBooking>>()
  } catch {
    return c.json({ error: 'Request body must be valid JSON' }, 400)
  }

  const { equipmentId, borrowerName, startAt, endAt, purpose } = body
  const equipmentNumber = equipmentId?.match(/^eq-(\d+)$/)?.[1]
  if (
    !equipmentNumber ||
    !borrowerName?.trim() ||
    !startAt ||
    !endAt ||
    !purpose?.trim()
  ) {
    return c.json(
      {
        error:
          'equipmentId, borrowerName, startAt, endAt, and purpose are required',
      },
      400,
    )
  }

  const startDate = parseBookingDate(startAt)
  const endDate = parseBookingDate(endAt)
  if (!startDate || !endDate) {
    return c.json(
      { error: 'startAt and endAt must be valid date-time values' },
      400,
    )
  }

  if (endDate.getTime() <= startDate.getTime()) {
    return c.json({ error: 'endAt must be after startAt' }, 400)
  }

  const database = c.env['DB']
  const equipment = await database
    .prepare(
      `SELECT id
       FROM equipment
       WHERE id = ?`,
    )
    .bind(Number(equipmentNumber))
    .first()

  if (!equipment) {
    return c.json({ error: 'Equipment not found' }, 404)
  }

  const normalizedStartAt = startDate.toISOString()
  const normalizedEndAt = endDate.toISOString()
  if (
    await hasBookingConflict(
      database,
      Number(equipmentNumber),
      normalizedStartAt,
      normalizedEndAt,
    )
  ) {
    return c.json(
      { error: 'The equipment is already booked for this time range' },
      409,
    )
  }

  const [bookingResult] = await database.batch([
    database
      .prepare(
        `INSERT INTO bookings
          (equipment_id, borrower_name, start_date, end_date, purpose)
         VALUES (?, ?, ?, ?, ?)
         RETURNING id, printf('eq-%d', equipment_id) AS equipmentId,
                   borrower_name AS borrowerName, start_date AS startAt,
                   end_date AS endAt, purpose, status, created_at AS createdAt`,
      )
      .bind(
        Number(equipmentNumber),
        borrowerName.trim(),
        normalizedStartAt,
        normalizedEndAt,
        purpose.trim(),
      ),
    database
      .prepare(
        `UPDATE equipment
         SET available_quantity = MAX(0, available_quantity - 1)
         WHERE id = ?`,
      )
      .bind(Number(equipmentNumber)),
  ])
  const booking = bookingResult.results[0]

  if (!booking) {
    return c.json({ error: 'Unable to create booking' }, 500)
  }

  return c.json(booking, 201)
})

app.patch('/bookings/:id', async (c) => {
  const bookingId = Number(c.req.param('id'))
  if (!Number.isInteger(bookingId) || bookingId < 1) {
    return c.json({ error: 'Booking id must be a positive integer' }, 400)
  }

  let body: UpdateBooking
  try {
    body = await c.req.json<UpdateBooking>()
  } catch {
    return c.json({ error: 'Request body must be valid JSON' }, 400)
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return c.json({ error: 'Request body must be a JSON object' }, 400)
  }

  const existing = await c.env['DB']
    .prepare(
      'SELECT equipment_id, start_date, end_date FROM bookings WHERE id = ?',
    )
    .bind(bookingId)
    .first<{ equipment_id: number; start_date: string; end_date: string }>()

  if (!existing) {
    return c.json({ error: 'Booking not found' }, 404)
  }

  const startAt = body.startAt ?? existing.start_date
  const endAt = body.endAt ?? existing.end_date
  const startDate = parseBookingDate(startAt)
  const endDate = parseBookingDate(endAt)
  if (!startDate || !endDate) {
    return c.json(
      { error: 'startAt and endAt must be valid date-time values' },
      400,
    )
  }

  if (endDate.getTime() <= startDate.getTime()) {
    return c.json({ error: 'endAt must be after startAt' }, 400)
  }

  const equipmentNumber = body.equipmentId?.match(/^eq-(\d+)$/)?.[1]
  const equipmentId = equipmentNumber
    ? Number(equipmentNumber)
    : existing.equipment_id
  if (body.equipmentId !== undefined && !equipmentNumber) {
    return c.json({ error: 'equipmentId must use the eq-{number} format' }, 400)
  }
  const equipment = await c.env['DB']
    .prepare('SELECT id FROM equipment WHERE id = ?')
    .bind(equipmentId)
    .first()
  if (!equipment) {
    return c.json({ error: 'Equipment not found' }, 404)
  }
  if (
    await hasBookingConflict(
      c.env['DB'],
      equipmentId,
      startDate.toISOString(),
      endDate.toISOString(),
      bookingId,
    )
  ) {
    return c.json(
      { error: 'The equipment is already booked for this time range' },
      409,
    )
  }

  if (body.borrowerName !== undefined && !body.borrowerName.trim()) {
    return c.json({ error: 'borrowerName must not be empty' }, 400)
  }
  if (body.purpose !== undefined && !body.purpose.trim()) {
    return c.json({ error: 'purpose must not be empty' }, 400)
  }
  if (
    body.status !== undefined &&
    !['pending', 'approved', 'returned', 'cancelled'].includes(body.status)
  ) {
    return c.json(
      { error: 'status must be pending, approved, returned, or cancelled' },
      400,
    )
  }

  const updates: string[] = []
  const values: (string | number)[] = []
  if (body.equipmentId !== undefined) {
    updates.push('equipment_id = ?')
    values.push(equipmentId)
  }
  if (body.borrowerName !== undefined) {
    updates.push('borrower_name = ?')
    values.push(body.borrowerName.trim())
  }
  if (body.startAt !== undefined) {
    updates.push('start_date = ?')
    values.push(startDate.toISOString())
  }
  if (body.endAt !== undefined) {
    updates.push('end_date = ?')
    values.push(endDate.toISOString())
  }
  if (body.purpose !== undefined) {
    updates.push('purpose = ?')
    values.push(body.purpose.trim())
  }
  if (body.status !== undefined) {
    updates.push('status = ?')
    values.push(body.status)
  }

  if (updates.length === 0) {
    return c.json({ error: 'At least one booking field is required' }, 400)
  }

  values.push(bookingId)
  await c.env['DB']
    .prepare(`UPDATE bookings SET ${updates.join(', ')} WHERE id = ?`)
    .bind(...values)
    .run()

  const booking = await c.env['DB']
    .prepare(`${bookingSelect} WHERE b.id = ?`)
    .bind(bookingId)
    .first()

  if (!booking) {
    return c.json({ error: 'Unable to update booking' }, 500)
  }

  return c.json(booking)
})

app.delete('/bookings/:id', async (c) => {
  const bookingId = Number(c.req.param('id'))
  if (!Number.isInteger(bookingId) || bookingId < 1) {
    return c.json({ error: 'Booking id must be a positive integer' }, 400)
  }

  const booking = await c.env['DB']
    .prepare('SELECT equipment_id FROM bookings WHERE id = ?')
    .bind(bookingId)
    .first<{ equipment_id: number }>()

  if (!booking) {
    return c.json({ error: 'Booking not found' }, 404)
  }

  await c.env['DB'].batch([
    c.env['DB']
      .prepare(
        `UPDATE equipment
         SET available_quantity = MIN(quantity, available_quantity + 1)
         WHERE id = ?`,
      )
      .bind(booking.equipment_id),
    c.env['DB']
      .prepare('DELETE FROM bookings WHERE id = ?')
      .bind(bookingId),
  ])

  return c.body(null, 204)
})

export default app
