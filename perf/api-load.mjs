import { readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { performance } from 'node:perf_hooks';
import { fileURLToPath } from 'node:url';

import { scenarios } from './scenarios.mjs';

const DEFAULT_TIMEOUT_MS = 30000;
const DEFAULT_SCENARIO = 'smoke';
const DEFAULT_USERNAME = process.env.PERF_USERNAME || 'admin.demo';
const DEFAULT_PASSWORD = process.env.PERF_PASSWORD || 'password';
const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, '..');

const isTruthy = (value) => ['1', 'true', 'yes', 'y', 'on'].includes(String(value || '').trim().toLowerCase());

class CookieJar {
  #cookies = new Map();

  updateFromHeaders(headers) {
    for (const setCookie of getSetCookieHeaders(headers)) {
      const [cookiePair] = String(setCookie).split(';');
      const separatorIndex = cookiePair.indexOf('=');
      if (separatorIndex <= 0) {
        continue;
      }

      const key = cookiePair.slice(0, separatorIndex).trim();
      const value = cookiePair.slice(separatorIndex + 1).trim();
      if (key !== '' && value !== '') {
        this.#cookies.set(key, value);
      }
    }
  }

  toHeader() {
    return Array.from(this.#cookies.entries())
      .map(([name, value]) => `${name}=${value}`)
      .join('; ');
  }
}

const parseCliArgs = () => {
  const [, , maybeScenario, ...rest] = process.argv;
  const scenarioName = maybeScenario && !maybeScenario.startsWith('--')
    ? maybeScenario
    : DEFAULT_SCENARIO;

  const requestedTargets = rest
    .flatMap((value) => String(value).split(','))
    .map((value) => value.trim())
    .filter(Boolean);

  return { scenarioName, requestedTargets };
};

const parseEnvFile = async (filePath) => {
  try {
    const contents = await readFile(filePath, 'utf8');
    const entries = {};

    for (const rawLine of contents.split(/\r?\n/u)) {
      const line = rawLine.trim();
      if (line === '' || line.startsWith('#')) {
        continue;
      }

      const separatorIndex = line.indexOf('=');
      if (separatorIndex <= 0) {
        continue;
      }

      const key = line.slice(0, separatorIndex).trim();
      const rawValue = line.slice(separatorIndex + 1).trim();
      entries[key] = rawValue.replace(/^"(.*)"$/u, '$1');
    }

    return entries;
  } catch {
    return {};
  }
};

const resolveBaseUrl = async () => {
  if (process.env.PERF_BASE_URL) {
    return process.env.PERF_BASE_URL;
  }

  const backendEnv = await parseEnvFile(path.join(REPO_ROOT, 'backend', '.env'));
  if (backendEnv.APP_URL) {
    return backendEnv.APP_URL;
  }

  const backendEnvExample = await parseEnvFile(path.join(REPO_ROOT, 'backend', '.env.example'));
  if (backendEnvExample.APP_URL) {
    return backendEnvExample.APP_URL;
  }

  return 'http://127.0.0.1:8000';
};

const getSetCookieHeaders = (headers) => {
  if (typeof headers.getSetCookie === 'function') {
    return headers.getSetCookie();
  }

  const combined = headers.get('set-cookie');
  if (!combined) {
    return [];
  }

  return String(combined).split(/,(?=\s*[!#$%&'*+\-.^_`|~0-9A-Za-z]+=)/u);
};

const parseJsonSafely = async (response) => {
  try {
    return await response.json();
  } catch {
    return null;
  }
};

const resolveJsonPath = (input, pathExpression) => {
  if (!pathExpression) {
    return input;
  }

  const normalizedPath = String(pathExpression)
    .replace(/\[(\d+)\]/gu, '.$1')
    .split('.')
    .map((segment) => segment.trim())
    .filter(Boolean);

  return normalizedPath.reduce((currentValue, segment) => {
    if (currentValue === null || typeof currentValue === 'undefined') {
      return undefined;
    }

    if (Array.isArray(currentValue)) {
      const index = Number(segment);
      return Number.isInteger(index) ? currentValue[index] : undefined;
    }

    if (typeof currentValue === 'object') {
      return currentValue[segment];
    }

    return undefined;
  }, input);
};

const replacePlaceholders = (template, values) =>
  String(template).replace(/\{\{\s*([^}\s]+)\s*\}\}/gu, (fullMatch, key) => {
    const resolvedValue = values[key];
    return resolvedValue === undefined || resolvedValue === null || resolvedValue === ''
      ? fullMatch
      : String(resolvedValue);
  });

const makeRequest = async (url, { method = 'GET', headers = {}, body, cookieHeader, timeoutMs = DEFAULT_TIMEOUT_MS } = {}) => {
  const requestHeaders = new Headers(headers);
  if (!requestHeaders.has('Accept')) {
    requestHeaders.set('Accept', 'application/json');
  }
  if (cookieHeader) {
    requestHeaders.set('Cookie', cookieHeader);
  }

  return fetch(url, {
    method,
    headers: requestHeaders,
    body,
    signal: AbortSignal.timeout(timeoutMs),
  });
};

const formatErrorMessage = async (response, fallback) => {
  const payload = await parseJsonSafely(response);
  return payload?.message || `${fallback} (${response.status})`;
};

const resolveDiscoveryValue = async ({
  resolver,
  baseUrl,
  cookieHeader,
  timeoutMs,
  discoveryCache,
}) => {
  if (resolver.env) {
    const envValue = process.env[resolver.env];
    if (envValue && String(envValue).trim() !== '') {
      return String(envValue).trim();
    }
  }

  const cacheKey = resolver.cacheKey || `${resolver.sourcePath}|${resolver.jsonPath || ''}`;
  if (discoveryCache.has(cacheKey)) {
    return discoveryCache.get(cacheKey);
  }

  const discoveryResponse = await makeRequest(new URL(resolver.sourcePath, baseUrl), {
    cookieHeader,
    timeoutMs,
  });
  const discoveryPayload = await parseJsonSafely(discoveryResponse);

  if (!discoveryResponse.ok) {
    const message = discoveryPayload?.message || `Discovery failed (${discoveryResponse.status})`;
    throw new Error(message);
  }

  const resolvedValue = resolveJsonPath(discoveryPayload, resolver.jsonPath);
  if (resolvedValue === undefined || resolvedValue === null || resolvedValue === '') {
    return null;
  }

  const normalizedValue = String(resolvedValue).trim();
  discoveryCache.set(cacheKey, normalizedValue);

  return normalizedValue;
};

const prepareTarget = async ({
  target,
  baseUrl,
  cookieHeader,
  timeoutMs,
  discoveryCache,
}) => {
  const placeholderEntries = Object.entries(target.placeholders || {});
  if (placeholderEntries.length === 0) {
    return {
      target,
      skipped: false,
    };
  }

  const resolvedValues = {};
  for (const [placeholderName, resolver] of placeholderEntries) {
    const resolvedValue = await resolveDiscoveryValue({
      resolver,
      baseUrl,
      cookieHeader,
      timeoutMs,
      discoveryCache,
    });

    if (resolvedValue === null) {
      return {
        target,
        skipped: true,
        skipReason: `Khong tim thay gia tri cho ${placeholderName}. Dat ${resolver.env || placeholderName} hoac dam bao API list co du lieu.`,
      };
    }

    resolvedValues[placeholderName] = resolvedValue;
  }

  const resolvedPath = replacePlaceholders(target.path, resolvedValues);
  if (/\{\{.+\}\}/u.test(resolvedPath)) {
    return {
      target,
      skipped: true,
      skipReason: 'Con placeholder chua duoc resolve trong path.',
    };
  }

  return {
    target: {
      ...target,
      path: resolvedPath,
      resolvedPlaceholders: resolvedValues,
    },
    skipped: false,
  };
};

const loginAndBootstrap = async ({ baseUrl, username, password, timeoutMs }) => {
  const cookieJar = new CookieJar();
  const loginResponse = await makeRequest(new URL('/api/v5/auth/login', baseUrl), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ username, password }),
    timeoutMs,
  });

