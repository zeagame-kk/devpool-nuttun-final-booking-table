-- +goose Up
CREATE TABLE reviews (
  id SERIAL PRIMARY KEY,
  restaurant_id INTEGER NOT NULL REFERENCES restaurants (id),
  user_id UUID NOT NULL REFERENCES users (id),
  rating SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment TEXT NOT NULL CHECK (btrim(comment) <> ''),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, restaurant_id)
);

CREATE INDEX idx_reviews_restaurant_id ON reviews (restaurant_id);

-- +goose Down
DROP TABLE IF EXISTS reviews;
