import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { HistoryEmpty } from './EmptyIllustration';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

/** Error boundary (Phase 9 → 11) — prevents a render crash from blanking the app. */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error(error, info.componentStack);
  }

  handleRetry = () => {
    this.setState({ hasError: false });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div
          className="min-h-screen flex items-center justify-center p-4"
          style={{ backgroundColor: 'var(--bg-canvas)' }}
        >
          <div
            className="card-surface fade-in flex flex-col items-center justify-center gap-5 py-16 px-6 text-center"
            style={{ maxWidth: 480, width: '100%' }}
          >
            <HistoryEmpty size={140} />
            <div className="space-y-2">
              <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
                Nimadir noto’g’ri ketdi
              </h1>
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                Kutilmagan xato yuz berdi. Qayta urinib ko’ring yoki bosh sahifaga qayting.
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <button className="btn btn-primary" onClick={this.handleRetry}>
                Qayta urinish
              </button>
              <Link to="/" className="btn btn-secondary">
                Bosh sahifaga qaytish
              </Link>
            </div>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              Agar xato takrorlansa, sahifani yangilab ko’ring.
            </p>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
