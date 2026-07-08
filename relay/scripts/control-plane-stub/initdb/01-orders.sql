-- Seed for the local customer PostgreSQL (relay-postgres) used by the relay's
-- demo execute path. Creates a small `orders` table the relay can read from.
CREATE TABLE IF NOT EXISTS orders (
  id          SERIAL PRIMARY KEY,
  status      TEXT NOT NULL DEFAULT 'pending',
  customer    TEXT,
  total_cents INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO orders (status, customer, total_cents)
SELECT
  CASE (i % 3) WHEN 0 THEN 'pending' WHEN 1 THEN 'paid' ELSE 'failed' END,
  'customer-' || i,
  (i * 1000)
FROM generate_series(1, 5) AS i
ON CONFLICT DO NOTHING;
