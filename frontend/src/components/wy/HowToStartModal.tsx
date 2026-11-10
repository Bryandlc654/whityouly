'use client';

import Icon from './Icon';
import { useI18n } from '@/components/providers/I18nProvider';

interface Props {
  onClose: () => void;
  onRead: () => void;
  onWrite: () => void;
  onMood: () => void;
  onShowGuide: () => void;
}

const CHOICES = [
  {
    id: 'read',
    icon: 'book' as const,
    titleKey: 'feed.intro.read',
    copyKey: 'feed.intro.readCopy',
  },
  {
    id: 'write',
    icon: 'edit' as const,
    titleKey: 'feed.intro.write',
    copyKey: 'feed.intro.writeCopy',
  },
  {
    id: 'mood',
    icon: 'pulse' as const,
    titleKey: 'feed.intro.mood',
    copyKey: 'feed.intro.moodCopy',
  },
];

export default function HowToStartModal({
  onClose,
  onRead,
  onWrite,
  onMood,
  onShowGuide,
}: Props) {
  const { t } = useI18n();
  const actions = { read: onRead, write: onWrite, mood: onMood };

  return (
    <section
      className="modal welcome-guide onboarding53"
      role="dialog"
      aria-modal="true"
      aria-labelledby="welcomeGuideTitle"
    >
      <div className="modal-head">
        <div>
          <h2 id="welcomeGuideTitle" tabIndex={-1}>
            {t('feed.intro.title')}
          </h2>
        </div>
        <button className="close" type="button" onClick={onClose} aria-label={t('common.close')}>
          <Icon name="x" />
        </button>
      </div>

      <p className="intro-options54">{t('feed.intro.copy')}</p>

      <div className="welcome-choices">
        {CHOICES.map((choice) => (
          <button
            key={choice.id}
            type="button"
            onClick={actions[choice.id as keyof typeof actions]}
          >
            <Icon name={choice.icon} />
            <span>
              <b>{t(choice.titleKey)}</b>
              <small>{t(choice.copyKey)}</small>
            </span>
            <Icon name="chevron" />
          </button>
        ))}
      </div>

      <button className="intro-optional54" type="button" onClick={onShowGuide}>
        <Icon name="book" /> {t('feed.intro.showGuide')}
      </button>

      <button className="intro-skip53" type="button" onClick={onClose}>
        {t('feed.intro.skip')}
      </button>
    </section>
  );
}
