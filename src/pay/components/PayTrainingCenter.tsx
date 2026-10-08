import React, { useMemo, useState } from 'react';
import { BookOpen, ChevronDown, Search, ShieldCheck, X } from 'lucide-react';
import type { PayLocale } from '../types';
import { trainingT } from './pay-training-i18n';
import './pay-training.css';

interface Props { locale: PayLocale; }

function localeForSearch(locale: PayLocale): string {
  if (locale === 'fa-IR') return 'fa-IR';
  if (locale === 'ar') return 'ar';
  if (locale === 'ru') return 'ru-RU';
  return 'en-US';
}

export default function PayTrainingCenter({ locale }: Props): React.ReactElement {
  const copy = trainingT(locale);
  const [query, setQuery] = useState('');

  const visibleTopics = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase(localeForSearch(locale));
    if (!normalized) return copy.topics;
    return copy.topics.filter(topic => [
      topic.title,
      topic.summary,
      topic.note,
      ...topic.steps,
    ].some(value => value.toLocaleLowerCase(localeForSearch(locale)).includes(normalized)));
  }, [copy.topics, locale, query]);

  return (
    <section className="pay-training" aria-labelledby="pay-training-title">
      <header className="pay-training-header">
        <div className="pay-training-mark" aria-hidden="true"><BookOpen size={20} /></div>
        <div className="pay-training-heading-copy">
          <div className="pay-training-eyebrow">{copy.topicCount(copy.topics.length)}</div>
          <h2 id="pay-training-title">{copy.title}</h2>
          <p>{copy.subtitle}</p>
        </div>
      </header>

      <div className="pay-training-notice">
        <ShieldCheck size={16} aria-hidden="true" />
        <span>{copy.readBeforeTicket}</span>
      </div>

      <div className="pay-training-toolbar">
        <label className="pay-training-search">
          <Search size={16} aria-hidden="true" />
          <span className="sr-only">{copy.searchLabel}</span>
          <input
            value={query}
            onChange={event => setQuery(event.target.value)}
            type="search"
            inputMode="search"
            autoComplete="off"
            placeholder={copy.searchPlaceholder}
          />
          {query ? (
            <button type="button" className="pay-training-search-clear" onClick={() => setQuery('')} aria-label={copy.clearSearch} title={copy.clearSearch}>
              <X size={15} aria-hidden="true" />
            </button>
          ) : null}
        </label>
        <span className="pay-training-result-count" aria-live="polite">
          {copy.resultCount(visibleTopics.length, copy.topics.length)}
        </span>
      </div>

      <div className="pay-training-topics" aria-live="polite">
        {visibleTopics.length ? visibleTopics.map((topic, index) => (
          <details key={topic.id} className="pay-training-topic" open={!query && index === 0}>
            <summary>
              <span className="pay-training-index">{String(copy.topics.indexOf(topic) + 1).padStart(2, '0')}</span>
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
        )) : (
          <div className="pay-training-no-results">
            <Search size={20} aria-hidden="true" />
            <strong>{copy.noResultsTitle}</strong>
            <p>{copy.noResultsDescription}</p>
          </div>
        )}
      </div>
    </section>
  );
}
