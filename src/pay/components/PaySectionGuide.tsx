import React from 'react';
import { BookOpen, ChevronDown } from 'lucide-react';
import type { PayLocale, PaySection } from '../types';
import { trainingT } from './pay-training-i18n';
import { dedicatedSectionGuideTopic, sectionGuideChrome, type PaySectionGuideTopic } from './pay-section-guide-i18n';
import './pay-section-guide.css';

const SECTION_TOPIC_IDS: Partial<Record<PaySection,string>> = {
  overview:'overview', dashboard:'overview', checkout:'checkout', transactions:'transactions', merchants:'onboarding', wallet:'account-wallet',
  customers:'customers', referrals:'referrals', reports:'reports', developer:'developer', security:'security', tickets:'tickets', webhooks:'developer'
};

function topicForSection(locale:PayLocale, section:PaySection):PaySectionGuideTopic|null {
  if (section==='invoices'||section==='payment-links'||section==='bulk-pay'||section==='api-keys') return dedicatedSectionGuideTopic(locale,section);
  const topicId=SECTION_TOPIC_IDS[section];
  if (!topicId) return null;
  return trainingT(locale).topics.find(topic=>topic.id===topicId) ?? null;
}

export default function PaySectionGuide({locale,section}:{locale:PayLocale;section:PaySection}):React.ReactElement|null {
  const topic=topicForSection(locale,section);
  if(!topic) return null;
  const copy=sectionGuideChrome(locale);
  return <details className="pay-section-guide">
    <summary title={copy.expand} aria-label={topic.title+' — '+copy.kicker}>
      <span className="pay-section-guide-icon" aria-hidden="true"><BookOpen size={17}/></span>
      <span className="pay-section-guide-summary"><small>{copy.kicker}</small><strong>{topic.title}</strong><span>{topic.summary}</span></span>
      <span className="pay-section-guide-toggle"><span className="pay-section-guide-toggle-open">{copy.expand}</span><span className="pay-section-guide-toggle-close">{copy.collapse}</span><ChevronDown className="pay-section-guide-chevron" size={16} aria-hidden="true"/></span>
    </summary>
    <div className="pay-section-guide-body">
      <div className="pay-section-guide-heading"><span>{copy.purpose}</span><p>{topic.summary}</p></div>
      <div className="pay-section-guide-content">
        <div><h3>{copy.steps}</h3><ol>{topic.steps.map((step,index)=><li key={step}><span>{String(index+1).padStart(2,'0')}</span><p>{step}</p></li>)}</ol></div>
        <aside className="pay-section-guide-note"><span>{copy.note}</span><p>{topic.note}</p></aside>
      </div>
    </div>
  </details>;
}
