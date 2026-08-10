# Changelog

All notable changes to **ratelimit-tester** will be documented here.
Format based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [Unreleased]

## [1.0.0] - 2025-01-01
### Added
- Configurable burst testing: RPS, duration, concurrency
- Rate limit header detection (X-RateLimit-*, Retry-After)
- Window type detection (rolling vs fixed)
- Latency percentiles: avg, P95, P99
- Report export: JSON, CSV, HTML formats
- Custom headers for authenticated API testing
- `--stop-on-limit` flag for safe testing
- Backoff strategy testing (exponential, linear)
- Achievement tracker and roadmap scripts
- GitHub Actions CI workflow
- Devcontainer configuration for Codespaces
