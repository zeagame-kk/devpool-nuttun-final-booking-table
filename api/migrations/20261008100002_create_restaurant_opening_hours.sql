-- +goose Up
-- One row per open weekday (0 = Sunday ... 6 = Saturday); a weekday without a row means closed.
-- Rows are replaced as a set, so there is no deleted_at.
CREATE TABLE restaurant_opening_hours (
  restaurant_id INTEGER NOT NULL REFERENCES restaurants (id),
  weekday SMALLINT NOT NULL CHECK (weekday BETWEEN 0 AND 6),
  open_time TIME NOT NULL,
  close_time TIME NOT NULL,
  PRIMARY KEY (restaurant_id, weekday),
  CHECK (close_time > open_time)
);

-- +goose Down
DROP TABLE IF EXISTS restaurant_opening_hours;
