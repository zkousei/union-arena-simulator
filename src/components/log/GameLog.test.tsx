// @vitest-environment jsdom

import { fireEvent, render, screen } from '@testing-library/react';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { GameLog } from './GameLog';

describe('GameLog', () => {
  beforeAll(() => {
    window.HTMLElement.prototype.scrollIntoView = vi.fn();
  });

  it('does not send chat when Enter confirms an IME composition', () => {
    const onSendChat = vi.fn();
    render(
      <GameLog
        logs={[]}
        myPlayerId="player-1"
        myPlayerName="プレイヤー1"
        onSendChat={onSendChat}
      />
    );

    const input = screen.getByPlaceholderText('メッセージを入力...');
    fireEvent.change(input, { target: { value: 'こんにちは' } });
    fireEvent.keyDown(input, { key: 'Enter', isComposing: true });

    expect(onSendChat).not.toHaveBeenCalled();
    expect(input).toHaveProperty('value', 'こんにちは');
  });

  it('does not send chat for the IME compatibility key code', () => {
    const onSendChat = vi.fn();
    render(
      <GameLog
        logs={[]}
        myPlayerId="player-1"
        myPlayerName="プレイヤー1"
        onSendChat={onSendChat}
      />
    );

    const input = screen.getByPlaceholderText('メッセージを入力...');
    fireEvent.change(input, { target: { value: 'こんにちは' } });
    fireEvent.keyDown(input, { key: 'Enter', keyCode: 229 });

    expect(onSendChat).not.toHaveBeenCalled();
    expect(input).toHaveProperty('value', 'こんにちは');
  });

  it('sends chat with Enter after composition has finished', () => {
    const onSendChat = vi.fn();
    render(
      <GameLog
        logs={[]}
        myPlayerId="player-1"
        myPlayerName="プレイヤー1"
        onSendChat={onSendChat}
      />
    );

    const input = screen.getByPlaceholderText('メッセージを入力...');
    fireEvent.change(input, { target: { value: 'こんにちは' } });
    fireEvent.keyDown(input, { key: 'Enter', isComposing: false });

    expect(onSendChat).toHaveBeenCalledWith('こんにちは');
    expect(input).toHaveProperty('value', '');
  });
});
