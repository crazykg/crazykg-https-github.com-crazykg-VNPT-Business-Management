import type Echo from 'laravel-echo';
import type { BroadcastDriver } from 'laravel-echo';
import { isRealtimeEnabled, realtimeConfig } from './realtimeConfig';

type ReverbEcho = Echo<Extract<BroadcastDriver, 'reverb'>>;

let echoInstancePromise: Promise<ReverbEcho | null> | null = null;

export const getRealtimeEcho = async (): Promise<ReverbEcho | null> => {
  if (!isRealtimeEnabled()) {
    return null;
  }

  if (echoInstancePromise) {
    return echoInstancePromise;
  }

  echoInstancePromise = (async () => {
    const [{ default: EchoConstructor }, { default: Pusher }] = await Promise.all([
      import('laravel-echo'),
      import('pusher-js'),
    ]);
    const enabledTransports = ['ws', 'wss'] as const;

    (globalThis as typeof globalThis & { Pusher?: typeof Pusher }).Pusher = Pusher;

    return new EchoConstructor({
      broadcaster: 'reverb',
      key: realtimeConfig.appKey,
      wsHost: realtimeConfig.host,
      wsPort: realtimeConfig.port,
      wssPort: realtimeConfig.port,
      forceTLS: realtimeConfig.scheme === 'https',
      enabledTransports: [...enabledTransports],
      authEndpoint: realtimeConfig.authEndpoint,
      auth: {
        headers: {
          Accept: 'application/json',
        },
      },
      cluster: '',
    });
  })().catch(() => {
    echoInstancePromise = null;
    return null;
  });

  return echoInstancePromise;
};

export const resetRealtimeEchoForTests = async (): Promise<void> => {
  const echo = echoInstancePromise ? await echoInstancePromise : null;
  echo?.disconnect();
  echoInstancePromise = null;
};
