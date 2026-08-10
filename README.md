# ratelimit-tester

![CI](https://github.com/YOUR_USERNAME/ratelimit-tester/actions/workflows/ci.yml/badge.svg)
![npm version](https://img.shields.io/npm/v/ratelimit-tester)
![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)
![Node.js](https://img.shields.io/badge/node-%3E%3D20-brightgreen)

> Stress test API rate limits and **generate detailed reports** — discover your limits before production does.

## Features

- 🚀 **Burst testing** — hammer an endpoint to find the rate limit ceiling
- 📊 **Detailed reports** — requests/sec, 429 rate, retry-after analysis
- 🕐 **Window detection** — auto-detect rolling vs fixed windows
- 🔄 **Backoff strategies** — test exponential, linear, and custom retry logic
- 📈 **CSV/JSON/HTML reports** — shareable results for your team
- 🎯 **Header analysis** — parse X-RateLimit-* and Retry-After headers
- ⚙️ **Configurable** — concurrency, duration, request rate, headers

## Installation

```bash
git clone https://github.com/YOUR_USERNAME/ratelimit-tester.git
cd ratelimit-tester
npm install
bash scripts/setup.sh
```

## Quick Start

```bash
# Basic rate limit test
node src/ratelimit-tester.js --url https://api.example.com/endpoint

# Aggressive burst test
node src/ratelimit-tester.js --url https://api.example.com/endpoint --rps 100 --duration 30

# With auth header
node src/ratelimit-tester.js --url https://api.example.com/me --header "Authorization: Bearer TOKEN"
```

## Usage

### Basic Test
```bash
node src/ratelimit-tester.js --url https://api.example.com/endpoint
```

### Burst Test
```bash
node src/ratelimit-tester.js \
  --url https://api.example.com/endpoint \
  --rps 50 \
  --duration 60 \
  --concurrency 10
```

### Test with Custom Headers
```bash
node src/ratelimit-tester.js \
  --url https://api.example.com/data \
  --header "Authorization: Bearer mytoken" \
  --header "X-API-Key: mykey"
```

### Export Report
```bash
node src/ratelimit-tester.js --url https://api.example.com/endpoint --output report.json
node src/ratelimit-tester.js --url https://api.example.com/endpoint --output report.html --format html
```

## Options

| Flag | Default | Description |
|------|---------|-------------|
| `--url` | — | API endpoint to test (required) |
| `--method` | `GET` | HTTP method |
| `--rps` | `10` | Requests per second |
| `--duration` | `10` | Test duration in seconds |
| `--concurrency` | `5` | Concurrent workers |
| `--header` | — | HTTP header (repeatable) |
| `--body` | — | Request body (for POST/PUT) |
| `--output` | — | Save report to file |
| `--format` | `text` | `text`, `json`, `csv`, `html` |
| `--stop-on-limit` | `false` | Stop when rate limited |

## Example Output

```
ratelimit-tester v1.0.0
Testing: https://api.example.com/endpoint

⠼ Sending 10 req/s for 10s...

Results:
  Total requests:    100
  Successful (2xx):  87
  Rate limited (429): 13
  Errors (5xx):        0

  Requests/sec:      10.0
  Avg latency:      142ms
  P95 latency:      310ms
  P99 latency:      580ms

Rate Limit Headers Detected:
  X-RateLimit-Limit:     100
  X-RateLimit-Remaining: 0
  X-RateLimit-Reset:     1704067200
  Retry-After:           60

Estimate: ~87 req/min before throttling
```

## npm Scripts

| Command | Description |
|---------|-------------|
| `npm start` | Run ratelimit-tester |
| `npm run test:api` | Alias for start |
| `npm test` | Run unit tests |
| `npm run tracker` | Show achievement progress |
| `npm run roadmap` | Show Day 1 → Month 1 roadmap |

## Achievement Scripts

```bash
bash scripts/unlock-all.sh
bash scripts/quickdraw.sh
bash scripts/yolo.sh
bash scripts/publicist.sh
bash scripts/pull-shark.sh 16
bash scripts/pair-extraordinaire.sh "Name" "email@example.com"
```

## License

MIT — see [LICENSE](LICENSE)
