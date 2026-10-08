-- +goose Up
-- A reservation covers [start_at, end_at). Cancelling sets status; rows are never deleted.
CREATE TABLE reservations (
  id SERIAL PRIMARY KEY,
  restaurant_id INTEGER NOT NULL REFERENCES restaurants (id),
  user_id UUID NOT NULL REFERENCES users (id),
  start_at TIMESTAMPTZ NOT NULL,
  end_at TIMESTAMPTZ NOT NULL,
  guests INTEGER NOT NULL CHECK (guests >= 1),
  status VARCHAR(20) NOT NULL DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (end_at > start_at)
);

CREATE INDEX idx_reservations_restaurant_start ON reservations (restaurant_id, start_at);

CREATE INDEX idx_reservations_user_start ON reservations (user_id, start_at);

-- +goose Down
DROP TABLE IF EXISTS reservations;
