import React, { useState } from 'react';
import { CheckCircle2, Copy, Printer, ShieldCheck } from 'lucide-react';
import type { PayLocale } from '../types';
import type { PayPaymentReceipt } from '../payment-receipt-service';
import { directionFor } from '../i18n';
import { paymentReceiptLabel } from './pay-payment-receipt-i18n';

interface Props {
  locale: PayLocale;
  receipt: PayPaymentReceipt;
}

function formatAtomic(value: string, decimals: number): string {
  const normalized = value.trim();
  if (!/^\d+$/.test(normalized)) return normalized;
  if (decimals === 0) return normalized;
  const padded = normalized.padStart(decimals + 1, '0');
  const whole = padded.slice(0, -decimals) || '0';
  const fraction = padded.slice(-decimals).replace(/0+$/, '');
  return fraction ? whole + '.' + fraction : whole;
}

function address(value: string): string {
  return value.length > 20 ? value.slice(0, 10) + '…' + value.slice(-8) : value;
}

function date(value: string | null, locale: PayLocale): string {
  if (!value) return '—';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '—';
  return new Intl.DateTimeFormat(locale === 'ru' ? 'ru-RU' : locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(parsed);
}

export default function PayPaymentReceipt({ locale, receipt }: Props): React.ReactElement {
  const [copied, setCopied] = useState(false);
  const direction = directionFor(locale);
  const decimals = receipt.tokenDecimals ?? (receipt.asset === 'SOL' ? 9 : 0);

  const copySignature = async () => {
    if (!navigator.clipboard) return;
    try {
      await navigator.clipboard.writeText(receipt.transaction.signature);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch {
      setCopied(false);
    }
  };

  return (
    <section className="pay-receipt" dir={direction} lang={locale} aria-labelledby="pay-receipt-title">
      <div className="pay-receipt-header">
        <div className="pay-receipt-title-row">
          <div className="pay-receipt-status-icon" aria-hidden="true"><CheckCircle2 size={22} /></div>
          <div>
            <span className="pay-panel-kicker">{paymentReceiptLabel(locale, 'receipt')}</span>
            <h2 id="pay-receipt-title">{receipt.merchant.businessName}</h2>
            <p>{paymentReceiptLabel(locale, 'receiptReady')}</p>
          </div>
        </div>
        <div className="pay-receipt-actions">
          <button type="button" className="pay-secondary-action" onClick={() => window.print()}>
            <Printer size={15} /> {paymentReceiptLabel(locale, 'print')}
          </button>
          <button type="button" className="pay-secondary-action" onClick={() => void copySignature()}>
            {copied ? <CheckCircle2 size={15} /> : <Copy size={15} />}
            {copied ? paymentReceiptLabel(locale, 'copied') : paymentReceiptLabel(locale, 'copySignature')}
          </button>
        </div>
      </div>

      {receipt.paymentLink?.description ? (
        <div className="pay-receipt-description">
          <strong>{receipt.paymentLink.title}</strong>
          <p>{receipt.paymentLink.description}</p>
        </div>
      ) : null}

      <div className="pay-receipt-amount-grid">
        <div className="pay-receipt-amount-card">
          <span>{paymentReceiptLabel(locale, 'customerTotal')}</span>
          <strong>{formatAtomic(receipt.customerTotalAtomic, decimals)} {receipt.asset}</strong>
        </div>
        <div className="pay-receipt-amount-card">
          <span>{paymentReceiptLabel(locale, 'fee')}</span>
          <strong>{formatAtomic(receipt.feeAtomic, decimals)} {receipt.asset}</strong>
        </div>
        <div className="pay-receipt-amount-card">
          <span>{paymentReceiptLabel(locale, 'merchantSettlement')}</span>
          <strong>{formatAtomic(receipt.merchantSettlementAtomic, decimals)} {receipt.asset}</strong>
        </div>
      </div>

      <div className="pay-receipt-meta">
        <div><span>{paymentReceiptLabel(locale, 'paymentId')}</span><code>{receipt.id}</code></div>
        <div><span>{paymentReceiptLabel(locale, 'transactionId')}</span><code>{receipt.transaction.id}</code></div>
        <div><span>{paymentReceiptLabel(locale, 'transactionSignature')}</span><code>{receipt.transaction.signature}</code></div>
        <div><span>{paymentReceiptLabel(locale, 'destination')}</span><code>{address(receipt.recipient)}</code></div>
        <div><span>{paymentReceiptLabel(locale, 'reference')}</span><code>{receipt.reference}</code></div>
        <div><span>{paymentReceiptLabel(locale, 'network')}</span><strong>{receipt.network}</strong></div>
        <div><span>{paymentReceiptLabel(locale, 'commitment')}</span><strong>{receipt.verificationCommitment}</strong></div>
        <div><span>{paymentReceiptLabel(locale, 'verifiedAt')}</span><strong>{date(receipt.transaction.verifiedAt, locale)}</strong></div>
        <div><span>{paymentReceiptLabel(locale, 'blockTime')}</span><strong>{date(receipt.transaction.blockTime, locale)}</strong></div>
        <div><span>{paymentReceiptLabel(locale, 'slot')}</span><strong>{receipt.transaction.slot ?? '—'}</strong></div>
        <div><span>{paymentReceiptLabel(locale, 'verificationStatus')}</span><strong>{receipt.transaction.verificationStatus}</strong></div>
      </div>

      <details className="pay-receipt-technical">
        <summary><ShieldCheck size={15} /> {paymentReceiptLabel(locale, 'technicalDetails')} <span aria-hidden="true">+</span></summary>
        <div className="pay-receipt-technical-body">
          <div><span>{paymentReceiptLabel(locale, 'amount')}</span><code>{formatAtomic(receipt.amountAtomic, decimals)} {receipt.asset}</code></div>
          <div><span>{paymentReceiptLabel(locale, 'feePayer')}</span><code>{receipt.feePayer}</code></div>
          <div><span>{paymentReceiptLabel(locale, 'network')}</span><code>{receipt.network}</code></div>
          <div><span>{paymentReceiptLabel(locale, 'createdAt')}</span><code>{date(receipt.createdAt, locale)}</code></div>
          <div><span>{paymentReceiptLabel(locale, 'verifiedAt')}</span><code>{date(receipt.completedAt, locale)}</code></div>
          <div><span>{paymentReceiptLabel(locale, 'transactionSignature')}</span><code>{receipt.transaction.signature}</code></div>
        </div>
      </details>

      <div className="pay-receipt-footnote">{paymentReceiptLabel(locale, 'generatedFrom')}</div>
    </section>
  );
}