  cookieJar.updateFromHeaders(loginResponse.headers);

  if (!loginResponse.ok) {
    throw new Error(await formatErrorMessage(loginResponse, 'Dang nhap that bai'));
  }

  const bootstrapResponse = await makeRequest(new URL('/api/v5/bootstrap', baseUrl), {
    cookieHeader: cookieJar.toHeader(),
    timeoutMs,
  });

  cookieJar.updateFromHeaders(bootstrapResponse.headers);

  if (!bootstrapResponse.ok) {
    throw new Error(await formatErrorMessage(bootstrapResponse, 'Bootstrap that bai'));
  }

  const bootstrapPayload = await parseJsonSafely(bootstrapResponse);

  return {
    cookieHeader: cookieJar.toHeader(),
    user: bootstrapPayload?.data?.user ?? null,
  };
};

const percentile = (values, targetPercentile) => {
  if (values.length === 0) {
    return 0;
  }

  const sorted = [...values].sort((left, right) => left - right);
  const rank = Math.ceil((targetPercentile / 100) * sorted.length) - 1;
  const index = Math.min(sorted.length - 1, Math.max(0, rank));

  return sorted[index];
};

const round = (value) => Number(value.toFixed(2));

const summarize = (metrics, durationMs) => {
  const completed = metrics.completed;
  const totalAttempts = metrics.completed + metrics.errors;
  const successfulResponses = metrics.completed - metrics.non2xx;
  const errorLikeCount = metrics.errors + metrics.non2xx;
  const minLatency = metrics.latencies.length === 0 ? 0 : Math.min(...metrics.latencies);
  const maxLatency = metrics.latencies.length === 0 ? 0 : Math.max(...metrics.latencies);
  const averageLatency = metrics.latencies.length === 0
    ? 0
    : metrics.latencies.reduce((sum, value) => sum + value, 0) / metrics.latencies.length;

  return {
    attempts: totalAttempts,
    completed,
    successfulResponses,
    non2xx: metrics.non2xx,
    errors: metrics.errors,
    timeouts: metrics.timeouts,
    durationSeconds: round(durationMs / 1000),
    requestsPerSecond: round(completed / (durationMs / 1000)),
    bytesPerSecond: round(metrics.bytes / (durationMs / 1000)),
    errorRate: totalAttempts === 0 ? 1 : round(errorLikeCount / totalAttempts),
    latency: {
      min: round(minLatency),
      avg: round(averageLatency),
      p50: round(percentile(metrics.latencies, 50)),
      p95: round(percentile(metrics.latencies, 95)),
      p99: round(percentile(metrics.latencies, 99)),
      max: round(maxLatency),
    },
    statusCounts: metrics.statusCounts,
  };
};

