'use client';

import { useState } from 'react';
import Icon from './Icon';
import type { IconName } from './icons';
import { useI18n } from '@/components/providers/I18nProvider';

interface StartGuideModalProps {
  onClose: () => void;
  onShowChoices: () => void;
  onLocate: (index: number) => void;
}

const STEPS: {
  key: string;
  image: string;
  contextIcon: IconName;
  locateKey: string;
}[] = [
  {
    key: '1',
    image: '/assets/onboarding/write.svg',
    contextIcon: 'shield',
    locateKey: 'feed.guide.locate0',
  },
  {
    key: '2',
    image: '/assets/onboarding/format.svg',
    contextIcon: 'edit',
    locateKey: 'feed.guide.locate1',
  },
  {
    key: '3',
    image: '/assets/onboarding/published.svg',
    contextIcon: 'lock',
    locateKey: 'feed.guide.locate2',
  },
];

export default function StartGuideModal({
  onClose,
  onShowChoices,
  onLocate,
}: StartGuideModalProps) {
  const { t } = useI18n();
  const [current, setCurrent] = useState(0);
  const step = STEPS[current];
  const last = current === STEPS.length - 1;

  return (
    <section
      className="modal welcome-guide onboarding53"
      role="dialog"
      aria-modal="true"
      aria-labelledby="welcomeGuideTitle"
    >
      <div className="modal-head">
        <div>
          <span className="intro-kicker53">
            {t('feed.guide.kicker', { current: current + 1, total: STEPS.length })}
          </span>
          <h2 id="welcomeGuideTitle" tabIndex={-1}>
            {t(`feed.guide.step${step.key}.title`)}
          </h2>
        </div>
        <button className="close" type="button" onClick={onClose} aria-label={t('common.close')}>
          <Icon name="x" />
        </button>
      </div>

      <div className="intro-art53 intro-art54">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={step.image}
          alt={t(`feed.guide.step${step.key}.title`)}
          width={440}
          height={224}
        />
      </div>

      <p className="intro-copy53">{t(`feed.guide.step${step.key}.copy`)}</p>

      <p className="intro-context53">
        <Icon name={step.contextIcon} />
        <span>{t(`feed.guide.step${step.key}.context`)}</span>
      </p>

      <button className="intro-locate53" type="button" onClick={() => onLocate(current)}>
        {t(step.locateKey)} <Icon name="chevron" />
      </button>

      <nav className="intro-progress53" aria-label={t('feed.guide.kicker', { current: current + 1, total: STEPS.length })}>
        {STEPS.map((item, index) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setCurrent(index)}
            aria-label={t(`feed.guide.step${item.key}.title`)}
            aria-current={index === current ? 'step' : undefined}
          />
        ))}
      </nav>

      <div className="intro-actions53">
        <button
          className="ghost"
          type="button"
          onClick={() => setCurrent((value) => Math.max(0, value - 1))}
          disabled={current === 0}
        >
          {t('common.previous')}
        </button>
        <button
          className="primary"
          type="button"
          onClick={() => {
            if (last) onClose();
            else setCurrent((value) => value + 1);
          }}
        >
          {last ? t('feed.guide.start') : t('common.next')}
        </button>
      </div>

      <button className="intro-start54" type="button" onClick={onShowChoices}>
        {t('feed.guide.options')}
      </button>

      <button className="intro-skip53" type="button" onClick={onClose}>
        {t('feed.guide.skip')}
      </button>
    </section>
  );
}
