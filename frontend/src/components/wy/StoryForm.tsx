'use client';

import { useEffect, useRef, useState } from 'react';
import Icon from './Icon';
import { fetchTaxonomy, type TaxonomyCatalog } from '@/lib/taxonomy';
import { uploadAudio, uploadFile } from '@/lib/files';
import { createStory, type MyStory, type StoryVisibility } from '@/lib/stories';

const TITLE_MAX = 120;
const CONTENT_MAX = 5000;
const MAX_EMOTIONS = 5;
const MAX_TAGS = 10;

const VISIBILITY_OPTIONS: { value: StoryVisibility; label: string }[] = [
  { value: 'PUBLIC', label: 'Público' },
  { value: 'FOLLOWERS', label: 'Seguidores' },
  { value: 'PRIVATE', label: 'Privado' },
];

interface Props {
  onCreated: (story: MyStory, published: boolean) => void;
  onCancel: () => void;
  /** Texto de cabecera; si falta, no se muestra. */
  heading?: string;
  headingHint?: string;
}

/**
 * Formulario de publicación de un relato. Se usa tanto dentro del bloque del
 * feed (en línea) como dentro del modal de «Mis relatos».
 */
export default function StoryForm({ onCreated, onCancel, heading, headingHint }: Props) {
  const [catalog, setCatalog] = useState<TaxonomyCatalog | null>(null);
  const [catalogError, setCatalogError] = useState('');

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [category, setCategory] = useState<string | null>(null);
  const [emotions, setEmotions] = useState<string[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [visibility, setVisibility] = useState<StoryVisibility>('PUBLIC');
  const [mediaId, setMediaId] = useState<string | null>(null);
  const [mediaName, setMediaName] = useState('');
  const [audioId, setAudioId] = useState<string | null>(null);
  const [audioName, setAudioName] = useState('');
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [showOptions, setShowOptions] = useState(false);

  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState<'draft' | 'publish' | null>(null);
  const [done, setDone] = useState(false);
  const [action, setAction] = useState<'draft' | 'publish'>('publish');
  const [error, setError] = useState('');

  const fileInput = useRef<HTMLInputElement>(null);
  const audioInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let active = true;
    void fetchTaxonomy().then((result) => {
      if (!active) return;
      if (result.status === 'ok') setCatalog(result.data);
      else setCatalogError(result.message);
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

  async function pickImage(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    setUploading(true);
    setError('');
    const result = await uploadFile(file);
    setUploading(false);

    if (result.status === 'ok') {
      setMediaId(result.data.id);
      setMediaName(result.data.originalName ?? 'Imagen adjunta');
      return;
    }
    setError(result.message);
  }

  async function pickAudio(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    setUploading(true);
    setError('');
    const result = await uploadAudio(file);
    setUploading(false);

    if (result.status === 'ok') {
      setAudioId(result.data.id);
      setAudioName(result.data.originalName ?? 'Audio adjunto');
      setAudioUrl(result.data.fileUrl);
      return;
    }
    setError(result.message);
  }

  const titleReady = title.trim().length >= 3;
  const contentReady = content.trim().length > 0;
  const canSubmit = titleReady && contentReady && !saving && !uploading && !done;

  async function submit(publish: boolean) {
    if (!canSubmit) return;
    setSaving(publish ? 'publish' : 'draft');
    setAction(publish ? 'publish' : 'draft');
    setError('');

    const result = await createStory({
      title: title.trim(),
      content: content.trim(),
      visibility,
      publish,
      categories: category ? [category] : [],
      emotions,
      tags,
      mediaAssetId: mediaId ?? undefined,
      audioAssetId: audioId ?? undefined,
    });

    setSaving(null);

    if (result.status === 'ok') {
      // Se deja ver la confirmación animada antes de cerrar y refrescar el feed.
      setDone(true);
      window.setTimeout(() => onCreated(result.data, publish), 1000);
      return;
    }

    setError(result.message);
    setDone(false);
  }

  return (
    <div className="story-form">
      {saving !== null || done ? (
        <div className="composer-overlay" role="status" aria-live="polite">
          <div className="composer-progress">
            {done ? (
              <div className="pop-check">
                <Icon name="check" />
              </div>
            ) : (
              <div className="spinner" />
            )}
            <b>
              {done
                ? action === 'publish'
                  ? '¡Publicado!'
                  : '¡Borrador guardado!'
                : 'Guardando tu relato…'}
            </b>
            <span className="hint" style={{ margin: 0 }}>
              {done ? 'Ya está en «Mis relatos».' : 'Un momento, por favor.'}
            </span>
          </div>
        </div>
      ) : null}

      {heading ? (
        <div style={{ marginTop: 4 }}>
          <b>{heading}</b>
          {headingHint ? <p className="hint" style={{ margin: '2px 0 0' }}>{headingHint}</p> : null}
        </div>
      ) : null}

      {error ? (
        <p className="auth-error" role="alert" style={{ marginTop: 10 }}>
          {error}
        </p>
      ) : null}

      <label className="field-label" style={{ marginTop: 10 }}>
        Título
        <input
          className="field"
          type="text"
          value={title}
          maxLength={TITLE_MAX}
          placeholder="Una frase que resuma lo que quieres contar"
          onChange={(event) => setTitle(event.target.value)}
        />
      </label>

      <label className="field-label">
        Tu relato
        <textarea
          className="field"
          value={content}
          maxLength={CONTENT_MAX}
          style={{ minHeight: 130 }}
          placeholder="No tienes que explicarlo todo. Escribe a tu ritmo."
          onChange={(event) => setContent(event.target.value)}
        />
      </label>
      <p className="hint" style={{ textAlign: 'right', margin: 0 }}>
        {content.trim().length}/{CONTENT_MAX}
      </p>

      <div className="row-between" style={{ marginTop: 8 }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button
            type="button"
            className="secondary"
            onClick={() => fileInput.current?.click()}
            disabled={uploading}
          >
            <Icon name="sparkle" /> {mediaName ? 'Imagen ✓' : 'Imagen'}
          </button>
          <button
            type="button"
            className="secondary"
            onClick={() => audioInput.current?.click()}
            disabled={uploading}
          >
            <Icon name="music" /> {audioName ? 'Audio ✓' : 'Audio'}
          </button>
          <button type="button" className="secondary" onClick={() => setShowOptions((value) => !value)}>
            <Icon name="settings" /> {showOptions ? 'Menos opciones' : 'Categoría y más'}
          </button>
        </div>
        <span className="hint" style={{ margin: 0 }}>
          {visibility === 'PUBLIC' ? 'Público' : visibility === 'FOLLOWERS' ? 'Seguidores' : 'Privado'}
        </span>
      </div>

      <input
        ref={fileInput}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={(event) => void pickImage(event)}
        className="hidden"
        aria-label="Elegir imagen"
      />
      <input
        ref={audioInput}
        type="file"
        accept="audio/mpeg,audio/mp4,audio/aac,audio/ogg,audio/webm,audio/wav"
        onChange={(event) => void pickAudio(event)}
        className="hidden"
        aria-label="Elegir audio"
      />

      {audioUrl ? (
        // eslint-disable-next-line jsx-a11y/media-has-caption
        <audio controls src={audioUrl} style={{ width: '100%', marginTop: 8 }} />
      ) : null}

      {showOptions ? (
        <div className="story-options">
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

          {catalogError ? <p className="hint" style={{ marginTop: 10 }}>{catalogError}</p> : null}

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
        </div>
      ) : null}

      <div className="modal-actions">
        <button className="ghost" type="button" onClick={onCancel} disabled={saving !== null || done}>
          Cancelar
        </button>
        <button
          className="secondary"
          type="button"
          onClick={() => void submit(false)}
          disabled={!canSubmit}
        >
          {saving === 'draft' ? 'Guardando…' : 'Guardar borrador'}
        </button>
        <button
          className="primary"
          type="button"
          style={{ padding: '11px 17px' }}
          onClick={() => void submit(true)}
          disabled={!canSubmit}
        >
          {saving === 'publish' ? 'Publicando…' : 'Publicar'}
        </button>
      </div>
    </div>
  );
}
