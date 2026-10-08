-- +goose Up
CREATE TABLE restaurants (
  id SERIAL PRIMARY KEY,
  owner_id UUID NOT NULL REFERENCES users (id),
  name VARCHAR(255) NOT NULL,
  address TEXT NOT NULL,
  description TEXT,
  image_url TEXT,
  seating_capacity INTEGER NOT NULL CHECK (seating_capacity >= 1),
  cancellation_lead_minutes INTEGER NOT NULL CHECK (cancellation_lead_minutes >= 30),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_restaurants_owner_id ON restaurants (owner_id);

CREATE INDEX idx_restaurants_deleted_at ON restaurants (deleted_at);

-- +goose Down
DROP TABLE IF EXISTS restaurants;
