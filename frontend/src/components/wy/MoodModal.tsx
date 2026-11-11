'use client';

import { useState, type CSSProperties } from 'react';
import Guide58Modal from './Guide58Modal';
import Icon from './Icon';
import { useI18n } from '@/components/providers/I18nProvider';

export const MOODS: Array<{
  name: string;
  key: string;
  emoji: string;
  image?: string;
  color: string;
  soft: string;
}> = [
  // Las nueve emociones de v58 (emotionConfig), con su emoji y color.
  { name: 'Alegría', key: 'alegria', emoji: '😄', image: '/assets/moods/alegria.webp', color: '#F4B942', soft: '#FFF6D9' },
  { name: 'Calma', key: 'calma', image: '/assets/moods/calma.webp', emoji: '😌', color: '#42B8A8', soft: '#E2F7F3' },
  { name: 'Esperanza', key: 'esperanza', emoji: '🌱', image: '/assets/moods/esperanza.webp', color: '#62B878', soft: '#E8F6EC' },
  { name: 'Neutral', key: 'neutral', emoji: '😐', color: '#8B95A7', soft: '#EEF0F4' },
  { name: 'Tristeza', key: 'tristeza', emoji: '😔', image: '/assets/moods/tristeza.webp', color: '#5B84C4', soft: '#E7EFFB' },
  { name: 'Ansiedad', key: 'ansiedad', emoji: '😟', color: '#8B6CCF', soft: '#F0EAFB' },
  { name: 'Enojo', key: 'enojo', emoji: '😠', image: '/assets/moods/enojo.webp', color: '#E06A5F', soft: '#FCEAE7' },
  { name: 'Soledad', key: 'soledad', emoji: '🫥', color: '#6670A8', soft: '#EAECF5' },
  { name: 'Cansancio', key: 'cansancio', emoji: '😴', image: '/assets/moods/cansancio.webp', color: '#B08B68', soft: '#F5EEE7' },
];

export const MOOD_EMOJI: Record<string, string> = MOODS.reduce(
  (map, mood) => ({ ...map, [mood.name]: mood.emoji }),
  {} as Record<string, string>,
);

const DAYPARTS = ['Ahora', 'Mañana', 'Tarde', 'Noche', 'Todo el día'];

export const NOTE_MAX_LENGTH = 1000;

interface MoodModalProps {
  name: string;
  value: number;
  note: string;
  daypart: string;
  mode?: 'create' | 'edit';
  saving?: boolean;
  error?: string;
  onChangeName: (name: string) => void;
  onChangeValue: (value: number) => void;
  onChangeNote: (note: string) => void;
  onChangeDaypart: (daypart: string) => void;
  onSave: () => void;
  onClose: () => void;
}

export default function MoodModal({
  name,
  value,
  note,
  daypart,
  mode = 'create',
  saving = false,
  error,
  onChangeName,
  onChangeValue,
  onChangeNote,
  onChangeDaypart,
  onSave,
  onClose,
}: MoodModalProps) {
  const { t } = useI18n();
  const editing = mode === 'edit';
  const [guideOpen, setGuideOpen] = useState(false);

  if (guideOpen) {
    return <Guide58Modal type="emotion" onClose={() => setGuideOpen(false)} />;
  }

  return (
    <div className="modal mood-modal" role="dialog" aria-modal="true" aria-labelledby="privateMoodTitle">
      <div className="modal-head">
        <div>
          <span className="micro-label">REGISTRO PRIVADO</span>
          <h2 id="privateMoodTitle">{editing ? 'Editar registro' : '¿Cómo te sientes?'}</h2>
          <p>
            {editing
              ? 'Ajusta la emoción, la intensidad o tu nota. Solo tú puedes verlo.'
              : 'Opcional. Elige lo que más se acerca a este momento.'}
          </p>
        </div>
        <div className="modal-head-actions">
          <button className="guide-btn" type="button" onClick={() => setGuideOpen(true)}>
            <Icon name="help" />
            <span>Guía</span>
          </button>
          <button className="close" type="button" onClick={onClose} aria-label="Cerrar registro de emoción">
            <Icon name="x" />
          </button>
        </div>
      </div>

      <div className="mood-picker mood-picker-nine">
        {MOODS.map((mood) => (
          <button
            key={mood.name}
            className={`mood-pick ${mood.name === name ? 'selected' : ''}`}
            type="button"
            style={{ '--mood': mood.color, '--mood-soft': mood.soft } as CSSProperties}
            onClick={() => onChangeName(mood.name)}
          >
            {mood.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img className="mood-illustration" src={mood.image} alt="" width={34} height={34} />
            ) : (
              <span>{mood.emoji}</span>
            )}
            <small>{t(`mood.${mood.key}`)}</small>
          </button>
        ))}
      </div>

      <div className="range-wrap">
        <label>
          <span>¿Con qué intensidad?</span>
          <b>{value}/10</b>
        </label>
        <input
          type="range"
          min={1}
          max={10}
          value={value}
          onChange={(event) => onChangeValue(Number(event.target.value))}
          aria-label="Intensidad de la emoción"
        />
      </div>

      {editing ? null : (
        <div className="dayparts">
          {DAYPARTS.map((part) => (
            <button
              key={part}
              className={`daypart ${part === daypart ? 'selected' : ''}`}
              type="button"
              onClick={() => onChangeDaypart(part)}
            >
              {part}
            </button>
          ))}
        </div>
      )}

      <label className="diary-mood-note-label" htmlFor="privateMoodNote">
        Nota privada <span>(opcional)</span>
      </label>
      <textarea
        id="privateMoodNote"
        placeholder="Nota privada opcional: ¿qué pudo influir?"
        value={note}
        maxLength={NOTE_MAX_LENGTH}
        onChange={(event) => onChangeNote(event.target.value)}
      />

      {error ? (
        <div className="auth-error" role="alert" style={{ marginTop: 12 }}>
          {error}
        </div>
      ) : null}

      <div className="modal-actions">
        <button className="ghost" type="button" onClick={onClose} disabled={saving}>
          Cancelar
        </button>
        <button
          className="primary modal-save"
          type="button"
          onClick={onSave}
          disabled={saving}
        >
          {saving ? 'Guardando…' : editing ? 'Guardar cambios' : 'Guardar registro'}
        </button>
      </div>
    </div>
  );
}
