// @vitest-environment jsdom

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ConfirmModal } from './ConfirmModal';

describe('ConfirmModal', () => {
  it('renders title, description and calls onConfirm when confirm button clicked', () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();

    render(
      <ConfirmModal
        isOpen={true}
        title="アタックフェイズへ移行"
        description="現在は移動フェイズです。アタックフェイズへ進んでアタックを実行しますか？"
        confirmText="アタックへ進む"
        cancelText="キャンセル"
        onConfirm={onConfirm}
        onCancel={onCancel}
      />
    );

    expect(screen.getByText('アタックフェイズへ移行')).toBeTruthy();
    expect(screen.getByText(/現在は移動フェイズです/)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'アタックへ進む' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onCancel).not.toHaveBeenCalled();
  });

  it('calls onCancel when cancel button clicked or Escape pressed', () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();

    render(
      <ConfirmModal
        isOpen={true}
        title="アタックフェイズへ移行"
        description="アタックを実行しますか？"
        onConfirm={onConfirm}
        onCancel={onCancel}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'キャンセル' }));
    expect(onCancel).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onCancel).toHaveBeenCalledTimes(2);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('does not render when isOpen is false', () => {
    render(
      <ConfirmModal
        isOpen={false}
        title="非表示タイトル"
        description="非表示テキスト"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    );

    expect(screen.queryByText('非表示タイトル')).toBeNull();
  });
});
