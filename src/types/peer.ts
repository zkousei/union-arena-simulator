import { GameAction } from './actions';
import { GameState } from './game';

export type PeerMessageType =
  | 'ACTION'
  | 'SYNC_REQUEST'
  | 'SYNC_RESPONSE'
  | 'CHAT'
  | 'PING'
  | 'PONG';

export interface PeerMessage {
  type: PeerMessageType;
  senderId: string;
  senderName?: string;
  payload?: any;
  timestamp: number;
}

export interface PeerActionMessage extends PeerMessage {
  type: 'ACTION';
  payload: GameAction;
}

export interface PeerSyncResponseMessage extends PeerMessage {
  type: 'SYNC_RESPONSE';
  payload: GameState;
}

export interface PeerChatMessage extends PeerMessage {
  type: 'CHAT';
  payload: {
    text: string;
  };
}

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';
