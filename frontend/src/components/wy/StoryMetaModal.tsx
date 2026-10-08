'use client';

import { useEffect, useState } from 'react';
import Icon from './Icon';
import { fetchTaxonomy, type TaxonomyCatalog } from '@/lib/taxonomy';
import { updateStory, type MyStory, type StoryVisibility } from '@/lib/stories';

const TITLE_MAX = 120;
const MAX_EMOTIONS = 5;
const MAX_TAGS = 10;

const VISIBILITY_OPTIONS: { value: StoryVisibility; label: string }[] = [
  { value: 'PUBLIC', label: 'Público' },
  { value: 'FOLLOWERS', label: 'Seguidores' },
  { value: 'PRIVATE', label: 'Privado' },
];

export interface EditableStory {
  id: string;
  title: string;
  visibility: StoryVisibility;
  categories: string[];
  emotions: { name: string; colorHex: string | null }[];
  tags: string[];
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

  const toggle = (list: string[], setList: (next: string[]) => void, value: string, max: number) => {
    if (list.includes(value)) {
      setList(list.filter((item) => item !== value));
      return;
    }
    if (list.length >= max) return;
    setList([...list, value]);
  };

  const canSubmit = title.trim().length >= 3 && !saving;

  async function submit() {
    if (!canSubmit) return;
    setSaving(true);
    setError('');

    const result = await updateStory(story.id, {
      title: title.trim(),
      visibility,
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

      <label className="field-label">Visibilidad</label>
      <div className="segmented">
        {VISIBILITY_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            className={visibility === option.value ? 'active' : undefined}
            aria-pressed={visibility === option.value}
            onClick={() => setVisibility(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>

      {catalog && catalog.categories.length > 0 ? (
        <>
          <label className="field-label">Categoría (una)</label>
          <div className="chip-row">
            {catalog.categories.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`chip ${category === item.name ? 'on' : ''}`}
                aria-pressed={category === item.name}
                onClick={() => setCategory(category === item.name ? null : item.name)}
              >
                {item.name}
              </button>
            ))}
          </div>
        </>
      ) : null}

      {catalog && catalog.emotions.length > 0 ? (
        <>
          <label className="field-label">Emociones (hasta {MAX_EMOTIONS})</label>
          <div className="chip-row">
            {catalog.emotions.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`chip ${emotions.includes(item.name) ? 'on' : ''}`}
                style={item.colorHex ? { borderColor: item.colorHex } : undefined}
                aria-pressed={emotions.includes(item.name)}
                onClick={() => toggle(emotions, setEmotions, item.name, MAX_EMOTIONS)}
              >
                {item.name}
              </button>
            ))}
          </div>
        </>
      ) : null}

      {catalog && catalog.tags.length > 0 ? (
        <>
          <label className="field-label">Etiquetas (hasta {MAX_TAGS})</label>
          <div className="chip-row">
            {catalog.tags.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`chip ${tags.includes(item.name) ? 'on' : ''}`}
                aria-pressed={tags.includes(item.name)}
                onClick={() => toggle(tags, setTags, item.name, MAX_TAGS)}
              >
                {item.name}
              </button>
            ))}
          </div>
        </>
      ) : null}

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
