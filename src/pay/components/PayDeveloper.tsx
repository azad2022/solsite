import React from 'react';
import { BookOpen, Braces, ExternalLink, Network, ShieldCheck } from 'lucide-react';
import type { PayLocale } from '../types';
import { developerT } from './pay-developer-i18n';
import './pay-developer.css';

const DOCUMENTATION_RESOURCES = [
  { key: 'docs', href: '/api-docs/', icon: BookOpen },
  { key: 'openapi', href: '/openapi.json', icon: Braces },
  { key: 'catalog', href: '/.well-known/api-catalog', icon: Network },
] as const;

const DOCUMENTED_PAY_READ_CONTRACTS = [
  '/api/pay/v1/payment-intents/{id}',
  '/api/pay/v1/invoices',
  '/api/pay/v1/payment-links',
  '/api/pay/v1/referrals',
  '/api/pay/v1/customers',
  '/api/pay/v1/reports',
] as const;

export default function PayDeveloper({ locale }: { locale: PayLocale }): React.ReactElement {
  return (
    <section className="pay-developer" aria-labelledby="pay-developer-title">
      <div className="pay-developer-header">
        <div>
          <span className="pay-panel-kicker">{developerT(locale, 'kicker')}</span>
          <h2 id="pay-developer-title">{developerT(locale, 'title')}</h2>
          <p>{developerT(locale, 'description')}</p>
        </div>
        <div className="pay-developer-status" role="status">
          <ShieldCheck size={16} aria-hidden="true" />
          <span>{developerT(locale, 'contractBacked')}</span>
        </div>
      </div>

      <div className="pay-developer-grid">
        {DOCUMENTATION_RESOURCES.map(({ key, href, icon: Icon }) => (
          <a
            key={key}
            className="pay-developer-card"
            href={href}
            target="_blank"
            rel="noreferrer"
          >
            <span className="pay-developer-card-icon" aria-hidden="true"><Icon size={19} /></span>
            <span className="pay-developer-card-copy">
              <strong>{developerT(locale, key)}</strong>
              <span>{developerT(locale, `${key}Description` as 'docsDescription' | 'openapiDescription' | 'catalogDescription')}</span>
            </span>
            <ExternalLink size={16} aria-hidden="true" />
          </a>
        ))}
      </div>

      <div className="pay-developer-contracts">
        <div className="pay-developer-contracts-heading">
          <div>
            <span className="pay-panel-kicker">{developerT(locale, 'surfaceKicker')}</span>
            <h3>{developerT(locale, 'surfaceTitle')}</h3>
          </div>
          <span className="pay-developer-read-only">{developerT(locale, 'readOnly')}</span>
        </div>
        <p>{developerT(locale, 'surfaceDescription')}</p>
        <div className="pay-developer-endpoints" aria-label={developerT(locale, 'surfaceTitle')}>
          {DOCUMENTED_PAY_READ_CONTRACTS.map(path => <code key={path}>{path}</code>)}
        </div>
      </div>

      <div className="pay-developer-boundary">
        <ShieldCheck size={17} aria-hidden="true" />
        <p>{developerT(locale, 'boundaryNotice')}</p>
      </div>
    </section>
  );
}
