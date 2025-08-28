# Changelog

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
