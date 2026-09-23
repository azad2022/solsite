import React from 'react';
import { AlertTriangle, ArrowUpRight, BookOpen, CheckCircle2, Circle, Loader2, ShieldCheck, Store, WalletCards } from 'lucide-react';
import type { PayLocale, PaySection } from '../types';
import type { PayMerchant } from '../services/merchantOnboardingService';
import './pay-getting-started.css';

type MerchantLoadState = 'loading' | 'ready' | 'error';

interface Props {
  locale: PayLocale;
  merchant: PayMerchant | null;
  merchantLoadState: MerchantLoadState;
  onNavigate: (section: PaySection) => void;
  onRetryMerchant: () => void;
}

import { guideCopy } from './pay-getting-started-i18n';

function statusIcon(done: boolean) {
  return done ? <CheckCircle2 size={18} aria-hidden="true" /> : <Circle size={18} aria-hidden="true" />;
}

export default function PayGettingStartedGuide({ locale, merchant, merchantLoadState, onNavigate, onRetryMerchant }: Props): React.ReactElement {
  const t = guideCopy[locale];
  const merchantReady = Boolean(merchant);
  const walletVerified = merchant?.receivingWallet?.verificationStatus === 'verified' && merchant.receivingWallet.isActive;
  const merchantActive = merchant?.status === 'active';

  return (
    <section className="pay-getting-started" aria-labelledby="pay-getting-started-title">
      <div className="pay-getting-started-header">
        <div className="pay-getting-started-title-row">
          <div className="pay-getting-started-icon" aria-hidden="true"><BookOpen size={19} /></div>
          <div>
            <span className="pay-panel-kicker">{t.kicker}</span>
            <h2 id="pay-getting-started-title">{t.title}</h2>
            <p>{t.description}</p>
          </div>
        </div>
        <button type="button" className="pay-getting-started-developer" onClick={() => onNavigate('developer')}>
          <ArrowUpRight size={16} />
          {t.developer}
        </button>
      </div>

      {merchantLoadState === 'loading' ? (
        <div className="pay-getting-started-state" role="status" aria-live="polite"><Loader2 size={17} className="animate-spin" />{t.loading}</div>
      ) : merchantLoadState === 'error' ? (
        <div className="pay-getting-started-state is-error" role="alert">
          <AlertTriangle size={17} />
          <span>{t.lookupFailed}</span>
          <button type="button" className="pay-secondary-action" onClick={onRetryMerchant}>{t.retry}</button>
        </div>
      ) : (
        <div className="pay-getting-started-steps">
          <GuideStep number="1" icon={<Store size={16} />} title={t.step1} text={t.step1Text} done={merchantReady} active={!merchantReady} onClick={!merchantReady ? () => onNavigate('merchants') : undefined} status={merchantReady ? t.ready : t.pending} />
          <GuideStep number="2" icon={<WalletCards size={16} />} title={t.step2} text={t.step2Text} done={walletVerified} active={merchantReady && !walletVerified} onClick={merchantReady && !walletVerified ? () => onNavigate('merchants') : undefined} status={walletVerified ? t.ready : merchantReady ? t.pending : t.pending} />
          <GuideStep number="3" icon={<ShieldCheck size={16} />} title={t.step3} text={merchantActive ? t.merchantActive : merchantReady ? t.merchantNotActive : t.merchantNotReady} done={merchantActive} active={walletVerified && !merchantActive} status={merchantActive ? t.ready : t.pending} />
          <GuideStep number="4" icon={<BookOpen size={16} />} title={t.step4} text={merchantActive ? t.walletVerified : walletVerified ? t.walletVerified : t.walletPending} done={merchantActive && walletVerified} active={merchantActive && walletVerified} onClick={() => onNavigate('developer')} status={merchantActive && walletVerified ? t.ready : t.pending} />
        </div>
      )}

      {merchantLoadState === 'ready' && merchant && (
        <div className="pay-getting-started-footnote">
          <span>{merchant.businessName}</span>
          <span>{walletVerified ? t.walletVerified : t.walletPending}</span>
        </div>
      )}
    </section>
  );
}

function GuideStep({ number, icon, title, text: body, done, active, onClick, status }: {
  number: string; icon: React.ReactNode; title: string; text: string; done: boolean; active: boolean; onClick?: () => void; status: string;
}): React.ReactElement {
  const content = (
    <>
      <div className="pay-getting-started-step-icon">{statusIcon(done)}</div>
      <div className="pay-getting-started-step-copy">
        <span className="pay-getting-started-step-number">{number}</span>
        <strong>{title}</strong>
        <p>{body}</p>
      </div>
      <span className="pay-getting-started-step-status">{status}</span>
      {onClick ? <ArrowUpRight className="pay-getting-started-step-action" size={16} aria-hidden="true" /> : null}
    </>
  );
  return onClick ? <button type="button" className={`pay-getting-started-step is-action${active ? ' is-active' : ''}`} onClick={onClick}>{content}</button>
    : <div className={`pay-getting-started-step${done ? ' is-done' : active ? ' is-active' : ''}`}>{content}</div>;
}
