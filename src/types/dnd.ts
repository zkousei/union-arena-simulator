import { CardLocation } from './game';

export interface DragCardPayload {
  cardId: string;
  from: CardLocation;
}

export const DND_MIME_TYPE = 'application/x-union-arena-card';
