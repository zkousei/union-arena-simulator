import { PeerRole } from '../types/peer';

export function isSoloGameRoute(
  mode: string | null,
  hostParam: string | null,
  roomParam: string | null,
  peerRole: PeerRole
): boolean {
  if (mode === 'solo') return true;
  if (hostParam !== null || roomParam !== null || peerRole !== null) return false;
  return true;
}
