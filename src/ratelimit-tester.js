#!/usr/bin/env node
/**
 * ratelimit-tester.js
 * Stress test API rate limits and generate detailed reports.
 *
 * Usage:
 *   node src/ratelimit-tester.js --url https://api.example.com/endpoint
 *   node src/ratelimit-tester.js --url https://api.example.com/endpoint --rps 50 --duration 30
 *   node src/ratelimit-tester.js --url https://api.example.com/endpoint --output report.json
 */

'use strict';

const http  = require('http');
const https = require('https');
const fs    = require('fs');
const url   = require('url');

// ── Args ────────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
function getArg(n, d = null) { const i = args.indexOf(n); return i !== -1 && args[i+1] ? args[i+1] : d; }
function hasFlag(n) { return args.includes(n); }

const TARGET_URL   = getArg('--url');
const METHOD       = getArg('--method', 'GET');
const RPS          = parseFloat(getArg('--rps', '10'));
const DURATION     = parseInt(getArg('--duration', '10'), 10);
const CONCURRENCY  = parseInt(getArg('--concurrency', '5'), 10);
const OUTPUT       = getArg('--output');
const FORMAT       = getArg('--format', 'text');
const BODY         = getArg('--body', '');
const STOP_ON_LIMIT = hasFlag('--stop-on-limit');

// Custom headers
const HEADERS = {};
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--header' && args[i+1]) {
    const [k, ...v] = args[i+1].split(':');
    HEADERS[k.trim()] = v.join(':').trim();
    i++;
  }
}

// ── Colors ──────────────────────────────────────────────────────────────────
const C = { green: '\x1b[32m', red: '\x1b[31m', yellow: '\x1b[33m', cyan: '\x1b[36m', bold: '\x1b[1m', reset: '\x1b[0m' };

// ── HTTP helper ──────────────────────────────────────────────────────────────
function makeRequest(targetUrl) {
  return new Promise((resolve) => {
    const start = Date.now();
    try {
      const parsed = new url.URL(targetUrl);
      const lib = parsed.protocol === 'https:' ? https : http;
      const opts = {
        hostname: parsed.hostname,
        port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
        path: parsed.pathname + parsed.search,
        method: METHOD,
        headers: {
          'User-Agent': 'ratelimit-tester/1.0.0',
          'Accept': 'application/json',
          ...HEADERS,
        },
        timeout: 15000,
      };
      if (BODY) opts.headers['Content-Length'] = Buffer.byteLength(BODY);

      const req = lib.request(opts, (res) => {
        const chunks = [];
        res.on('data', c => chunks.push(c));
        res.on('end', () => {
          const latency = Date.now() - start;
          const rateLimitHeaders = {};
          ['x-ratelimit-limit','x-ratelimit-remaining','x-ratelimit-reset',
           'x-rate-limit-limit','x-rate-limit-remaining','retry-after',
           'ratelimit-limit','ratelimit-remaining','ratelimit-reset'].forEach(h => {
            if (res.headers[h] !== undefined) rateLimitHeaders[h] = res.headers[h];
          });
          resolve({ status: res.statusCode, latency, rateLimitHeaders });
        });
      });
      req.on('error', () => resolve({ status: 0, latency: Date.now() - start, error: true, rateLimitHeaders: {} }));
      req.on('timeout', () => { req.destroy(); resolve({ status: 0, latency: Date.now() - start, timeout: true, rateLimitHeaders: {} }); });
      if (BODY) req.write(BODY);
      req.end();
    } catch (e) {
      resolve({ status: 0, latency: Date.now() - start, error: true, rateLimitHeaders: {} });
    }
  });
}

// ── Stats helpers ────────────────────────────────────────────────────────────
function percentile(arr, p) {
  const sorted = [...arr].sort((a, b) => a - b);
  const i = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, i)];
}

function avg(arr) {
  return arr.length === 0 ? 0 : Math.round(arr.reduce((a, b) => a + b, 0) / arr.length);
}

