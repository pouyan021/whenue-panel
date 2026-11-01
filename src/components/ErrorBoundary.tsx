import { Component, type ErrorInfo, type ReactNode } from 'react';

import { useI18n } from '../i18n/i18n';
import { Button } from './ui';

type Props = { children: ReactNode; fallback: (reset: () => void) => ReactNode };
type State = { failed: boolean };

/**
 * Catches a crash while drawing its children and shows the fallback in their place, so one broken
 * page does not blank the whole panel. Give it a key that changes on navigation to clear the error
 * when the user goes to another page.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Panel page crashed', error, info.componentStack);
  }

  reset = () => this.setState({ failed: false });

  render() {
    return this.state.failed ? this.props.fallback(this.reset) : this.props.children;
  }
}

/** What a crashed page shows; the menu around it keeps working. */
export function PageCrashed({ onRetry }: { onRetry: () => void }) {
  const { t } = useI18n();
  return (
    <div className="card crash" role="alert">
      <h2>{t('crash.title')}</h2>
      <p className="muted">{t('crash.page')}</p>
      <div className="form-actions">
        <Button variant="primary" onClick={onRetry}>
          {t('common.retry')}
        </Button>
        <Button onClick={() => window.location.reload()}>{t('crash.reload')}</Button>
      </div>
    </div>
  );
}

/** What the panel shows when it cannot draw at all. */
export function PanelCrashed() {
  const { t } = useI18n();
  return (
    <main className="centered">
      <div className="card crash" role="alert">
        <h2>{t('crash.title')}</h2>
        <p className="muted">{t('crash.panel')}</p>
        <div className="form-actions">
          <Button variant="primary" onClick={() => window.location.reload()}>
            {t('crash.reload')}
          </Button>
        </div>
      </div>
    </main>
  );
}
