import React from 'react';
import { Code2, LockKeyhole } from 'lucide-react';
import type { PayLocale, PaySection } from '../types';
import { payUnavailableT } from './pay-unavailable-i18n';
import './pay-unavailable.css';

interface Props { locale: PayLocale; section: PaySection; }

export default function PayUnavailableFeature({ locale, section }: Props): React.ReactElement {
  return <section className="pay-unavailable" aria-labelledby="pay-unavailable-title">
    <div className="pay-unavailable-icon" aria-hidden="true"><Code2 size={22}/></div>
    <div className="pay-unavailable-copy">
      <span className="pay-panel-kicker">{payUnavailableT(locale,'contractState')}</span>
      <h2 id="pay-unavailable-title">{payUnavailableT(locale,'backendUnavailable')}</h2>
      <p>{payUnavailableT(locale,'backendUnavailableText')}</p>
      <code>{section}</code>
    </div>
    <div className="pay-unavailable-status"><LockKeyhole size={16}/><span>{payUnavailableT(locale,'notReleased')}</span></div>
  </section>;
}
