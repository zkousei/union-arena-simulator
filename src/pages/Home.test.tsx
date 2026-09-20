// @vitest-environment jsdom

import { render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { HomePage } from './Home';

describe('HomePage', () => {
  it('renders the home content before loading preset deck data', async () => {
    render(
      <HomePage
        onStartSolo={vi.fn()}
        onHostGame={vi.fn()}
        onJoinGame={vi.fn()}
        onOpenDeckBuilder={vi.fn()}
        onSelectPresetDeck={vi.fn()}
      />
    );

    expect(screen.getByRole('heading', { name: /Web Simulator/ })).toBeTruthy();
    expect(await screen.findAllByRole('button', { name: 'ソロで試す' }, { timeout: 5000 })).toHaveLength(3);
  });

  it('shows the implemented pre-game setup order', () => {
    render(
      <HomePage
        onStartSolo={vi.fn()}
        onHostGame={vi.fn()}
        onJoinGame={vi.fn()}
        onOpenDeckBuilder={vi.fn()}
        onSelectPresetDeck={vi.fn()}
      />
    );

    const heading = screen.getByRole('heading', { name: '初期準備フロー' });
    const list = heading.parentElement?.querySelector('ol');
    expect(list).not.toBeNull();

    const steps = within(list as HTMLOListElement)
      .getAllByRole('listitem')
      .map((item) => item.textContent);

    expect(steps).toEqual([
      'ダイスやじゃんけんで先攻・後攻を決定',
      '山札の上から7枚を手札として引く',
      'マリガン（引き直し）：手札が気に入らない場合、1回だけ手札7枚を横に置き、新たに山札から7枚引いてから、横の7枚を山札に戻してシャッフル',
      'マリガン終了後、山札の上から7枚を裏向きで「ライフ」にセット',
      '準備完了でお互いにゲーム開始',
    ]);
  });
});
