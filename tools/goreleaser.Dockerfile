FROM oven/bun:alpine

RUN apk add --no-cache \
    bash \
    ca-certificates \
    curl \
    git \
    coreutils \
    docker-cli \
    docker-cli-buildx \
  && update-ca-certificates

WORKDIR /work
