export type DashboardRealtimeDomain = 'fee_collection' | 'revenue';

const parseBooleanEnv = (value: string | undefined): boolean => value === '1' || value === 'true';

const parseNumberEnv = (value: string | undefined, fallback: number): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

export const realtimeConfig = {
  enabled: parseBooleanEnv(import.meta.env.VITE_REALTIME_ENABLED),
  authEndpoint: import.meta.env.VITE_BROADCAST_AUTH_ENDPOINT || '/api/broadcasting/auth',
  appKey: import.meta.env.VITE_REVERB_APP_KEY || '',
  host: import.meta.env.VITE_REVERB_HOST || globalThis.location?.hostname || '127.0.0.1',
  port: parseNumberEnv(import.meta.env.VITE_REVERB_PORT, 8080),
  scheme: import.meta.env.VITE_REVERB_SCHEME || 'http',
  dashboardChannel: import.meta.env.VITE_REALTIME_DASHBOARD_CHANNEL || 'v5.dashboards',
  fallbackPollMs: parseNumberEnv(import.meta.env.VITE_REALTIME_FALLBACK_POLL_MS, 30000),
} as const;

export const isRealtimeEnabled = (): boolean => realtimeConfig.enabled && realtimeConfig.appKey.trim() !== '';
