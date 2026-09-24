type VercelAnalyticsEnv = {
  PROD?: boolean;
  VITE_ENABLE_VERCEL_ANALYTICS?: string;
};

type VercelAnalyticsEvent = {
  url: string;
};

export const shouldEnableVercelAnalytics = (env: VercelAnalyticsEnv) => {
  return env.PROD === true && env.VITE_ENABLE_VERCEL_ANALYTICS === 'true';
};

const getSafeGameAnalyticsPath = (url: URL) => {
  if (url.searchParams.get('mode') === 'solo') return '/game/solo';
  if (url.searchParams.get('host') === 'true') return '/game/p2p-host';
  if (url.searchParams.get('spectator') === 'true') return '/game/p2p-spectator';
  if (url.searchParams.get('host') === 'false') return '/game/p2p-guest';

  return '/game';
};

export const redactVercelAnalyticsEvent = <TEvent extends VercelAnalyticsEvent>(
  event: TEvent
) => {
  try {
    const url = new URL(event.url);

    if (url.pathname === '/game') {
      url.pathname = getSafeGameAnalyticsPath(url);
      url.search = '';
      url.hash = '';
    }

    return {
      ...event,
      url: url.toString(),
    };
  } catch {
    return event;
  }
};
