interface ProviderStats {
  calls: number;
  success: number;
  failure: number;
  latencyMsTotal: number;
}

export interface WebToolStats {
  search: {
    calls: number;
    success: number;
    failure: number;
  };
  fetch: {
    calls: number;
    success: number;
    failure: number;
  };
  providers: Record<string, ProviderStats>;
  errorCodes: Record<string, number>;
}

const stats: WebToolStats = {
  search: { calls: 0, success: 0, failure: 0 },
  fetch: { calls: 0, success: 0, failure: 0 },
  providers: {},
  errorCodes: {},
};

let debugEnabled = false;

function ensureProvider(provider: string): ProviderStats {
  if (!stats.providers[provider]) {
    stats.providers[provider] = { calls: 0, success: 0, failure: 0, latencyMsTotal: 0 };
  }
  return stats.providers[provider];
}

export function configureWebObservability(debug: boolean): void {
  debugEnabled = debug;
}

export function resetWebToolStats(): void {
  stats.search = { calls: 0, success: 0, failure: 0 };
  stats.fetch = { calls: 0, success: 0, failure: 0 };
  stats.providers = {};
  stats.errorCodes = {};
}

export function getWebToolStats(): WebToolStats {
  return JSON.parse(JSON.stringify(stats)) as WebToolStats;
}

export function recordSearchCall(provider: string): number {
  stats.search.calls += 1;
  const p = ensureProvider(provider);
  p.calls += 1;
  return Date.now();
}

export function recordSearchSuccess(provider: string, startTs: number): void {
  stats.search.success += 1;
  const p = ensureProvider(provider);
  p.success += 1;
  p.latencyMsTotal += Math.max(0, Date.now() - startTs);
}

export function recordSearchFailure(provider: string, code: string, startTs: number): void {
  stats.search.failure += 1;
  const p = ensureProvider(provider);
  p.failure += 1;
  p.latencyMsTotal += Math.max(0, Date.now() - startTs);
  stats.errorCodes[code] = (stats.errorCodes[code] ?? 0) + 1;
}

export function recordFetchCall(): void {
  stats.fetch.calls += 1;
}

export function recordFetchSuccess(): void {
  stats.fetch.success += 1;
}

export function recordFetchFailure(code: string): void {
  stats.fetch.failure += 1;
  stats.errorCodes[code] = (stats.errorCodes[code] ?? 0) + 1;
}

export function webDebugLog(message: string, details?: unknown): void {
  if (!debugEnabled) return;
  if (details === undefined) {
    console.log(`[web-tools] ${message}`);
    return;
  }
  console.log(`[web-tools] ${message}`, details);
}
