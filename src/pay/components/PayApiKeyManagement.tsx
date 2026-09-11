import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Check, CheckCircle2, Clipboard, KeyRound, Loader2, Plus, RefreshCw, RotateCw, ShieldCheck, Trash2, X } from 'lucide-react';
import type { PayLocale } from '../types';
import { PayHttpError } from '../http';
import { createMerchantApiKey, listMerchantApiKeys, revokeMerchantApiKey, rotateMerchantApiKey, type PayApiKey, type PayApiKeyMutationResult } from '../services/apiKeyService';
import { apiKeyT } from './pay-api-keys-i18n';
import './pay-api-keys.css';

interface Props { locale: PayLocale; merchantId: string | null; merchantStatus?: 'pending' | 'active' | 'suspended' | 'closed'; }
type LoadState = 'loading' | 'ready' | 'error';
type Mutation = 'create' | 'revoke' | 'rotate' | null;

function formatDate(value: string | null, locale: PayLocale): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

function inputToIso(value: string): string | null {
  return value ? new Date(value).toISOString() : null;
}

function localInputMin(): string {
  const now = new Date();
  now.setMinutes(now.getMinutes() + 5);
  now.setSeconds(0, 0);
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

function errorText(error: unknown, locale: PayLocale): string {
  if (error instanceof PayHttpError) {
    if (error.status === 401) return apiKeyT(locale, 'unauthorized');
    if (error.status === 403) return apiKeyT(locale, 'forbidden');
    if (error.status >= 500) return apiKeyT(locale, 'serviceUnavailable');
    return error.message || apiKeyT(locale, 'operationFailed');
  }
  return error instanceof Error ? error.message : apiKeyT(locale, 'operationFailed');
}

export default function PayApiKeyManagement({ locale, merchantId, merchantStatus = 'active' }: Props): React.ReactElement {
  const [keys, setKeys] = useState<PayApiKey[]>([]);
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [loadError, setLoadError] = useState('');
  const [mutation, setMutation] = useState<Mutation>(null);
  const [name, setName] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [secretResult, setSecretResult] = useState<PayApiKeyMutationResult | null>(null);
  const [copyState, setCopyState] = useState(false);
  const minDate = useMemo(localInputMin, []);

  const load = async () => {
    if (!merchantId) {
      setKeys([]);
      setLoadState('ready');
      setLoadError('');
      return;
    }
    setLoadState('loading');
    setLoadError('');
    try {
      setKeys(await listMerchantApiKeys(merchantId));
      setLoadState('ready');
    } catch (error) {
      setLoadState('error');
      setLoadError(errorText(error, locale));
    }
  };

  useEffect(() => { void load(); }, [merchantId]);

  const resetForm = () => { setName(''); setExpiresAt(''); };

  const create = async () => {
    if (!merchantId || !name.trim()) { setLoadError(apiKeyT(locale, 'validation')); setLoadState('error'); return; }
    setMutation('create');
    setLoadError('');
    try {
      const result = await createMerchantApiKey(merchantId, { name, expiresAt: inputToIso(expiresAt) });
      setSecretResult(result);
      resetForm();
      await load();
    } catch (error) {
      setLoadError(errorText(error, locale));
      setLoadState('error');
    } finally {
      setMutation(null);
    }
  };

  const revoke = async (key: PayApiKey) => {
    if (!merchantId || key.status === 'revoked' || !window.confirm(apiKeyT(locale, 'confirmRevoke'))) return;
    setMutation('revoke');
    setLoadError('');
    try {
      const revoked = await revokeMerchantApiKey(merchantId, key.id);
      setKeys(current => current.map(item => item.id === revoked.id ? revoked : item));
    } catch (error) {
      setLoadError(errorText(error, locale));
    } finally {
      setMutation(null);
    }
  };

  const rotate = async (key: PayApiKey) => {
    if (!merchantId || key.status !== 'active' || merchantStatus !== 'active' || !window.confirm(apiKeyT(locale, 'confirmRotate'))) return;
    setMutation('rotate');
    setLoadError('');
    try {
      const result = await rotateMerchantApiKey(merchantId, key.id, { name: key.name, expiresAt: key.expiresAt });
      setSecretResult(result);
      await load();
    } catch (error) {
      setLoadError(errorText(error, locale));
    } finally {
      setMutation(null);
    }
  };

  const copySecret = async () => {
    if (!secretResult?.secret || !navigator.clipboard) return;
    try {
      await navigator.clipboard.writeText(secretResult.secret);
      setCopyState(true);
      window.setTimeout(() => setCopyState(false), 1400);
    } catch { setCopyState(false); }
  };

  if (!merchantId) {
    return <section className="pay-panel pay-api-keys" aria-labelledby="pay-api-keys-title"><div className="pay-api-empty"><div className="pay-empty-icon"><KeyRound size={21} /></div><div><h2 id="pay-api-keys-title">{apiKeyT(locale, 'title')}</h2><p>{apiKeyT(locale, 'merchantRequired')}</p></div></div></section>;
  }

  const canMutate = merchantStatus === 'active';

  return (
    <section className="pay-panel pay-api-keys" aria-labelledby="pay-api-keys-title">
      <div className="pay-panel-heading pay-api-heading">
        <div><span className="pay-panel-kicker">{apiKeyT(locale, 'scope')}</span><h2 id="pay-api-keys-title">{apiKeyT(locale, 'title')}</h2><p>{apiKeyT(locale, 'description')}</p></div>
        <button type="button" className="pay-icon-button" onClick={() => void load()} disabled={loadState === 'loading' || mutation !== null} aria-label={apiKeyT(locale, 'retry')} title={apiKeyT(locale, 'retry')}><RefreshCw size={17} /></button>
      </div>

      <div className="pay-api-scope-note"><ShieldCheck size={16} /><span>{apiKeyT(locale, 'manageHint')}</span></div>

      {loadError && <div className="pay-api-error" role="alert"><AlertTriangle size={17} /><span>{loadError}</span>{loadState === 'error' && <button type="button" onClick={() => void load()}>{apiKeyT(locale, 'retry')}</button>}</div>}

      <div className="pay-api-create">
        <div className="pay-api-create-heading"><div><strong>{apiKeyT(locale, 'create')}</strong><span>{apiKeyT(locale, 'manageHint')}</span></div><Plus size={17} /></div>
        <div className="pay-api-form-grid">
          <label><span>{apiKeyT(locale, 'keyName')}</span><input value={name} maxLength={120} onChange={event => setName(event.target.value)} placeholder={apiKeyT(locale, 'keyNamePlaceholder')} disabled={!canMutate || mutation !== null} autoComplete="off" /></label>
          <label><span>{apiKeyT(locale, 'expiration')}</span><input type="datetime-local" min={minDate} value={expiresAt} onChange={event => setExpiresAt(event.target.value)} disabled={!canMutate || mutation !== null} /></label>
          <button type="button" className="pay-primary-action" onClick={() => void create()} disabled={!canMutate || mutation !== null || !name.trim()}>{mutation === 'create' ? <Loader2 className="animate-spin" size={17} /> : <KeyRound size={17} />} {apiKeyT(locale, 'createKey')}</button>
        </div>
        {!canMutate && <small className="pay-api-disabled-note">{apiKeyT(locale, 'forbidden')}</small>}
      </div>

      {loadState === 'loading' ? <div className="pay-api-loading" aria-live="polite"><Loader2 className="animate-spin" size={19} />{apiKeyT(locale, 'loading')}</div> : keys.length === 0 ? <div className="pay-api-empty"><div className="pay-empty-icon"><KeyRound size={20} /></div><div><strong>{apiKeyT(locale, 'emptyTitle')}</strong><p>{apiKeyT(locale, 'emptyDescription')}</p></div></div> : <div className="pay-api-list">
        {keys.map(key => <article className={`pay-api-key-card is-${key.status}`} key={key.id}>
          <div className="pay-api-key-main">
            <div className="pay-api-key-icon"><KeyRound size={18} /></div>
            <div className="pay-api-key-copy"><strong>{key.name}</strong><code>{key.keyPrefix}••••••••</code><small>{apiKeyT(locale, 'scope')}: {key.scopes.join(', ')}</small></div>
            <span className={`pay-api-status is-${key.status}`}>{apiKeyT(locale, key.status)}</span>
          </div>
          <dl className="pay-api-key-meta"><div><dt>{apiKeyT(locale, 'created')}</dt><dd>{formatDate(key.createdAt, locale)}</dd></div><div><dt>{apiKeyT(locale, 'expiration')}</dt><dd>{key.expiresAt ? formatDate(key.expiresAt, locale) : apiKeyT(locale, 'never')}</dd></div><div><dt>{apiKeyT(locale, 'lastUsed')}</dt><dd>{formatDate(key.lastUsedAt, locale) === '—' ? apiKeyT(locale, 'neverUsed') : formatDate(key.lastUsedAt, locale)}</dd></div></dl>
          <div className="pay-api-key-actions">
            <button type="button" className="pay-secondary-action" onClick={() => void rotate(key)} disabled={mutation !== null || key.status !== 'active' || !canMutate} title={apiKeyT(locale, 'rotate')}><RotateCw size={15} /> {apiKeyT(locale, 'rotate')}</button>
            <button type="button" className="pay-danger-action" onClick={() => void revoke(key)} disabled={mutation !== null || key.status === 'revoked'} title={apiKeyT(locale, 'revoke')}><Trash2 size={15} /> {apiKeyT(locale, 'revoke')}</button>
          </div>
        </article>)}
      </div>}

      {secretResult && <div className="pay-api-secret" role="dialog" aria-modal="true" aria-labelledby="pay-api-secret-title">
        <div className="pay-api-secret-inner"><div className="pay-api-secret-icon"><CheckCircle2 size={21} /></div><div className="pay-api-secret-copy"><h3 id="pay-api-secret-title">{apiKeyT(locale, 'secretTitle')}</h3><p>{apiKeyT(locale, 'secretDescription')}</p><div className="pay-api-secret-value"><code>{secretResult.secret || apiKeyT(locale, 'replaySecretUnavailable')}</code>{secretResult.secret && <button type="button" onClick={() => void copySecret()} aria-label={apiKeyT(locale, 'copySecret')} title={apiKeyT(locale, 'copySecret')}>{copyState ? <Check size={16} /> : <Clipboard size={16} />}</button>}</div><div className="pay-api-secret-warning"><AlertTriangle size={16} /><span>{apiKeyT(locale, 'secretWarning')}</span></div></div><button type="button" className="pay-icon-button" onClick={() => setSecretResult(null)} aria-label={apiKeyT(locale, 'closeSecret')}><X size={17} /></button></div>
        {copyState && <small className="pay-api-copied">{apiKeyT(locale, 'copied')}</small>}
      </div>}
    </section>
  );
}