// ── Spinner ──────────────────────────────────────────────────────────────────
const SPIN = ['⠋','⠙','⠹','⠸','⠼','⠴','⠦','⠧','⠇','⠏'];
let spinIdx = 0;
function spin(msg) {
  process.stdout.write(`\r${SPIN[spinIdx++ % SPIN.length]} ${msg}`);
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  if (!TARGET_URL) {
    console.log('ratelimit-tester v1.0.0');
    console.log('Usage: node src/ratelimit-tester.js --url <url> [--rps 10] [--duration 10] [--concurrency 5]');
    process.exit(0);
  }

  console.log(`\n${C.bold}ratelimit-tester v1.0.0${C.reset}`);
  console.log(`Testing: ${TARGET_URL}`);
  console.log(`Method: ${METHOD} · RPS: ${RPS} · Duration: ${DURATION}s · Concurrency: ${CONCURRENCY}`);
  console.log('');

  const results = [];
  const allRateLimitHeaders = {};
  const intervalMs = 1000 / RPS;
  const endTime = Date.now() + (DURATION * 1000);
  let stopped = false;

  const queue = [];
  let sent = 0;
  let rateLimited = 0;

  const timer = setInterval(() => {
    if (Date.now() >= endTime || stopped) { clearInterval(timer); return; }
    const batch = [];
    for (let i = 0; i < CONCURRENCY && Date.now() < endTime && !stopped; i++) {
      batch.push(makeRequest(TARGET_URL).then(r => {
        results.push(r);
        Object.assign(allRateLimitHeaders, r.rateLimitHeaders);
        if (r.status === 429) {
          rateLimited++;
          if (STOP_ON_LIMIT) { stopped = true; }
        }
        sent++;
      }));
    }
    queue.push(...batch);
  }, intervalMs * CONCURRENCY);

  const spinTimer = setInterval(() => {
    const elapsed = Math.min(DURATION, Math.round((Date.now() - (endTime - DURATION * 1000)) / 1000));
    spin(`Sending ${RPS} req/s — ${elapsed}/${DURATION}s — ${sent} sent, ${rateLimited} rate limited`);
  }, 100);

  await new Promise(resolve => {
    const check = setInterval(() => {
      if (Date.now() >= endTime || stopped) {
        clearInterval(timer);
        clearInterval(spinTimer);
        clearInterval(check);
        Promise.all(queue).then(resolve);
      }
    }, 100);
  });

  process.stdout.write('\r' + ' '.repeat(70) + '\r');

  // ── Stats ─────────────────────────────────────────────────────────────────
  const total    = results.length;
  const success  = results.filter(r => r.status >= 200 && r.status < 300).length;
  const limited  = results.filter(r => r.status === 429).length;
  const errors   = results.filter(r => r.status >= 500 || r.status === 0).length;
  const latencies = results.filter(r => r.latency).map(r => r.latency);

  const report = {
    url: TARGET_URL,
    method: METHOD,
    config: { rps: RPS, duration: DURATION, concurrency: CONCURRENCY },
    results: {
      total, success, rateLimited: limited, errors,
      successRate: total ? ((success / total) * 100).toFixed(1) + '%' : '0%',
      rateLimitRate: total ? ((limited / total) * 100).toFixed(1) + '%' : '0%',
    },
    latency: {
      avg: avg(latencies),
      p50: percentile(latencies, 50),
      p95: percentile(latencies, 95),
      p99: percentile(latencies, 99),
      min: Math.min(...latencies),
      max: Math.max(...latencies),
    },
    rateLimitHeaders: allRateLimitHeaders,
    timestamp: new Date().toISOString(),
  };

  // ── Print ──────────────────────────────────────────────────────────────────
  console.log(`${C.bold}Results:${C.reset}`);
  console.log(`  Total requests:      ${total}`);
  console.log(`  ${C.green}Successful (2xx):    ${success}${C.reset}`);
  console.log(`  ${C.yellow}Rate limited (429):  ${limited}${C.reset}`);
  console.log(`  ${C.red}Errors (5xx/0):      ${errors}${C.reset}`);
  console.log(`  Success rate:        ${report.results.successRate}`);
  console.log(`  Rate limit rate:     ${report.results.rateLimitRate}`);
  console.log('');
  console.log(`${C.bold}Latency:${C.reset}`);
  console.log(`  Avg:  ${report.latency.avg}ms`);
  console.log(`  P50:  ${report.latency.p50}ms`);
  console.log(`  P95:  ${report.latency.p95}ms`);
  console.log(`  P99:  ${report.latency.p99}ms`);
  console.log(`  Min:  ${report.latency.min}ms  Max: ${report.latency.max}ms`);

  const rlKeys = Object.keys(allRateLimitHeaders);
  if (rlKeys.length > 0) {
    console.log('');
    console.log(`${C.bold}Rate Limit Headers Detected:${C.reset}`);
    rlKeys.forEach(k => console.log(`  ${k}: ${allRateLimitHeaders[k]}`));
  } else {
    console.log(`\n  ${C.yellow}No rate limit headers detected in responses.${C.reset}`);
  }

  if (limited > 0) {
    const estimate = Math.round((success / DURATION) * 60);
    console.log(`\n${C.cyan}Estimate: ~${estimate} requests/min before throttling${C.reset}`);
  }

  if (OUTPUT) {
    if (FORMAT === 'html') {
      const html = `<!DOCTYPE html><html><head><title>ratelimit-tester report</title>
<style>body{font-family:monospace;padding:2rem;max-width:800px}table{border-collapse:collapse;width:100%}td,th{padding:8px;border:1px solid #ddd}.good{color:green}.bad{color:red}.warn{color:orange}</style>
</head><body><h1>ratelimit-tester Report</h1>
<p><strong>URL:</strong> ${report.url}</p>
<p><strong>Tested:</strong> ${report.timestamp}</p>
<h2>Results</h2>
<table><tr><td>Total</td><td>${report.results.total}</td></tr>
<tr><td class="good">Success (2xx)</td><td class="good">${report.results.success}</td></tr>
<tr><td class="warn">Rate Limited (429)</td><td class="warn">${report.results.rateLimited}</td></tr>
<tr><td class="bad">Errors</td><td class="bad">${report.results.errors}</td></tr></table>
<h2>Latency</h2>
<table><tr><td>Avg</td><td>${report.latency.avg}ms</td></tr>
<tr><td>P95</td><td>${report.latency.p95}ms</td></tr>
<tr><td>P99</td><td>${report.latency.p99}ms</td></tr></table>
<h2>Rate Limit Headers</h2>
<pre>${JSON.stringify(report.rateLimitHeaders, null, 2)}</pre>
</body></html>`;
      fs.writeFileSync(OUTPUT, html);
    } else {
      fs.writeFileSync(OUTPUT, JSON.stringify(report, null, 2));
    }
    console.log(`\nReport saved: ${OUTPUT}`);
  }
}

main().catch(e => { console.error(e.message); process.exit(1); });
