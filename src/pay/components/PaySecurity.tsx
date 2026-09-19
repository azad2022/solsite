import React, { useCallback, useEffect, useRef, useState } from 'react';
import { CheckCircle2, Clock3, KeyRound, Loader2, RefreshCw, ShieldCheck, Webhook, XCircle } from 'lucide-react';
import { PayHttpError } from '../http';
import { listMerchantApiKeys, type PayApiKey } from '../services/apiKeyService';
import { payWebhookService, type PayWebhook } from '../services/webhookService';
import type { PayMerchant } from '../services/merchantOnboardingService';
import type { PayLocale } from '../types';
import { securityT } from './pay-security-i18n';
import './pay-security.css';

interface Props { locale: PayLocale; merchant: PayMerchant; }

type SecurityError = 'unauthorized' | 'forbidden' | 'error';

function accessError(error: unknown): SecurityError {
  if (error instanceof PayHttpError && error.status === 401) return 'unauthorized';
  if (error instanceof PayHttpError && error.status === 403) return 'forbidden';
  return 'error';
}

export default function PaySecurity({ locale, merchant }: Props): React.ReactElement {
  const [keys, setKeys] = useState<PayApiKey[]>([]);
  const [webhooks, setWebhooks] = useState<PayWebhook[]>([]);
  const [wallet, setWallet] = useState(merchant.receivingWallet ?? null);
  const [loading, setLoading] = useState(true);
  const [stale, setStale] = useState(false);
  const [error, setError] = useState<SecurityError | null>(null);
  const hasSnapshotRef = useRef(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [nextKeys, nextWebhooks] = await Promise.all([
        listMerchantApiKeys(merchant.id),
        payWebhookService.list(merchant.id),
      ]);
      setKeys(nextKeys);
      setWebhooks(nextWebhooks);
      setWallet(merchant.receivingWallet ?? null);
      setStale(false);
      hasSnapshotRef.current = true;
    } catch (cause) {
      setError(accessError(cause));
      setStale(hasSnapshotRef.current);
    } finally {
      setLoading(false);
    }
  }, [merchant.id, merchant.receivingWallet]);

  useEffect(() => { void load(); }, [load]);

  if (error && !stale && !loading) {
    return <section className="pay-security" aria-label={securityT(locale,'title')}>
      <div className="pay-security-state is-error" role="alert">
        <XCircle size={22}/>
        <span>{error==='unauthorized'?securityT(locale,'unauthorized'):error==='forbidden'?securityT(locale,'forbidden'):securityT(locale,'loadFailed')}</span>
        <button type="button" className="pay-secondary-action" onClick={()=>void load()}>{securityT(locale,'retry')}</button>
      </div>
    </section>;
  }

  const activeKeys = keys.filter(item => item.status === 'active').length;
  const revokedKeys = keys.filter(item => item.status === 'revoked').length;
  const expiredKeys = keys.filter(item => item.status === 'expired').length;
  const activeWebhooks = webhooks.filter(item => item.active).length;
  const signedWebhooks = webhooks.filter(item => item.signature_status === 'server_signed').length;
  const verifiedWallet = wallet?.isActive === true && wallet.verificationStatus === 'verified';

  return <section className="pay-security" aria-label={securityT(locale,'title')}>
    <div className="pay-security-heading">
      <div><span className="pay-panel-kicker">{securityT(locale,'title')}</span><h2>{securityT(locale,'title')}</h2><p>{securityT(locale,'subtitle')}</p></div>
      <button type="button" className="pay-secondary-action" onClick={()=>void load()} disabled={loading}><RefreshCw size={16}/>{securityT(locale,'refresh')}</button>
    </div>

    {stale && !loading ? <div className="pay-security-stale" role="status">{securityT(locale,'stale')}</div> : null}

    {loading ? <div className="pay-security-state"><Loader2 className="animate-spin" size={22}/>{securityT(locale,'loading')}</div> : null}

    {!loading ? <div className="pay-security-grid">
      <article className="pay-security-card">
        <div className="pay-security-card-icon"><ShieldCheck size={20}/></div>
        <div><span>{securityT(locale,'wallet')}</span><strong>{verifiedWallet?securityT(locale,'walletVerified'):securityT(locale,'walletUnknown')}</strong><small>{wallet?.address || securityT(locale,'noWallet')}</small></div>
      </article>
      <article className="pay-security-card">
        <div className="pay-security-card-icon"><KeyRound size={20}/></div>
        <div><span>{securityT(locale,'apiKeys')}</span><strong>{activeKeys} {securityT(locale,'activeKeys')}</strong><small>{revokedKeys} {securityT(locale,'revokedKeys')} · {expiredKeys} {securityT(locale,'expiredKeys')}</small></div>
      </article>
      <article className="pay-security-card">
        <div className="pay-security-card-icon"><Webhook size={20}/></div>
        <div><span>{securityT(locale,'webhooks')}</span><strong>{activeWebhooks} {securityT(locale,'activeWebhooks')}</strong><small>{signedWebhooks} {securityT(locale,'signedWebhooks')}</small></div>
      </article>
    </div> : null}

    {!loading ? <div className="pay-security-boundary">
      <div className="pay-security-boundary-icon"><CheckCircle2 size={18}/></div>
      <div><strong>{securityT(locale,'secureBoundary')}</strong><p>{securityT(locale,'secureBoundaryText')}</p></div>
      <span>{securityT(locale,'observed')}</span>
    </div> : null}

    {!loading ? <div className="pay-security-note"><Clock3 size={16}/><span>{securityT(locale,'notClaimed')}</span></div> : null}
  </section>;
}
