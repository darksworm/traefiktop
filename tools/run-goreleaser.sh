#!/usr/bin/env bash
set -euo pipefail

IMAGE_NAME=${IMAGE_NAME:-traefiktop-goreleaser:nightly}

echo "[prep] Ensuring buildx builder and binfmt are set up on host..." >&2
if ! docker buildx version >/dev/null 2>&1; then
  echo "docker buildx not available; please update your Docker Desktop/CLI" >&2
  exit 1
fi

# Install binfmt handlers for multi-arch if not already installed
if ! docker run --rm tonistiigi/binfmt --version >/dev/null 2>&1; then
  echo "[prep] Installing binfmt (requires privileged)..." >&2
  docker run --privileged --rm tonistiigi/binfmt --install arm64,amd64 || true
fi

# Ensure a builder exists and is selected
if ! docker buildx inspect grx >/dev/null 2>&1; then
  echo "[prep] Creating buildx builder 'grx'..." >&2
  docker buildx create --name grx --use >/dev/null
fi

echo "[build] Building ${IMAGE_NAME} (tools/goreleaser.Dockerfile)" >&2
docker build -f tools/goreleaser.Dockerfile -t "${IMAGE_NAME}" .

echo "[run] Running GoReleaser (snapshot, no publish) inside ${IMAGE_NAME}" >&2
docker run --rm \
  -v /var/run/docker.sock:/var/run/docker.sock \
  -v "$(pwd)":/work \
  -w /work \
  -e GITHUB_TOKEN=${GITHUB_TOKEN:-} \
  -e HOMEBREW_TAP_GITHUB_TOKEN=${HOMEBREW_TAP_GITHUB_TOKEN:-} \
  -e AUR_SSH_PRIVATE_KEY=${AUR_SSH_PRIVATE_KEY:-} \
  -e GPG_PRIVATE_KEY=${GPG_PRIVATE_KEY:-} \
  -e GPG_PRIVATE_KEY_PASSPHRASE=${GPG_PRIVATE_KEY_PASSPHRASE:-} \
  -e GPG_FINGERPRINT=${GPG_FINGERPRINT:-} \
  -e DOCKER_CLI_EXPERIMENTAL=enabled \
  "${IMAGE_NAME}" \
  bash -lc 'curl -sSfL https://goreleaser.com/static/run | GORELEASER_ALLOW_NIGHTLY=true GORELEASER_VERSION=nightly bash -s -- release --config .goreleaser.release.yml --clean --snapshot --skip=publish'
