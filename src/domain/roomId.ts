export const ROOM_ID_LENGTH = 6;

const ROOM_ID_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const ROOM_ID_PATTERN = /^[A-Z0-9]{6}$/;

export function generateRoomId(): string {
  const randomValues = new Uint32Array(ROOM_ID_LENGTH);
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    crypto.getRandomValues(randomValues);
  } else {
    for (let index = 0; index < ROOM_ID_LENGTH; index += 1) {
      randomValues[index] = Math.floor(Math.random() * 0x1_0000_0000);
    }
  }

  return Array.from(randomValues, (value) => ROOM_ID_ALPHABET[value % ROOM_ID_ALPHABET.length]).join('');
}

export function normalizeRoomId(value: string): string | null {
  const normalized = value.trim().toUpperCase();
  return ROOM_ID_PATTERN.test(normalized) ? normalized : null;
}

export function parseRoomIdInput(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  let candidate = trimmed;
  if (trimmed.includes('room=')) {
    try {
      const url = new URL(trimmed.startsWith('http') ? trimmed : `http://local.invalid/${trimmed}`);
      candidate = url.searchParams.get('room') || '';
    } catch {
      const match = trimmed.match(/[?&]room=([^&#]+)/);
      candidate = match ? decodeURIComponent(match[1]) : '';
    }
  }

  return normalizeRoomId(candidate);
}
