// @vitest-environment jsdom

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { RouteErrorBoundary } from './RouteErrorBoundary';

describe('RouteErrorBoundary', () => {
  it('shows a recovery action instead of blanking the app when a route fails', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const onReload = vi.fn();
    const BrokenRoute = () => { throw new Error('Failed to fetch dynamically imported module'); };

    render(<RouteErrorBoundary onReload={onReload}><BrokenRoute /></RouteErrorBoundary>);

    expect(screen.getByRole('alert').textContent).toContain('デッキビルダーを表示できませんでした');
    fireEvent.click(screen.getByRole('button', { name: '再読み込み' }));
    expect(onReload).toHaveBeenCalledTimes(1);
    vi.restoreAllMocks();
  });
});
