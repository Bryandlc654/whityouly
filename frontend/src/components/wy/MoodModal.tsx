'use client';

import Icon from './Icon';

export const MOODS = [
  { name: 'Calma', emoji: '😌' },
  { name: 'Ansiedad', emoji: '😰' },
  { name: 'Neutral', emoji: '😐' },
  { name: 'Tristeza', emoji: '😢' },
  { name: 'Esperanza', emoji: '🌈' },
] as const;

export const MOOD_EMOJI: Record<string, string> = MOODS.reduce(
  (map, mood) => ({ ...map, [mood.name]: mood.emoji }),
  {} as Record<string, string>,
);

const DAYPARTS = ['Todo el día', 'Mañana', 'Tarde', 'Noche'];

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
  const editing = mode === 'edit';

  return (
    <div className="modal" role="dialog" aria-modal="true" aria-label="Registrar estado emocional">
      <div className="modal-head">
        <div>
          <h2>{editing ? 'Editar registro' : '¿Cómo te sientes?'}</h2>
          <p>
            {editing
              ? 'Ajusta la emoción, la intensidad o tu nota. Solo tú puedes verlo.'
              : 'Un registro rápido y privado. Puedes hacerlo una vez o varias veces al día.'}
          </p>
        </div>
        <button className="close" type="button" onClick={onClose} aria-label="Cerrar">
          <Icon name="x" />
        </button>
      </div>

      <div className="mood-picker">
        {MOODS.map((mood) => (
          <button
            key={mood.name}
            className={`mood-pick ${mood.name === name ? 'selected' : ''}`}
            type="button"
            onClick={() => onChangeName(mood.name)}
          >
            <span>{mood.emoji}</span>
            <small>{mood.name}</small>
          </button>
        ))}
      </div>

      <div className="range-wrap">
        <label>
          <span>Intensidad</span>
          <b>{value}/10</b>
        </label>
        <input
          type="range"
          min={1}
          max={10}
          value={value}
          onChange={(event) => onChangeValue(Number(event.target.value))}
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

      <textarea
        placeholder="Nota privada opcional: ¿qué pudo influir? (contexto, personas, momento)"
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
          className="primary"
          type="button"
          style={{ padding: '11px 17px' }}
          onClick={onSave}
          disabled={saving}
        >
          {saving ? 'Guardando…' : editing ? 'Guardar cambios' : 'Guardar registro'}
        </button>
      </div>
    </div>
  );
}
