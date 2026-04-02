# Performance Baseline - 2026-03-29

- Base URL: `http://127.0.0.1:8000`
- Account used for authenticated scenarios: `ropv.hgi`
- Auth note: password was temporarily set only for the benchmark window and restored immediately after the run
- Result: all smoke and load targets passed their configured thresholds

## Smoke

| Target | p50 | p95 | p99 | Req/s |
| --- | ---: | ---: | ---: | ---: |
| `bootstrap` | 50.58 ms | 75.02 ms | 135.82 ms | 35.63 |
| `customers?page=1&per_page=50` | 142.31 ms | 194.84 ms | 215.17 ms | 27.25 |
| `projects?page=1&per_page=50` | 139.01 ms | 163.77 ms | 172.50 ms | 28.58 |
| `contracts?page=1&per_page=50` | 264.35 ms | 302.85 ms | 336.46 ms | 15.08 |
| `customer-request-cases?page=1&per_page=30` | 108.83 ms | 138.63 ms | 164.13 ms | 26.83 |

## Load

| Target | p50 | p95 | p99 | Req/s |
| --- | ---: | ---: | ---: | ---: |
| `customers?page=1&per_page=100` | 299.95 ms | 402.77 ms | 503.13 ms | 25.77 |
| `projects?page=1&per_page=100` | 308.70 ms | 412.12 ms | 488.77 ms | 25.17 |
| `contracts?page=1&per_page=100` | 549.35 ms | 633.25 ms | 668.61 ms | 14.63 |
| `customer-request-cases?page=1&per_page=50` | 217.44 ms | 266.53 ms | 303.37 ms | 27.17 |

## Artifacts

- `perf/baselines/baseline-2026-03-29.json`
- `perf/baselines/baseline-2026-03-29-smoke.raw.json`
- `perf/baselines/baseline-2026-03-29-load.raw.json`
