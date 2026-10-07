'use client';

import Icon from './Icon';

export const MOODS = [
  { name: 'Calma', glyph: '☁' },
  { name: 'Ansiedad', glyph: '≈' },
  { name: 'Neutral', glyph: '—' },
  { name: 'Tristeza', glyph: '⌣' },
  { name: 'Esperanza', glyph: '✦' },
] as const;

const DAYPARTS = ['Todo el día', 'Mañana', 'Tarde', 'Noche'];

interface MoodModalProps {
  name: string;
  value: number;
  daypart: string;
  onChangeName: (name: string) => void;
  onChangeValue: (value: number) => void;
  onChangeDaypart: (daypart: string) => void;
  onSave: () => void;
  onClose: () => void;
}

export default function MoodModal({
  name,
  value,
  daypart,
  onChangeName,
  onChangeValue,
  onChangeDaypart,
  onSave,
  onClose,
}: MoodModalProps) {
  return (
    <div className="modal" role="dialog" aria-modal="true" aria-label="Registrar estado emocional">
      <div className="modal-head">
        <div>
          <h2>¿Cómo te sientes?</h2>
          <p>Un registro rápido y privado. Puedes hacerlo una vez o varias veces al día.</p>
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
            <span>{mood.glyph}</span>
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

      <textarea placeholder="Nota privada opcional: ¿qué pudo influir?" />

      <div className="modal-actions">
        <button className="ghost" type="button" onClick={onClose}>
          Cancelar
        </button>
        <button className="primary" type="button" style={{ padding: '11px 17px' }} onClick={onSave}>
          Guardar registro
        </button>
      </div>
    </div>
  );
}
