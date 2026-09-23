import React from 'react';

interface RouteErrorBoundaryProps {
  children: React.ReactNode;
  onReload?: () => void;
}

interface RouteErrorBoundaryState {
  hasError: boolean;
}

export class RouteErrorBoundary extends React.Component<RouteErrorBoundaryProps, RouteErrorBoundaryState> {
  state: RouteErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): RouteErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error): void {
    console.error('Failed to render deck builder:', error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div role="alert" className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center text-slate-200">
          <p className="font-bold">デッキビルダーを表示できませんでした。</p>
          <p className="text-sm text-slate-400">通信状況を確認して再読み込みしてください。保存済みデッキは削除されません。</p>
          <button type="button" onClick={this.props.onReload ?? (() => window.location.reload())} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-bold text-white hover:bg-indigo-500">
            再読み込み
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
