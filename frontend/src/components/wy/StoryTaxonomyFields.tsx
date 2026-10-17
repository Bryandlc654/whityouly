'use client';

import { useState, type CSSProperties } from 'react';
import Icon from './Icon';
import type { IconName } from './icons';
import type { TaxonomyCatalog } from '@/lib/taxonomy';
import type { StoryVisibility } from '@/lib/stories';

/** Emoji por emoción del catálogo, para reconocerlas de un vistazo. */
export const EMOTION_EMOJI: Record<string, string> = {
  Alegría: '😊',
  Ansiedad: '😰',
  Calma: '😌',
  Esperanza: '🌱',
  Gratitud: '🙏',
  Ira: '😠',
  Miedo: '😨',
  Neutral: '😐',
  Soledad: '🌧️',
  Tristeza: '😢',
};

/** Emoji por categoría, como pista visual en el selector. */
export const CATEGORY_EMOJI: Record<string, string> = {
  Ansiedad: '😰',
  Aprendizaje: '📚',
  Autoestima: '💪',
  Cambio: '🔄',
  Esperanza: '🌱',
  Familia: '🏡',
  Gratitud: '🙏',
  Pérdida: '🕯️',
  Relaciones: '💞',
  Salud: '🩺',
  Soledad: '🌧️',
  Trabajo: '💼',
};

const VISIBILITY_OPTIONS: { value: StoryVisibility; label: string; icon: IconName; hint: string }[] = [
  { value: 'PUBLIC', label: 'Público', icon: 'globe', hint: 'Lo ve toda la comunidad.' },
  { value: 'FOLLOWERS', label: 'Seguidores', icon: 'users', hint: 'Solo quienes te siguen.' },
  { value: 'PRIVATE', label: 'Privado', icon: 'lock', hint: 'Solo para ti.' },
];

function emojiFor(name: string, map: Record<string, string>, fallback: string): string {
  return map[name] ?? fallback;
}

interface Props {
  catalog: TaxonomyCatalog | null;
  visibility: StoryVisibility;
  category: string | null;
  emotions: string[];
  tags: string[];
  onVisibility: (value: StoryVisibility) => void;
  onCategory: (value: string | null) => void;
  onEmotions: (value: string[]) => void;
  onTags: (value: string[]) => void;
  maxEmotions?: number;
  maxTags?: number;
}

/**
 * Selector de metadatos de un relato: visibilidad, categoría, emociones y
 * etiquetas. Categoría y etiquetas se pliegan en controles compactos y las
 * emociones se muestran como chips con emoji, para no llenar la pantalla de
 * decenas de etiquetas de texto.
 */
export default function StoryTaxonomyFields({
  catalog,
  visibility,
  category,
  emotions,
  tags,
  onVisibility,
  onCategory,
  onEmotions,
  onTags,
  maxEmotions = 5,
  maxTags = 10,
}: Props) {
  const [showTags, setShowTags] = useState(false);

  const categories = catalog?.categories ?? [];
  const emotionOptions = catalog?.emotions ?? [];
  const tagOptions = catalog?.tags ?? [];

  const toggle = (list: string[], setList: (next: string[]) => void, value: string, max: number) => {
    if (list.includes(value)) {
      setList(list.filter((item) => item !== value));
      return;
    }
    if (list.length >= max) return;
    setList([...list, value]);
  };

  const activeVisibility = VISIBILITY_OPTIONS.find((option) => option.value === visibility);

  return (
    <div className="story-taxonomy">
      {/* Visibilidad */}
      <div className="opt-block">
        <span className="opt-label">
          Visibilidad
          <span className="opt-hint">{activeVisibility?.hint}</span>
        </span>
        <div className="segmented opt-segmented" role="group" aria-label="Visibilidad">
          {VISIBILITY_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              className={visibility === option.value ? 'active' : undefined}
              aria-pressed={visibility === option.value}
              onClick={() => onVisibility(option.value)}
            >
              <Icon name={option.icon} /> {option.label}
            </button>
          ))}
        </div>
      </div>

      {/* Categoría */}
      {categories.length > 0 ? (
        <div className="opt-block">
          <span className="opt-label">Categoría</span>
          <div className="opt-select">
            <span className="opt-select-emoji" aria-hidden>
              {category ? emojiFor(category, CATEGORY_EMOJI, '🏷️') : '🏷️'}
            </span>
            <select
              value={category ?? ''}
              aria-label="Categoría"
              onChange={(event) => onCategory(event.target.value || null)}
            >
              <option value="">Elige una categoría…</option>
              {categories.map((item) => (
                <option key={item.id} value={item.name}>
                  {emojiFor(item.name, CATEGORY_EMOJI, '🏷️')} {item.name}
                </option>
              ))}
            </select>
            <Icon name="chevron" />
          </div>
        </div>
      ) : null}

      {/* Emociones */}
      {emotionOptions.length > 0 ? (
        <div className="opt-block">
          <span className="opt-label">
            Emociones
            <span className="opt-count">
              {emotions.length}/{maxEmotions}
            </span>
          </span>
          <div className="emoji-chips" role="group" aria-label="Emociones">
            {emotionOptions.map((item) => {
              const on = emotions.includes(item.name);
              return (
                <button
                  key={item.id}
                  type="button"
                  className={`emoji-chip${on ? ' on' : ''}`}
                  style={on && item.colorHex ? ({ '--c': item.colorHex } as CSSProperties) : undefined}
                  aria-pressed={on}
                  onClick={() => toggle(emotions, onEmotions, item.name, maxEmotions)}
                >
                  <span className="emoji-chip-ico" aria-hidden>
                    {emojiFor(item.name, EMOTION_EMOJI, '💗')}
                  </span>
                  {item.name}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      {/* Etiquetas (plegable) */}
      {tagOptions.length > 0 ? (
        <div className="opt-block">
          <button
            type="button"
            className="opt-collapse"
            aria-expanded={showTags}
            onClick={() => setShowTags((value) => !value)}
          >
            <span className="opt-collapse-label">Etiquetas</span>
            <span className="opt-count">
              {tags.length}/{maxTags}
            </span>
            <Icon name="chevron" className={`opt-chevron${showTags ? ' open' : ''}`} />
          </button>

          {!showTags && tags.length > 0 ? (
            <div className="mini-tags">
              {tags.map((tag) => (
                <span key={tag} className="mini-tag">
                  {tag}
                </span>
              ))}
            </div>
          ) : null}

          {showTags ? (
            <div className="chip-row" style={{ marginTop: 10 }} role="group" aria-label="Etiquetas">
              {tagOptions.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={`chip${tags.includes(item.name) ? ' on' : ''}`}
                  aria-pressed={tags.includes(item.name)}
                  onClick={() => toggle(tags, onTags, item.name, maxTags)}
                >
                  {item.name}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
