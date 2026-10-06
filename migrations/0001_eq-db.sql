-- Migration number: 0001 	 2026-10-06T06:45:18.703Z

PRAGMA foreign_keys = ON;

CREATE TABLE equipment (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  description TEXT,
  quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
  available_quantity INTEGER NOT NULL DEFAULT 1 CHECK (available_quantity >= 0),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  CHECK (available_quantity <= quantity)
);

CREATE TABLE bookings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  equipment_id INTEGER NOT NULL,
  borrower_name TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  purpose TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'returned', 'cancelled')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (equipment_id) REFERENCES equipment (id) ON DELETE RESTRICT,
  CHECK (date(end_date) >= date(start_date))
);

CREATE INDEX bookings_equipment_id_idx ON bookings (equipment_id);
CREATE INDEX bookings_status_idx ON bookings (status);
CREATE INDEX bookings_start_date_idx ON bookings (start_date);
