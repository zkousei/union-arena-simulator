import { describe, expect, it } from 'vitest';
import { isSoloGameRoute } from './utils/gameMode';

describe('isSoloGameRoute', () => {
  it('treats a guest invite URL as P2P before the peer role is assigned', () => {
    expect(isSoloGameRoute(null, 'false', 'room-id', null)).toBe(false);
  });

  it('treats a host URL as P2P before the peer role is assigned', () => {
    expect(isSoloGameRoute(null, 'true', 'room-id', null)).toBe(false);
  });

  it('keeps explicit and legacy solo routes in solo mode', () => {
    expect(isSoloGameRoute('solo', null, null, null)).toBe(true);
    expect(isSoloGameRoute(null, null, null, null)).toBe(true);
  });
});
