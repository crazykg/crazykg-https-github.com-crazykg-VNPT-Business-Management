# Post-Upgrade Performance Comparison - 2026-03-29

- Base URL: `http://127.0.0.1:8000`
- Account used for authenticated scenarios: `ropv.hgi`
- Redis note: local Redis was installed via Homebrew and started successfully on `127.0.0.1:6379`
- Auth note: password was temporarily set only for the benchmark window and restored immediately after the run
- Result: all smoke and load targets passed their configured thresholds; after a targeted rerun for `projects` following the list-cache optimization, all tracked targets improved in p95 and all tracked targets improved or held throughput versus baseline.
- Projects note: the final `projects` figures below come from `post-upgrade-2026-03-29-projects-smoke.raw.json` and `post-upgrade-2026-03-29-projects-load.raw.json`.

## Smoke

| Target | Baseline p95 | Post-upgrade p95 | Delta | Baseline req/s | Post-upgrade req/s | Delta |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| `bootstrap` | 75.02 ms | 41.86 ms | -33.16 ms | 35.63 | 58.38 | +22.75 |
| `customers?page=1&per_page=50` | 194.84 ms | 122.70 ms | -72.14 ms | 27.25 | 38.58 | +11.33 |
| `projects?page=1&per_page=50` | 163.77 ms | 66.11 ms | -97.66 ms | 28.58 | 77.58 | +49.00 |
| `contracts?page=1&per_page=50` | 302.85 ms | 277.84 ms | -25.01 ms | 15.08 | 19.67 | +4.59 |
| `customer-request-cases?page=1&per_page=30` | 138.63 ms | 107.04 ms | -31.59 ms | 26.83 | 33.58 | +6.75 |

## Load

| Target | Baseline p95 | Post-upgrade p95 | Delta | Baseline req/s | Post-upgrade req/s | Delta |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| `customers?page=1&per_page=100` | 402.77 ms | 371.17 ms | -31.60 ms | 25.77 | 30.27 | +4.50 |
| `projects?page=1&per_page=100` | 412.12 ms | 123.71 ms | -288.41 ms | 25.17 | 77.80 | +52.63 |
| `contracts?page=1&per_page=100` | 633.25 ms | 524.53 ms | -108.72 ms | 14.63 | 17.23 | +2.60 |
| `customer-request-cases?page=1&per_page=50` | 266.53 ms | 228.86 ms | -37.67 ms | 27.17 | 30.80 | +3.63 |

## Artifacts

- `perf/baselines/baseline-2026-03-29.json`
- `perf/baselines/post-upgrade-2026-03-29-smoke.raw.json`
- `perf/baselines/post-upgrade-2026-03-29-load.raw.json`
- `perf/baselines/post-upgrade-2026-03-29-projects-smoke.raw.json`
- `perf/baselines/post-upgrade-2026-03-29-projects-load.raw.json`
- `perf/baselines/post-upgrade-2026-03-29-summary.md`
