import React from 'react';
import { AlertTriangle, Ban, CircleSlash2, LoaderCircle, RefreshCcw, ShieldAlert, WifiOff } from 'lucide-react';
import { translate } from './i18n';
import type { PayLocale } from './types';
import type { PayDataState } from './data-state';

interface DataStateViewProps {
  locale: PayLocale;
  state: PayDataState;
  message?: string;
  onRetry?: () => void;
}

const ICONS: Record<PayDataState, React.ComponentType<{ size?: number }>> = {
  idle: LoaderCircle,
  loading: LoaderCircle,
  ready: LoaderCircle,
  empty: CircleSlash2,
  error: AlertTriangle,
  unauthorized: ShieldAlert,
  forbidden: Ban,
  stale: WifiOff,
  retryable: RefreshCcw,
};

export function PayDataStateView({ locale, state, message, onRetry }: DataStateViewProps): React.ReactElement | null {
  if (state === 'ready') return null;

  const Icon = ICONS[state];
  const titleKey = state === 'empty' ? 'noData' : state === 'unauthorized' ? 'notConnected' : state === 'forbidden' ? 'secureBoundary' : 'apiPending';
  const descriptionKey = state === 'empty' ? 'sectionDescription' : state === 'unauthorized' ? 'notConnected' : state === 'forbidden' ? 'secureBoundaryText' : 'readOnlyFoundation';

  return (
    <section className={`pay-panel pay-data-state pay-data-state-${state}`} role={state === 'error' || state === 'retryable' ? 'alert' : undefined} aria-live="polite">
      <div className="pay-section-empty-icon" aria-hidden="true"><Icon size={22} /></div>
      <div>
        <h2>{translate(locale, titleKey)}</h2>
        <p>{message || translate(locale, descriptionKey)}</p>
        {state === 'retryable' && onRetry ? (
          <button type="button" className="pay-collapse-button" onClick={onRetry}>
            <RefreshCcw size={16} />
            <span>{translate(locale, 'operational')}</span>
          </button>
        ) : null}
      </div>
    </section>
  );
}

export default PayDataStateView;
