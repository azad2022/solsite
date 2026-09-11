import React, { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, Clock3, ExternalLink, KeyRound, RefreshCw, ShieldCheck, Webhook as WebhookIcon, XCircle } from 'lucide-react';
import { webhookCopy } from './pay-webhooks-i18n';
import { payWebhookService, type PayWebhook, type PayWebhookDelivery } from '../services/webhookService';
import type { PayLocale } from '../types';
import './pay-webhooks.css';

interface Props { locale: PayLocale; merchantId: string; }
type LoadState = 'loading' | 'ready' | 'error';

function formatDate(value: string | null, locale: PayLocale): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

function shortHash(value: string | null): string {
  return value ? `${value.slice(0, 10)}…${value.slice(-8)}` : '—';
}

export default function PayWebhooks({ locale, merchantId }: Props): React.ReactElement {
  const text = webhookCopy(locale);
  const [state, setState] = useState<LoadState>('loading');
  const [webhooks, setWebhooks] = useState<PayWebhook[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [deliveries, setDeliveries] = useState<PayWebhookDelivery[]>([]);
  const [selected, setSelected] = useState<PayWebhook | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (keepSelection = true) => {
    setState('loading');
    try {
      const rows = await payWebhookService.list(merchantId);
      setWebhooks(rows);
      const nextId = keepSelection && selectedId && rows.some(row => row.id === selectedId) ? selectedId : rows[0]?.id ?? null;
      setSelectedId(nextId);
      if (nextId) {
        const detail = await payWebhookService.get(merchantId, nextId);
        setSelected(detail.webhook);
        setDeliveries(detail.deliveries);
      } else {
        setSelected(null);
        setDeliveries([]);
      }
      setState('ready');
    } catch {
      setState('error');
    }
  }, [merchantId, selectedId]);

  useEffect(() => { void load(false); }, [load]);

  const choose = async (webhook: PayWebhook) => {
    setSelectedId(webhook.id);
    setSelected(webhook);
    try {
      const detail = await payWebhookService.get(merchantId, webhook.id);
      setSelected(detail.webhook);
      setDeliveries(detail.deliveries);
    } catch {
      setDeliveries([]);
    }
  };

  const refresh = async () => {
    setRefreshing(true);
    try { await load(true); } finally { setRefreshing(false); }
  };

  if (state === 'loading') {
    return <section className="pay-panel pay-webhooks-shell" aria-live="polite"><div className="pay-webhooks-state"><RefreshCw className="pay-webhooks-spin" size={20} /><span>{text.loading}</span></div></section>;
  }
  if (state === 'error') {
    return <section className="pay-panel pay-webhooks-shell"><div className="pay-webhooks-state is-error"><XCircle size={20} /><strong>{text.errorTitle}</strong><button type="button" className="pay-secondary-action" onClick={() => void load(true)}>{text.retry}</button></div></section>;
  }

  return (
    <section className="pay-webhooks-shell" aria-labelledby="pay-webhooks-title">
      <div className="pay-webhooks-toolbar">
        <div><h2 id="pay-webhooks-title">{text.title}</h2><p>{text.description}</p></div>
        <button type="button" className="pay-secondary-action" onClick={() => void refresh()} disabled={refreshing}>
          <RefreshCw size={16} className={refreshing ? 'pay-webhooks-spin' : undefined} />{text.refresh}
        </button>
      </div>

      <div className="pay-webhooks-layout">
        <div className="pay-webhook-list" aria-label={text.title}>
          {webhooks.length === 0 ? <div className="pay-webhooks-empty"><WebhookIcon size={22} /><p>{text.noWebhooks}</p></div> : webhooks.map(webhook => (
            <button key={webhook.id} type="button" className={`pay-webhook-row ${webhook.id === selectedId ? 'is-selected' : ''}`} onClick={() => void choose(webhook)}>
              <span className="pay-webhook-row-icon"><WebhookIcon size={17} /></span>
              <span className="pay-webhook-row-copy"><strong>{webhook.endpoint_url}</strong><small>{webhook.status} · {webhook.failure_count} {text.failures.toLowerCase()}</small></span>
              <span className={`pay-webhook-state-dot ${webhook.active ? 'is-active' : 'is-inactive'}`} aria-label={webhook.active ? text.active : text.inactive} />
            </button>
          ))}
        </div>

        <div className="pay-webhook-detail">
          {!selected ? <div className="pay-webhooks-empty large"><ShieldCheck size={23} /><p>{text.select}</p></div> : <>
            <div className="pay-webhook-detail-head">
              <div><span className="pay-panel-kicker">{text.endpoint}</span><h3>{selected.endpoint_url}</h3></div>
              <a href={selected.endpoint_url} target="_blank" rel="noreferrer noopener" className="pay-icon-button" aria-label={text.endpoint} title={text.endpoint}><ExternalLink size={16} /></a>
            </div>

            <div className="pay-webhook-summary">
              <Summary icon={<ShieldCheck size={17} />} label={text.status} value={selected.active ? text.active : text.inactive} />
              <Summary icon={<KeyRound size={17} />} label={text.secret} value={selected.secret_configured ? text.configured : text.notConfigured} />
              <Summary icon={<CheckCircle2 size={17} />} label={text.signature} value={selected.signature_status === 'server_signed' ? text.serverSigned : text.notConfiguredSignature} />
              <Summary icon={<Clock3 size={17} />} label={text.lastAttempt} value={formatDate(deliveries[0]?.last_attempt_at ?? deliveries[0]?.created_at ?? null, locale)} />
            </div>

            <div className="pay-webhook-subscriptions">
              <span>{text.event}</span>
              <div>{selected.subscribed_events.length ? selected.subscribed_events.map(event => <code key={event}>{event}</code>) : <span>—</span>}</div>
            </div>

            <div className="pay-webhook-history">
              <div className="pay-panel-heading"><div><span className="pay-panel-kicker">{text.deliveries}</span><h3>{text.history}</h3></div><span className="pay-panel-chip">{selected.failure_count} {text.failures}</span></div>
              {deliveries.length === 0 ? <div className="pay-webhooks-empty"><Clock3 size={20} /><p>{text.noDeliveries}</p></div> : <div className="pay-webhook-table-wrap">
                <table className="pay-webhook-table">
                  <thead><tr><th>{text.event}</th><th>{text.status}</th><th>{text.attempts}</th><th>{text.response}</th><th>{text.lastAttempt}</th><th>{text.error}</th></tr></thead>
                  <tbody>{deliveries.map(delivery => <tr key={delivery.id}>
                    <td><strong>{delivery.event_type}</strong><small>{shortHash(delivery.event_id)}</small></td>
                    <td><span className={`pay-webhook-delivery-status ${delivery.status}`}>{delivery.status}</span></td>
                    <td>{delivery.attempt_count}</td>
                    <td>{delivery.response_status ?? '—'}</td>
                    <td>{formatDate(delivery.last_attempt_at ?? delivery.created_at, locale)}</td>
                    <td>{delivery.error_code ?? '—'}</td>
                  </tr>)}</tbody>
                </table>
              </div>}
            </div>
            <p className="pay-webhook-readonly-note"><ShieldCheck size={16} />{text.readOnly}</p>
          </>}
        </div>
      </div>
    </section>
  );
}

function Summary({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }): React.ReactElement {
  return <div className="pay-webhook-summary-item"><span className="pay-webhook-summary-icon">{icon}</span><small>{label}</small><strong>{value}</strong></div>;
}
