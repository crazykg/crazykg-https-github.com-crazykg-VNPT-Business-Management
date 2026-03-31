import type { ConnectionStatus } from 'laravel-echo';
import { getRealtimeEcho } from './echo';
import { isRealtimeEnabled, realtimeConfig, type DashboardRealtimeDomain } from './realtimeConfig';

type DashboardSignalPayload = {
  domains?: unknown;
};

type Subscription = {
  domains: Set<DashboardRealtimeDomain>;
  onSignal: (domains: DashboardRealtimeDomain[]) => void;
  onPollingChange?: (polling: boolean) => void;
};

let nextSubscriptionId = 1;
let activeSubscriptions = new Map<number, Subscription>();
let echoTeardown: (() => void) | null = null;
let echoStartPromise: Promise<void> | null = null;
let pollingMode = !isRealtimeEnabled();

const DASHBOARD_SIGNAL_EVENT = '.dashboard.metrics.updated';

const normalizeDomains = (domains: unknown): DashboardRealtimeDomain[] => {
  if (!Array.isArray(domains)) {
    return [];
  }

  return Array.from(new Set(
    domains.filter((domain): domain is DashboardRealtimeDomain => domain === 'fee_collection' || domain === 'revenue')
  ));
};

const notifyPollingMode = (): void => {
  activeSubscriptions.forEach((subscription) => {
    subscription.onPollingChange?.(pollingMode);
  });
};

const setPollingMode = (nextPollingMode: boolean): void => {
  if (pollingMode === nextPollingMode) {
    return;
  }

  pollingMode = nextPollingMode;
  notifyPollingMode();
};

const dispatchSignal = (domains: DashboardRealtimeDomain[]): void => {
  activeSubscriptions.forEach((subscription) => {
    const matchedDomains = domains.filter((domain) => subscription.domains.has(domain));
    if (matchedDomains.length > 0) {
      subscription.onSignal(matchedDomains);
    }
  });
};

const teardownEchoSubscription = (): void => {
  echoTeardown?.();
  echoTeardown = null;
  echoStartPromise = null;
  setPollingMode(!isRealtimeEnabled());
};

const ensureEchoSubscription = (): void => {
  if (echoTeardown || echoStartPromise || !isRealtimeEnabled() || activeSubscriptions.size === 0) {
    return;
  }

  echoStartPromise = (async () => {
    const echo = await getRealtimeEcho();
    if (!echo) {
      setPollingMode(true);
      return;
    }

    const channelName = realtimeConfig.dashboardChannel;
    const channel = echo.private(channelName);
    const signalHandler = (payload: DashboardSignalPayload) => {
      const domains = normalizeDomains(payload.domains);
      if (domains.length > 0) {
        dispatchSignal(domains);
      }
    };

    channel.listen(DASHBOARD_SIGNAL_EVENT, signalHandler);

    const unsubscribeConnectionChange = echo.connector.onConnectionChange((status: ConnectionStatus) => {
      setPollingMode(status !== 'connected');
    });

    setPollingMode(echo.connector.connectionStatus() !== 'connected');

    echoTeardown = () => {
      channel.stopListening(DASHBOARD_SIGNAL_EVENT);
      echo.leave(channelName);
      unsubscribeConnectionChange();
    };
  })().catch(() => {
    setPollingMode(true);
  }).finally(() => {
    echoStartPromise = null;
  });
};

export const subscribeDashboardSignals = (
  domains: DashboardRealtimeDomain[],
  onSignal: (domains: DashboardRealtimeDomain[]) => void,
  onPollingChange?: (polling: boolean) => void,
): (() => void) => {
  const subscriptionId = nextSubscriptionId++;
  const normalizedDomains = normalizeDomains(domains);

  activeSubscriptions.set(subscriptionId, {
    domains: new Set(normalizedDomains),
    onSignal,
    onPollingChange,
  });

  onPollingChange?.(pollingMode);
  ensureEchoSubscription();

  return () => {
    activeSubscriptions.delete(subscriptionId);
    if (activeSubscriptions.size === 0) {
      teardownEchoSubscription();
    }
  };
};
