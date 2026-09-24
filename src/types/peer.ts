import { GameAction } from './actions';
import { GameState } from './game';

export type PeerMessageType =
  | 'ACTION_REQUEST'
  | 'UNDO_REQUEST'
  | 'STATE_COMMIT'
  | 'SYNC_REQUEST'
  | 'SYNC_RESPONSE'
  | 'CHAT'
  | 'PING'
  | 'PONG'
  | 'CONNECTION_ACCEPTED'
  | 'CONNECTION_REJECTED'
  | 'SPECTATOR_LEAVE'
  | 'SESSION_ENDED'
  | 'SYNC_PENDING';

export interface PeerMessage {
  type: PeerMessageType;
  senderId: string;
  senderName?: string;
  requestId?: string;
  payload?: unknown;
  timestamp: number;
}

export interface PeerActionRequestMessage extends PeerMessage {
  type: 'ACTION_REQUEST';
  payload: GameAction;
}

export interface PeerStateSnapshot {
  state: GameState;
  revision: number;
  action?: GameAction;
}

export interface PeerStateCommitMessage extends PeerMessage {
  type: 'STATE_COMMIT';
  payload: PeerStateSnapshot;
}

export interface PeerSyncResponseMessage extends PeerMessage {
  type: 'SYNC_RESPONSE';
  payload: PeerStateSnapshot;
}

export interface PeerChatMessage extends PeerMessage {
  type: 'CHAT';
  payload: {
    text: string;
  };
}

export type ConnectionStatus =
  | 'disconnected'
  | 'connecting'
  | 'waiting'
  | 'connected'
  | 'reconnecting'
  | 'error';

export type PeerRole = 'host' | 'guest' | 'spectator' | null;

export type RemoteConnectionRole = 'guest' | 'spectator';

export interface PeerMessageContext {
  connectionId: string;
  role: RemoteConnectionRole | 'host';
}

export interface PeerConnectionMetadata {
  protocolVersion: 1;
  connectionRole: RemoteConnectionRole;
  clientSessionId: string;
}

export type ConnectionRejectedReason =
  | 'protocol-version-mismatch'
  | 'player-slot-occupied'
  | 'spectating-disabled'
  | 'spectator-limit'
  | 'invalid-metadata';
