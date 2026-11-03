'use client';

import { useEffect, useState } from 'react';
import Icon from './Icon';
import StoryTaxonomyFields from './StoryTaxonomyFields';
import { fetchTaxonomy, type TaxonomyCatalog } from '@/lib/taxonomy';
import { updateStory, type MyStory, type StoryVisibility } from '@/lib/stories';
import { COUNTRIES, LANGUAGES } from '@/lib/locales';
import { VISUAL_CARD_THEMES, type VisualCardTheme } from '@/lib/visualCards';

const TITLE_MAX = 120;
const MAX_EMOTIONS = 5;
const MAX_TAGS = 10;

export interface EditableStory {
  id: string;
  title: string;
  visibility: StoryVisibility;
  categories: string[];
  emotions: { name: string; colorHex: string | null }[];
  tags: string[];
  language: string;
  countryCode: string | null;
  visualCardTheme: VisualCardTheme | null;
}

interface Props {
  story: EditableStory;
  onClose: () => void;
  onSaved: (story: MyStory) => void;
}

export default function StoryMetaModal({ story, onClose, onSaved }: Props) {
  const [catalog, setCatalog] = useState<TaxonomyCatalog | null>(null);
  const [title, setTitle] = useState(story.title);
  const [visibility, setVisibility] = useState<StoryVisibility>(story.visibility);
  const [category, setCategory] = useState<string | null>(story.categories[0] ?? null);
  const [emotions, setEmotions] = useState<string[]>(story.emotions.map((emotion) => emotion.name));
  const [tags, setTags] = useState<string[]>(story.tags);
  const [language, setLanguage] = useState(story.language);
  const [countryCode, setCountryCode] = useState(story.countryCode ?? '');
  const [cardTheme, setCardTheme] = useState<VisualCardTheme | null>(
    story.visualCardTheme,
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    void fetchTaxonomy().then((result) => {
      if (active && result.status === 'ok') setCatalog(result.data);
    });
    return () => {
      active = false;
    };
  }, []);

  const canSubmit = title.trim().length >= 3 && !saving;

  async function submit() {
    if (!canSubmit) return;
    setSaving(true);
    setError('');

    const result = await updateStory(story.id, {
      title: title.trim(),
      language,
      countryCode: countryCode || null,
      visibility,
      visualCardTheme: cardTheme,
      categories: category ? [category] : [],
      emotions,
      tags,
    });

    setSaving(false);

    if (result.status === 'ok') {
      onSaved(result.data);
      return;
    }

    setError(result.message);
  }

  return (
    <div className="modal" role="dialog" aria-modal="true" aria-label="Editar relato">
      <div className="modal-head">
        <div>
          <h2>Editar relato</h2>
          <p>Cambia el título, la visibilidad y las etiquetas. El texto se edita por etapas.</p>
        </div>
        <button className="close" type="button" onClick={onClose} aria-label="Cerrar">
          <Icon name="x" />
        </button>
      </div>

      {error ? (
        <p className="auth-error" role="alert" style={{ marginTop: 14 }}>
          {error}
        </p>
      ) : null}

      <label className="field-label" style={{ marginTop: 14 }}>
        Título
        <input
          className="field"
          type="text"
          value={title}
          maxLength={TITLE_MAX}
          onChange={(event) => setTitle(event.target.value)}
        />
      </label>

      <div className="story-card-picker">
        <div className="story-card-picker-head">
          <div>
            <b>Formato de publicación</b>
            <span className="hint">Cambia entre relato de lectura y tarjeta visual.</span>
          </div>
          <div className="segmented">
            <button
              type="button"
              className={!cardTheme ? 'active' : undefined}
              aria-pressed={!cardTheme}
              onClick={() => setCardTheme(null)}
            >
              Relato
            </button>
            <button
              type="button"
              className={cardTheme ? 'active' : undefined}
              aria-pressed={Boolean(cardTheme)}
              onClick={() => setCardTheme((value) => value ?? 'lavender')}
            >
              Tarjeta visual
            </button>
          </div>
        </div>
        {cardTheme ? (
          <div className="story-card-themes" role="group" aria-label="Tema de la tarjeta visual">
            {VISUAL_CARD_THEMES.map((theme) => (
              <button
                key={theme.id}
                type="button"
                className={`story-card-theme theme-${theme.id}${
                  cardTheme === theme.id ? ' active' : ''
                }`}
                aria-pressed={cardTheme === theme.id}
                title={theme.description}
                onClick={() => setCardTheme(theme.id)}
              >
                <span aria-hidden />
                {theme.label}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <div className="story-locale-fields">
        <label className="field-label" htmlFor="metaStoryLanguage">
          Idioma del relato
          <select id="metaStoryLanguage" value={language} onChange={(event) => setLanguage(event.target.value)}>
            {LANGUAGES.map((item) => (
              <option key={item.code} value={item.code}>{item.label}</option>
            ))}
          </select>
        </label>
        <label className="field-label" htmlFor="metaStoryCountry">
          País <span>(opcional)</span>
          <select id="metaStoryCountry" value={countryCode} onChange={(event) => setCountryCode(event.target.value)}>
            <option value="">Sin país</option>
            {COUNTRIES.map((item) => (
              <option key={item.code} value={item.code}>{item.label}</option>
            ))}
          </select>
        </label>
      </div>

      <StoryTaxonomyFields
        catalog={catalog}
        visibility={visibility}
        category={category}
        emotions={emotions}
        tags={tags}
        onCategory={setCategory}
        onVisibility={setVisibility}
        onEmotions={setEmotions}
        onTags={setTags}
        maxEmotions={MAX_EMOTIONS}
        maxTags={MAX_TAGS}
      />

      <div className="modal-actions">
        <button className="ghost" type="button" onClick={onClose} disabled={saving}>
          Cancelar
        </button>
        <button
          className="primary"
          type="button"
          style={{ padding: '11px 17px' }}
          onClick={() => void submit()}
          disabled={!canSubmit}
        >
          {saving ? 'Guardando…' : 'Guardar cambios'}
        </button>
      </div>
    </div>
  );
}
