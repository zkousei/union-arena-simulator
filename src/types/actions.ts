import { Card } from './card';
import { CardLocation, FieldSlotIndex, GameState, Phase } from './game';

export type GameAction =
  | {
      type: 'INIT_GAME';
      payload: {
        player1Id: string;
        player1Name: string;
        player2Id: string;
        player2Name: string;
        activePlayerId: string;
      };
    }
  | {
      type: 'SETUP_GAME';
      payload: {
        playerId: string;
        deckCards: Card[];
        apCards: Card[];
      };
    }
  | {
      type: 'SET_FIRST_PLAYER';
      payload: {
        firstPlayerId: string;
      };
    }
  | {
      type: 'DRAW_INITIAL_HAND';
      payload: {
        playerId: string;
      };
    }
  | {
      type: 'MULLIGAN';
      payload: {
        playerId: string;
      };
    }
  | {
      type: 'KEEP_HAND';
      payload: {
        playerId: string;
      };
    }
  | {
      type: 'PLACE_INITIAL_LIFE';
      payload: {
        playerId: string;
        count?: number;
      };
    }
  | {
      type: 'SET_READY';
      payload: {
        playerId: string;
        isReady: boolean;
      };
    }
  | {
      type: 'START_GAME';
    }
  | {
      type: 'MOVE_CARD';
      payload: {
        cardId: string;
        from: CardLocation;
        to: CardLocation;
      };
    }
  | {
      type: 'TOGGLE_REST';
      payload: {
        playerId: string;
        zone: 'frontLine' | 'energyLine';
        slotIndex: FieldSlotIndex;
      };
    }
  | {
      type: 'SET_ALL_ACTIVE';
      payload: {
        playerId: string;
      };
    }
  | {
      type: 'MODIFY_BP';
      payload: {
        playerId: string;
        zone: 'frontLine' | 'energyLine';
        slotIndex: FieldSlotIndex;
        delta: number; // 例: +1000, -1000
      };
    }
  | {
      type: 'RAID_CARD';
      payload: {
        playerId: string;
        targetZone: 'frontLine' | 'energyLine';
        targetSlotIndex: FieldSlotIndex;
        raidCard: Card;
        fromLocation: CardLocation;
        moveToFront?: boolean; // エナジーLからフロントLへ移動させるか
      };
    }
  | {
      type: 'SEPARATE_UNDER_CARD';
      payload: {
        playerId: string;
        zone: 'frontLine' | 'energyLine';
        slotIndex: FieldSlotIndex;
        underCardId: string;
        destination: 'hand' | 'graveyard' | 'frontLine' | 'energyLine' | 'removed' | 'life' | 'lifeFaceUp' | 'deckTop' | 'deckBottom';
        destSlotIndex?: FieldSlotIndex;
      };
    }
  | {
      type: 'SEPARATE_PARENT_CARD';
      payload: {
        playerId: string;
        zone: 'frontLine' | 'energyLine';
        slotIndex: FieldSlotIndex;
        destination: 'hand' | 'graveyard' | 'removed' | 'deckTop' | 'deckBottom' | 'life' | 'lifeFaceUp';
      };
    }
  | {
      type: 'ADD_MARKER';
      payload: {
        playerId: string;
        targetZone: 'frontLine' | 'energyLine';
        targetSlotIndex: FieldSlotIndex;
        from: 'topDeck' | { zone: 'hand'; index: number };
        isFaceDown?: boolean;
      };
    }
  | {
      type: 'TOGGLE_FREEZE';
      payload: {
        playerId: string;
        zone: 'frontLine' | 'energyLine';
        slotIndex: FieldSlotIndex;
      };
    }
  | {
      type: 'RECOVER_LIFE';
      payload: {
        playerId: string;
        count?: number;
        isFaceDown?: boolean;
      };
    }
  | {
      type: 'TAKE_LIFE';
      payload: {
        playerId: string;
        destination: 'hand' | 'graveyard' | 'deckTop' | 'deckBottom';
        lifeIndex?: number;
      };
    }
  | {
      type: 'REORDER_LIFE';
      payload: {
        playerId: string;
        newLifeCards: Card[];
      };
    }
  | {
      type: 'DRAW_CARD';
      payload: {
        playerId: string;
        count?: number;
      };
    }
  | {
      type: 'FLIP_LIFE';
      payload: {
        playerId: string;
        lifeIndex?: number;
      };
    }
  | {
      type: 'DISCARD_ALL_HAND';
      payload: {
        playerId: string;
      };
    }
  | {
      type: 'DISCARD_HAND_CARD';
      payload: {
        playerId: string;
        index?: number;
      };
    }
  | {
      type: 'REVEAL_TOP_DECK_CARD';
      payload: {
        playerId: string;
        reveal?: boolean;
      };
    }
  | {
      type: 'BOTTOM_DECK_ACTION';
      payload: {
        playerId: string;
        action: 'view' | 'mill' | 'toHand';
      };
    }
  | {
      type: 'EXTRA_DRAW';
      payload: {
        playerId: string;
      };
    }
  | {
      type: 'CHECK_LIFE_TRIGGER';
      payload: {
        playerId: string;
        lifeIndex?: number;
      };
    }
  | {
      type: 'DISMISS_REVEALED_CARD';
      payload: {
        destination: 'hand' | 'graveyard' | 'life' | 'cancel';
      };
    }
  | {
      type: 'USE_AP';
      payload: {
        playerId: string;
        amount?: number;
      };
    }
  | {
      type: 'RECOVER_AP';
      payload: {
        playerId: string;
        amount?: number; // 指定なしなら全快
      };
    }
  | {
      type: 'SHUFFLE_DECK';
      payload: {
        playerId: string;
      };
    }
  | {
      type: 'SET_PHASE';
      payload: {
        phase: Phase;
      };
    }
  | {
      type: 'PASS_TURN';
      payload: {
        playerId: string;
      };
    }
  | {
      type: 'LOOK_AT_TOP_DECK';
      payload: {
        playerId: string;
        count: number;
      };
    }
  | {
      type: 'RESOLVE_TOP_DECK_CARD';
      payload: {
        playerId: string;
        cardId: string;
        destination: 'hand' | 'graveyard' | 'top' | 'bottom' | 'life' | 'lifeFaceUp' | 'frontLine' | 'energyLine';
        slotIndex?: FieldSlotIndex;
      };
    }
  | {
      type: 'CLOSE_TOP_DECK';
      payload: {
        playerId: string;
        shuffleRemaining?: boolean;
      };
    }
  | {
      type: 'SEARCH_DECK_CARD';
      payload: {
        playerId: string;
        cardId: string;
        destination: 'hand' | 'graveyard' | 'frontLine' | 'energyLine';
        slotIndex?: FieldSlotIndex;
      };
    }
  | {
      type: 'ROLL_DICE';
      payload: {
        playerId: string;
      };
    }
  | {
      type: 'ADD_LOG';
      payload: {
        message: string;
        playerId?: string;
        type?: 'action' | 'phase' | 'system' | 'chat';
      };
    }
  | {
      type: 'CHAT_MESSAGE';
      payload: {
        senderId: string;
        senderName: string;
        text: string;
      };
    }
  | {
      type: 'SYNC_STATE';
      payload: {
        state: GameState;
      };
    };
