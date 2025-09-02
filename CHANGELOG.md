# Changelog

## [2.0.0](https://github.com/darksworm/traefiktop/compare/v1.2.0...v2.0.0) (2025-09-02)


### ⚠ BREAKING CHANGES

* The application is now distributed as a native Rust binary instead of a Node.js package. Users must switch from npm installation to binary installation methods (Homebrew, direct download, or package managers).

### Features

* add refresh shortcut and legend ([6c9a186](https://github.com/darksworm/traefiktop/commit/6c9a186449903335a637c947f6475b8fb81d7e90))
* migrated to rust ([993e9fd](https://github.com/darksworm/traefiktop/commit/993e9fd57b43ba3341294d45fe2c6fb08369005a))

## [1.2.0](https://github.com/darksworm/traefiktop/compare/v1.1.1...v1.2.0) (2025-08-30)


### Features

* **docker:** multi-stage Dockerfile (Alpine runtime), .dockerignore, scripts; CI buildx/QEMU + GHCR login; docs ([36ca3ba](https://github.com/darksworm/traefiktop/commit/36ca3ba1909accd24c93f48cff89a138c9a7eadc))
* **goreleaser:** migrate to dockers_v2 with multi-arch buildx (single tag + manifest) ([7026f51](https://github.com/darksworm/traefiktop/commit/7026f514bfc2e94e796ae6f240c6b4b16ff8ebb1))
* **goreleaser:** switch to dockers_v2 with multi-arch buildx (single tag), add v2 Dockerfile using TARGETPLATFORM layout ([7e145b6](https://github.com/darksworm/traefiktop/commit/7e145b6c61ffd61b8adb4c3ccd9e520b2bc38870))


### Bug Fixes

* **goreleaser v2:** use 'images' (plural) in dockers_v2 schema ([8821e50](https://github.com/darksworm/traefiktop/commit/8821e50e33bdc4efde0fb706f55565c6645a75ac))
* **goreleaser:** hardcode GHCR in docker image/manifests to avoid missing REGISTRY env ([22c670e](https://github.com/darksworm/traefiktop/commit/22c670e431958fa4332a8d0c20285193bbd98799))
* **goreleaser:** remove unsupported default() template; use if/else for REGISTRY; docs: add Docker install option ([14a5fe9](https://github.com/darksworm/traefiktop/commit/14a5fe99008b59fda2da33ea519c671a762e0614))
* **goreleaser:** use runtime-only Dockerfile that copies prebuilt binary (no source context) ([6397ecb](https://github.com/darksworm/traefiktop/commit/6397ecb81ec3347cb114ffd1a497463ebd9781cb))


### Reverts

* **goreleaser:** fallback to dockers + docker_manifests until dockers_v2 lands in v2.12 nightly ([bac3221](https://github.com/darksworm/traefiktop/commit/bac322168bf1bb34af31eb58cb6ad97228953ff7))

## [1.1.1](https://github.com/darksworm/traefiktop/compare/v1.1.0...v1.1.1) (2025-08-28)


### Bug Fixes

* remove 'bun run logs' references from user-facing messages ([d339a9e](https://github.com/darksworm/traefiktop/commit/d339a9ebc0be6237de2c33989a34dfccd65053b1))

## [1.1.0](https://github.com/darksworm/traefiktop/compare/v1.0.1...v1.1.0) (2025-08-28)


### Features

* **cli:** implement --tail-logs (with optional --session) and document in --help ([aee1341](https://github.com/darksworm/traefiktop/commit/aee134153c85b97c5cf34c48913b6a2392c96820))


### Bug Fixes

* **npm:** add bin mapping and files list so global install provides 'traefiktop' CLI ([067f71e](https://github.com/darksworm/traefiktop/commit/067f71e2f54abf951c2fc6a12a42345ff4bd27c9))
* remove stale --tail-logs references in messages; point to 'bun run logs' ([d07c9c0](https://github.com/darksworm/traefiktop/commit/d07c9c07348c9e36c14466114a001089a5d32210))


### Reverts

* **cli:** remove --tail-logs and related help to restore single-bundle build ([fcf2a08](https://github.com/darksworm/traefiktop/commit/fcf2a0894a5229081f57c79b2866b4b448df9943))

## [1.0.1](https://github.com/darksworm/traefiktop/compare/v1.0.0...v1.0.1) (2025-08-28)


### Bug Fixes

* make package public ([de2c7ff](https://github.com/darksworm/traefiktop/commit/de2c7ff0f2585f463aba49157495f1f5e805f177))

## 1.0.0 (2025-08-28)


### Features

* add refresh (r) to re-fetch Traefik data ([81851f8](https://github.com/darksworm/traefiktop/commit/81851f8bccfc31485b62a2c1919fb61886df9d05))
* auto-refresh every 10s and green flash for manual refresh ([65488b2](https://github.com/darksworm/traefiktop/commit/65488b2aa64fe8278705c1bea44876736ffefcce))
* CLI flags, sorting, and UI clarity\n\n- Add required --host and --ignore patterns (supports prefix/suffix/contains)\n- Add sorting (dead-first default, toggle with 's'; also 'n'/'d')\n- Improve scrolling: height-aware windowing; full visibility for selection\n- Navigation: gg/G, Home/End, PageUp/Down, j/k, arrows\n- Simplify visuals: minimal emojis, grey inactive; strong selection contrast\n- Router status: skull and red name only when down\n- Failover header styled (magenta dim)\n\nchore: repo rename + build/release cleanup\n\n- Rename Argonaut references to traefik-tui (logs, version check, install)\n- Update GoReleaser for multi-target (brew cask, AUR, Nix, NFPM)\n- Remove license generation steps and references\n- Prune unused deps; fix rollup config; exclude tests from TS build\n- Lint fixes and small TS guard in mapping\n- Rewrite README for this project\n- Add AGENTS.md contributor guide ([f64617a](https://github.com/darksworm/traefiktop/commit/f64617ad8a378ede6d802fe0dc062b67c4f7d3a0))
* Implement Traefik TUI core features ([838930e](https://github.com/darksworm/traefiktop/commit/838930e3a6e158fc89b6957b858cd3766416be5b))
* Implement UI improvements ([b66a97c](https://github.com/darksworm/traefiktop/commit/b66a97c03e6b8270671c681b460cf9b9148addab))
* **security:** gate TLS disable behind --insecure flag and TRAEFIKTOP_INSECURE; secure by default ([f3de818](https://github.com/darksworm/traefiktop/commit/f3de81807fba2e1db069199c6e41e3e439f057be))
* **ui:** add refresh hint and flash; 'r' shows 'Refreshed' ([b25d6b2](https://github.com/darksworm/traefiktop/commit/b25d6b22bc27a08e75e1ad4b42e1dd15c43bf763))


### Bug Fixes

* Clear search query on escape ([dca0a05](https://github.com/darksworm/traefiktop/commit/dca0a05452505480566bf621104feeb67f7278cb))
* dumb spacing issues ([7560aad](https://github.com/darksworm/traefiktop/commit/7560aadcd7d7298183565413e538feee8be1bd32))


### Reverts

* Use mock data for API calls ([a5897de](https://github.com/darksworm/traefiktop/commit/a5897de8e57e3d2ca751583f3bf9f1e820f2b5a3))
