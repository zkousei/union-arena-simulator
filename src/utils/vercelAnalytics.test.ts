import { describe, expect, it } from 'vitest';
import {
  redactVercelAnalyticsEvent,
  shouldEnableVercelAnalytics,
} from './vercelAnalytics';

describe('vercelAnalytics', () => {
  it('enables analytics only for production builds with the explicit Vercel flag', () => {
    expect(shouldEnableVercelAnalytics({
      PROD: true,
      VITE_ENABLE_VERCEL_ANALYTICS: 'true',
    })).toBe(true);

    expect(shouldEnableVercelAnalytics({
      PROD: false,
      VITE_ENABLE_VERCEL_ANALYTICS: 'true',
    })).toBe(false);

    expect(shouldEnableVercelAnalytics({
      PROD: true,
      VITE_ENABLE_VERCEL_ANALYTICS: undefined,
    })).toBe(false);
  });

  it.each([
    ['solo mode', 'https://example.com/game?mode=solo&room=ROOM123', 'https://example.com/game/solo'],
    ['P2P host', 'https://example.com/game?host=true&room=ROOM123', 'https://example.com/game/p2p-host'],
    ['P2P spectator', 'https://example.com/game?spectator=true&room=ROOM123', 'https://example.com/game/p2p-spectator'],
    ['P2P guest', 'https://example.com/game?host=false&room=ROOM123', 'https://example.com/game/p2p-guest'],
    ['unknown game mode', 'https://example.com/game?room=ROOM123', 'https://example.com/game'],
  ])('redacts game query parameters while preserving the safe %s bucket', (_, inputUrl, expectedUrl) => {
    const event = redactVercelAnalyticsEvent({
      url: inputUrl,
      referrer: 'https://example.com/',
    });

    expect(event).toEqual({
      url: expectedUrl,
      referrer: 'https://example.com/',
    });
  });

  it('keeps non-game analytics URLs intact', () => {
    const event = redactVercelAnalyticsEvent({
      url: 'https://example.com/deck-builder?search=red',
    });

    expect(event.url).toBe('https://example.com/deck-builder?search=red');
  });

  it('returns malformed event URLs unchanged', () => {
    const event = { url: 'not a url', referrer: 'https://example.com/' };

    expect(redactVercelAnalyticsEvent(event)).toBe(event);
  });
});