const evaluateSummary = (target, summary) => {
  const failures = [];

  if (typeof target.maxP95Ms === 'number' && summary.latency.p95 > target.maxP95Ms) {
    failures.push(`p95 ${summary.latency.p95}ms > ${target.maxP95Ms}ms`);
  }

  if (typeof target.maxErrorRate === 'number' && summary.errorRate > target.maxErrorRate) {
    failures.push(`errorRate ${summary.errorRate} > ${target.maxErrorRate}`);
  }

  if (
    typeof target.minRequestsPerSecond === 'number'
    && summary.requestsPerSecond < target.minRequestsPerSecond
  ) {
    failures.push(`req/s ${summary.requestsPerSecond} < ${target.minRequestsPerSecond}`);
  }

  return failures;
};

const runTarget = async ({ baseUrl, cookieHeader, target, defaults }) => {
  const mergedTarget = { ...defaults, ...target };
  const url = new URL(mergedTarget.path, baseUrl).toString();
  const deadline = Date.now() + (mergedTarget.durationSeconds * 1000);
  const metrics = {
    completed: 0,
    non2xx: 0,
    errors: 0,
    timeouts: 0,
    bytes: 0,
    latencies: [],
    statusCounts: {},
  };

  const worker = async () => {
    while (Date.now() < deadline) {
      const startedAt = performance.now();

      try {
        const response = await makeRequest(url, {
          method: mergedTarget.method || 'GET',
          headers: mergedTarget.headers || {},
          body: mergedTarget.body ? JSON.stringify(mergedTarget.body) : undefined,
          cookieHeader,
          timeoutMs: mergedTarget.timeoutMs,
        });

        const buffer = await response.arrayBuffer();
        const durationMs = performance.now() - startedAt;
        metrics.completed += 1;
        metrics.bytes += buffer.byteLength;
        metrics.latencies.push(durationMs);
        metrics.statusCounts[response.status] = (metrics.statusCounts[response.status] || 0) + 1;

        if (!response.ok) {
          metrics.non2xx += 1;
        }
      } catch (error) {
        const durationMs = performance.now() - startedAt;
        metrics.errors += 1;
        metrics.latencies.push(durationMs);

        if (error?.name === 'AbortError' || error?.name === 'TimeoutError') {
          metrics.timeouts += 1;
        }
      }
    }
  };

  await Promise.all(
    Array.from({ length: mergedTarget.connections }, () => worker())
  );

  const summary = summarize(metrics, mergedTarget.durationSeconds * 1000);
  const failures = evaluateSummary(mergedTarget, summary);

  return {
    target: mergedTarget,
    url,
    summary,
    failures,
  };
};

const printTargetResult = (result) => {
  if (result.skipped) {
    console.log(`\n[SKIP] ${result.target.name}`);
    console.log(`  path: ${result.target.path}`);
    console.log(`  ly do: ${result.skipReason}`);
    return;
  }

  const { target, summary, failures } = result;
  const statusLabel = failures.length === 0 ? 'PASS' : 'FAIL';
  const statusDetails = Object.entries(summary.statusCounts)
    .map(([code, count]) => `${code}:${count}`)
    .join(', ');

  console.log(`\n[${statusLabel}] ${target.name}`);
  console.log(`  path: ${target.path}`);
  console.log(`  load: ${target.connections} connections x ${target.durationSeconds}s`);
  console.log(
    `  latency: avg=${summary.latency.avg}ms p50=${summary.latency.p50}ms p95=${summary.latency.p95}ms p99=${summary.latency.p99}ms`
  );
  console.log(
    `  throughput: ${summary.requestsPerSecond} req/s, ${summary.bytesPerSecond} B/s`
  );
  console.log(
    `  responses: ok=${summary.successfulResponses}/${summary.completed}, non2xx=${summary.non2xx}, errors=${summary.errors}, timeouts=${summary.timeouts}`
  );
  console.log(`  status: ${statusDetails || 'none'}`);

  if (failures.length > 0) {
    console.log(`  thresholds: ${failures.join(' | ')}`);
  }
};

