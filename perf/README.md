# Performance Test Guide

Thu muc `perf/` chua bo kiem thu hieu nang API o muc smoke/load, co dang nhap that vao he thong va giu cookie phien nhu frontend.

## Chay nhanh

Tai root repo:

```bash
cd /Users/pvro86gmail.com/Downloads/QLCV/perf
npm run smoke
```

Neu backend dang chay o URL khac hoac muon dung tai khoan khac:

```bash
cd /Users/pvro86gmail.com/Downloads/QLCV/perf
PERF_BASE_URL=http://127.0.0.1:8002 \
PERF_USERNAME=admin.demo \
PERF_PASSWORD=password \
npm run smoke
```

Mac dinh:

- `PERF_BASE_URL`: doc tu `backend/.env` (`APP_URL`) neu co, neu khong thi fallback `http://127.0.0.1:8000`
- `PERF_USERNAME`: `admin.demo`
- `PERF_PASSWORD`: `password`

Luu y:

- `admin.demo/password` chi la mac dinh phu hop voi demo seeder trong repo. Neu moi truong cua anh/chị khac, hay dat `PERF_USERNAME` va `PERF_PASSWORD`.
- Tai khoan phai co quyen truy cap cac endpoint duoc chon. Neu khong, script se bao `non2xx`.

## Cac kieu chay

Smoke test nhanh:

```bash
npm run smoke
```

Scenario theo module:

```bash
npm run contracts
npm run customer-request-cases
npm run dashboard
```

Baseline public khong can dang nhap:

```bash
npm run public
```

Load test dai hon:

```bash
npm run load
```

Chi test mot vai target:

```bash
npm run smoke -- customers,contracts
```

Hoac:

```bash
PERF_ONLY=customers,customer-request-cases npm run load
```

Override ID mau cho scenario detail:

```bash
PERF_CONTRACT_ID=123 npm run contracts
PERF_CASE_ID=456 npm run customer-request-cases
PERF_CUSTOMER_REQUEST_ID=789 npm run dashboard
```

## Xuat bao cao JSON

```bash
PERF_OUTPUT=../test-results/perf-smoke.json npm run smoke
```

## Cac metric script dang do

- `avg`, `p50`, `p95`, `p99` latency
- throughput (`req/s`)
- bang thong doc response (`B/s`)
- `non2xx`, `errors`, `timeouts`
- kiem tra threshold theo tung target

## Chinh sua kich ban

File `scenarios.mjs` chua:

- danh sach endpoint
- `connections`
- `durationSeconds`
- `timeoutMs`
- `maxP95Ms`
- `minRequestsPerSecond`
- `maxErrorRate`

Neu can benchmark module khac, chi viec them target moi vao file nay.
