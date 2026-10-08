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
  onClose: () => void;
  onCreated: (story: MyStory, published: boolean) => void;
}

export default function StoryComposer({ onClose, onCreated }: Props) {
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

  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState<'draft' | 'publish' | null>(null);
  const [error, setError] = useState('');

  const fileInput = useRef<HTMLInputElement>(null);
  const audioInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let active = true;
    void fetchTaxonomy().then((result) => {
      if (!active) return;
      if (result.status === 'ok') {
        setCatalog(result.data);
      } else {
        setCatalogError(result.message);
      }
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
  const canSubmit = titleReady && contentReady && !saving && !uploading;

  async function submit(publish: boolean) {
    if (!canSubmit) return;
    setSaving(publish ? 'publish' : 'draft');
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
      onCreated(result.data, publish);
      return;
    }

    setError(result.message);
  }

  return (
    <div className="modal" role="dialog" aria-modal="true" aria-label="Compartir relato">
      <div className="modal-head">
        <div>
          <h2>Compartir un relato</h2>
          <p>Escribes bajo tu seudónimo. Puedes guardarlo como borrador y publicarlo cuando quieras.</p>
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
          style={{ minHeight: 150 }}
          placeholder="No tienes que explicarlo todo. Escribe a tu ritmo."
          onChange={(event) => setContent(event.target.value)}
        />
      </label>
      <p className="hint" style={{ textAlign: 'right' }}>
        {content.trim().length}/{CONTENT_MAX}
      </p>

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

      <label className="field-label">Imagen (opcional)</label>
      <div className="row-between">
        <span className="hint" style={{ margin: 0 }}>
          {mediaName || 'Ilustra tu relato con una imagen de tu biblioteca.'}
        </span>
        <button
          type="button"
          className="secondary"
          onClick={() => fileInput.current?.click()}
          disabled={uploading}
        >
          <Icon name="sparkle" /> {uploading ? 'Subiendo…' : mediaName ? 'Cambiar' : 'Elegir imagen'}
        </button>
        <input
          ref={fileInput}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={(event) => void pickImage(event)}
          className="hidden"
          aria-label="Elegir imagen"
        />
      </div>

      <label className="field-label">Audio (opcional)</label>
      <div className="row-between">
        <span className="hint" style={{ margin: 0 }}>
          {audioName || 'Añade un audio de voz o ambiente.'}
        </span>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            type="button"
            className="secondary"
            onClick={() => audioInput.current?.click()}
            disabled={uploading}
          >
            <Icon name="music" /> {uploading ? 'Subiendo…' : audioName ? 'Cambiar' : 'Elegir audio'}
          </button>
          {audioId ? (
            <button
              type="button"
              className="ghost"
              onClick={() => {
                setAudioId(null);
                setAudioName('');
                setAudioUrl(null);
              }}
            >
              Quitar
            </button>
          ) : null}
        </div>
        <input
          ref={audioInput}
          type="file"
          accept="audio/mpeg,audio/mp4,audio/aac,audio/ogg,audio/webm,audio/wav"
          onChange={(event) => void pickAudio(event)}
          className="hidden"
          aria-label="Elegir audio"
        />
      </div>
      {audioUrl ? (
        // eslint-disable-next-line jsx-a11y/media-has-caption
        <audio controls src={audioUrl} style={{ width: '100%', marginTop: 8 }} />
      ) : null}

      <div className="modal-actions">
        <button className="ghost" type="button" onClick={onClose} disabled={saving !== null}>
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