const maybeWriteReport = async (report) => {
  const outputPath = process.env.PERF_OUTPUT;
  if (!outputPath) {
    return;
  }

  const absoluteOutputPath = path.isAbsolute(outputPath)
    ? outputPath
    : path.join(process.cwd(), outputPath);

  await mkdir(path.dirname(absoluteOutputPath), { recursive: true });
  await writeFile(absoluteOutputPath, JSON.stringify(report, null, 2), 'utf8');
  console.log(`\nBao cao JSON da duoc ghi tai: ${absoluteOutputPath}`);
};

const main = async () => {
  const { scenarioName, requestedTargets } = parseCliArgs();
  const scenario = scenarios[scenarioName];

  if (!scenario) {
    const availableScenarios = Object.keys(scenarios).join(', ');
    throw new Error(`Scenario khong hop le: ${scenarioName}. Co san: ${availableScenarios}`);
  }

  const baseUrl = await resolveBaseUrl();
  const baseTimeoutMs = scenario.defaults.timeoutMs || DEFAULT_TIMEOUT_MS;
  const envSelectedTargets = (process.env.PERF_ONLY || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  const selectedTargetNames = requestedTargets.length > 0 ? requestedTargets : envSelectedTargets;

  const targets = selectedTargetNames.length === 0
    ? scenario.targets
    : scenario.targets.filter((target) => selectedTargetNames.includes(target.name));

  if (targets.length === 0) {
    throw new Error('Khong co target nao phu hop voi bo loc PERF_ONLY/CLI.');
  }

  console.log(`Scenario: ${scenarioName}`);
  console.log(`Mo ta: ${scenario.description}`);
  console.log(`Base URL: ${baseUrl}`);
  console.log(`Targets: ${targets.map((target) => target.name).join(', ')}`);

  const shouldAuthenticate = scenario.authenticate !== false && !isTruthy(process.env.PERF_SKIP_AUTH);
  let cookieHeader = '';
  const discoveryCache = new Map();

  if (shouldAuthenticate) {
    console.log(`Username: ${DEFAULT_USERNAME}`);

    const auth = await loginAndBootstrap({
      baseUrl,
      username: DEFAULT_USERNAME,
      password: DEFAULT_PASSWORD,
      timeoutMs: baseTimeoutMs,
    });

    cookieHeader = auth.cookieHeader;

    if (auth.user) {
      console.log(`Nguoi dung: ${auth.user.full_name || auth.user.username} (${auth.user.username})`);
    }
  } else {
    console.log('Bo qua buoc dang nhap theo cau hinh scenario/PERF_SKIP_AUTH.');
  }

  const results = [];
  for (const target of targets) {
    const preparedTarget = await prepareTarget({
      target,
      baseUrl,
      cookieHeader,
      timeoutMs: baseTimeoutMs,
      discoveryCache,
    });

    if (preparedTarget.skipped) {
      printTargetResult(preparedTarget);
      results.push(preparedTarget);
      continue;
    }

    const result = await runTarget({
      baseUrl,
      cookieHeader,
      target: preparedTarget.target,
      defaults: scenario.defaults,
    });

    printTargetResult(result);
    results.push(result);
  }

  const failureCount = results.reduce((count, result) => count + (result.failures?.length || 0), 0);
  const skippedCount = results.reduce((count, result) => count + (result.skipped ? 1 : 0), 0);
  const report = {
    generatedAt: new Date().toISOString(),
    scenario: scenarioName,
    baseUrl,
    username: shouldAuthenticate ? DEFAULT_USERNAME : null,
    targets: results.map((result) => ({
      name: result.target.name,
      path: result.target.path,
      skipped: Boolean(result.skipped),
      skipReason: result.skipReason || null,
      summary: result.summary || null,
      failures: result.failures || [],
    })),
  };

  await maybeWriteReport(report);

  console.log(`\nTong ket: ${results.length} target, ${failureCount} vi pham threshold, ${skippedCount} target bi bo qua.`);
  if (failureCount > 0) {
    process.exitCode = 1;
  }
};

main().catch((error) => {
  console.error(`Loi perf test: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
