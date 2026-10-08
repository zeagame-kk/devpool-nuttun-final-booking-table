# syntax=docker/dockerfile:1.7

FROM golang:1.26.4-alpine AS builder

WORKDIR /src

# Install CA certificates and timezone data for HTTPS, Kafka TLS, Redis TLS,
# and time zone handling.
RUN apk add --no-cache \
  ca-certificates \
  tzdata

# Copy dependency files first to improve Docker layer caching.
COPY go.mod go.sum ./

RUN --mount=type=cache,target=/go/pkg/mod \
  go mod download

# Copy only the source required to build the application. The build context is
# further restricted by .dockerignore so local configuration and secrets never
# reach the Docker daemon.
COPY cmd/ ./cmd/
COPY internal/ ./internal/
COPY docs/*.go ./docs/

# The folder for uploaded pictures. The runtime image has no shell, so it is created here and
# copied over with the owner of the non-root user below; a fresh named volume mounted on it
# inherits that owner, which is what lets the API write to it.
RUN mkdir -p /out/uploads

# Build a statically linked Linux binary.
RUN --mount=type=cache,target=/root/.cache/go-build \
  --mount=type=cache,target=/go/pkg/mod \
  CGO_ENABLED=0 \
  GOOS=linux \
  go build \
  -trimpath \
  -ldflags="-s -w" \
  -o /out/api \
  ./cmd/api

FROM gcr.io/distroless/static-debian12:nonroot AS runtime

WORKDIR /app

# Distroless static includes CA certificates, but copying tzdata allows
# the application to load named time zones such as Asia/Bangkok.
COPY --from=builder /usr/share/zoneinfo /usr/share/zoneinfo
COPY --from=builder /out/api /app/api
COPY --from=builder --chown=65532:65532 /out/uploads /app/uploads

USER 65532:65532

ENTRYPOINT ["/app/api"]
