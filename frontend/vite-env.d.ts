/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_REALTIME_ENABLED?: string;
  readonly VITE_BROADCAST_AUTH_ENDPOINT?: string;
  readonly VITE_REVERB_APP_KEY?: string;
  readonly VITE_REVERB_HOST?: string;
  readonly VITE_REVERB_PORT?: string;
  readonly VITE_REVERB_SCHEME?: string;
  readonly VITE_REALTIME_DASHBOARD_CHANNEL?: string;
  readonly VITE_REALTIME_FALLBACK_POLL_MS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
