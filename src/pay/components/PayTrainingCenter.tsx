import React from 'react';
import { BookOpen, ChevronDown, ShieldCheck } from 'lucide-react';
import type { PayLocale } from '../types';
import { trainingT } from './pay-training-i18n';
import './pay-training.css';

interface Props { locale: PayLocale; }

export default function PayTrainingCenter({ locale }: Props): React.ReactElement {
  const copy = trainingT(locale);
  return (
    <section className="pay-training" aria-labelledby="pay-training-title">
      <header className="pay-training-header">
        <div className="pay-training-mark" aria-hidden="true"><BookOpen size={20} /></div>
        <div>
          <div className="pay-training-eyebrow">{copy.topicCount(copy.topics.length)}</div>
          <h2 id="pay-training-title">{copy.title}</h2>
          <p>{copy.subtitle}</p>
        </div>
      </header>
      <div className="pay-training-notice">
        <ShieldCheck size={16} aria-hidden="true" />
        <span>{copy.readBeforeTicket}</span>
      </div>
      <div className="pay-training-topics">
        {copy.topics.map((topic, index) => (
          <details key={topic.id} className="pay-training-topic" open={index === 0}>
            <summary>
              <span className="pay-training-index">{String(index + 1).padStart(2, '0')}</span>
              <span className="pay-training-summary-copy">
                <strong>{topic.title}</strong>
                <small>{topic.summary}</small>
              </span>
              <ChevronDown className="pay-training-chevron" size={17} aria-hidden="true" />
            </summary>
            <div className="pay-training-topic-body">
              <ol>
                {topic.steps.map(step => <li key={step}>{step}</li>)}
              </ol>
              <div className="pay-training-note"><span>!</span><p>{topic.note}</p></div>
            </div>
          </details>
        ))}
      </div>
    </section>
  );
}
