import { describe, expect, it } from 'vitest';
import { generateRoomId, normalizeRoomId, parseRoomIdInput } from '../roomId';

describe('roomId', () => {
  it('generates a six-character room id', () => {
    expect(generateRoomId()).toMatch(/^[A-Z2-9]{6}$/);
  });

  it('normalizes a room id and rejects malformed values', () => {
    expect(normalizeRoomId(' ab12cd ')).toBe('AB12CD');
    expect(normalizeRoomId('ABC12')).toBeNull();
    expect(normalizeRoomId('ABC-12')).toBeNull();
  });

  it('extracts the same room id from player and spectator URLs', () => {
    expect(parseRoomIdInput('https://example.com/game?host=false&room=ab12cd')).toBe('AB12CD');
    expect(parseRoomIdInput('https://example.com/game?spectator=true&room=ab12cd')).toBe('AB12CD');
    expect(parseRoomIdInput(' ab12cd ')).toBe('AB12CD');
  });
});
