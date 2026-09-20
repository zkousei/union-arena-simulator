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
  | 'PONG';

export interface PeerMessage {
  type: PeerMessageType;
  senderId: string;
  senderName?: string;
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

export type PeerRole = 'host' | 'guest' | null;
