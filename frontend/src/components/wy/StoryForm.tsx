'use client';

import { useEffect, useRef, useState } from 'react';
import Icon from './Icon';
import AudioRecorder from './AudioRecorder';
import VisualStoryCard from './VisualStoryCard';
import StoryTaxonomyFields from './StoryTaxonomyFields';
import { fetchTaxonomy, type TaxonomyCatalog } from '@/lib/taxonomy';
import { uploadAudio, uploadFile } from '@/lib/files';
import { fetchAccount } from '@/lib/account';
import {
  addStoryStage,
  createStory,
  getMyStory,
  listMyStories,
  type MyStory,
  type MyStoryListItem,
  type StoryVisibility,
} from '@/lib/stories';
import { COUNTRIES, LANGUAGES } from '@/lib/locales';
import { VISUAL_CARD_THEMES, type VisualCardTheme } from '@/lib/visualCards';

const TITLE_MAX = 120;
const CONTENT_MAX = 5000;
const MAX_EMOTIONS = 5;
const MAX_TAGS = 10;

type StoryFormat = 'text' | 'card' | 'audio';

export interface StoryDraftSeed {
  title?: string;
  content?: string;
  categories?: string[];
  emotions?: string[];
  tags?: string[];
  language?: string;
  countryCode?: string | null;
  visualCardTheme?: VisualCardTheme | null;
}

interface Props {
  onCreated: (story: MyStory, published: boolean) => void;
  onCancel: () => void;
  initialDraft?: StoryDraftSeed;
  /** `minimal` se usa en el feed: título y cuerpo sin bordes, herramientas discretas. */
  variant?: 'default' | 'minimal';
  heading?: string;
  headingHint?: string;
}

/**
 * Formulario de publicación de un relato. `minimal` se incrusta en el bloque del
 * feed (sin modal ni campos con borde); el estilo por defecto se usa en el modal.
 */
export default function StoryForm({
  onCreated,
  onCancel,
  initialDraft,
  variant = 'default',
  heading,
  headingHint,
}: Props) {
  const minimal = variant === 'minimal';

  const [catalog, setCatalog] = useState<TaxonomyCatalog | null>(null);
  const [catalogError, setCatalogError] = useState('');

  const [title, setTitle] = useState(initialDraft?.title ?? '');
  const [content, setContent] = useState(initialDraft?.content ?? '');
  const [category, setCategory] = useState<string | null>(initialDraft?.categories?.[0] ?? null);
  const [emotions, setEmotions] = useState<string[]>(initialDraft?.emotions ?? []);
  const [tags, setTags] = useState<string[]>(initialDraft?.tags ?? []);
  const [language, setLanguage] = useState(initialDraft?.language ?? 'es');
  const [countryCode, setCountryCode] = useState(initialDraft?.countryCode ?? '');
  const [visibility, setVisibility] = useState<StoryVisibility>('PUBLIC');
  const [mediaId, setMediaId] = useState<string | null>(null);
  const [mediaName, setMediaName] = useState('');
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [audioId, setAudioId] = useState<string | null>(null);
  const [audioName, setAudioName] = useState('');
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [transcript, setTranscript] = useState('');
  const [format, setFormat] = useState<StoryFormat>(
    initialDraft?.visualCardTheme ? 'card' : 'text',
  );
  const [cardTheme, setCardTheme] = useState<VisualCardTheme>(
    initialDraft?.visualCardTheme ?? 'lavender',
  );
  const [previewOpen, setPreviewOpen] = useState(false);
  // Los detalles opcionales se pliegan para que el flujo principal quede limpio.
  const [showOptions, setShowOptions] = useState(false);
  const [publicationKind, setPublicationKind] = useState<'new' | 'continuation'>('new');
  const [continuationId, setContinuationId] = useState('');
  const [continuationKind, setContinuationKind] = useState('Nueva reflexión');
  const [ownStories, setOwnStories] = useState<MyStoryListItem[]>([]);
  const [ownStoriesLoading, setOwnStoriesLoading] = useState(false);
  const [contentWarning, setContentWarning] = useState('');
  const [musicLabel, setMusicLabel] = useState('');
  const [externalShare, setExternalShare] = useState(true);
  const [guestReadable, setGuestReadable] = useState(true);
  const [draftStatus, setDraftStatus] = useState('');

  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState<'draft' | 'publish' | null>(null);
  const [done, setDone] = useState(false);
  const [action, setAction] = useState<'draft' | 'publish'>('publish');
  const [error, setError] = useState('');

  const fileInput = useRef<HTMLInputElement>(null);
  const audioInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let active = true;
    void fetchAccount().then((result) => {
      if (!active || result.status !== 'ok') return;
      if (initialDraft?.language === undefined) setLanguage(result.data.preferences.language || 'es');
      if (initialDraft?.countryCode === undefined) setCountryCode(result.data.preferences.countryCode ?? '');
    });
    return () => {
      active = false;
    };
  }, [initialDraft?.language, initialDraft?.countryCode]);

  useEffect(() => {
    if (initialDraft) return;
    const raw = window.sessionStorage.getItem('withyouly-compose-draft');
    if (!raw) return;
    try {
      const draft = JSON.parse(raw) as Record<string, unknown>;
      if (typeof draft.title === 'string') setTitle(draft.title);
      if (typeof draft.content === 'string') setContent(draft.content);
      if (typeof draft.transcript === 'string') setTranscript(draft.transcript);
      if (typeof draft.category === 'string') setCategory(draft.category);
      if (Array.isArray(draft.emotions)) setEmotions(draft.emotions.filter((item): item is string => typeof item === 'string'));
      if (Array.isArray(draft.tags)) setTags(draft.tags.filter((item): item is string => typeof item === 'string'));
      if (typeof draft.contentWarning === 'string') setContentWarning(draft.contentWarning);
      if (typeof draft.musicLabel === 'string') setMusicLabel(draft.musicLabel);
      if (draft.externalShare === false) setExternalShare(false);
      if (draft.guestReadable === false) setGuestReadable(false);
      setDraftStatus('Borrador recuperado de este dispositivo.');
    } catch {
      /* borrador local inválido */
    }
  }, [initialDraft]);

  useEffect(() => {
    if (initialDraft) return;
    const timer = window.setTimeout(() => {
      const draft = {
        title,
        content,
        transcript,
        category,
        emotions,
        tags,
        contentWarning,
        musicLabel,
        externalShare,
        guestReadable,
      };
      if (!title.trim() && !content.trim() && !transcript.trim() && !musicLabel.trim()) return;
      window.sessionStorage.setItem('withyouly-compose-draft', JSON.stringify(draft));
      setDraftStatus('Borrador guardado automáticamente.');
    }, 600);
    return () => window.clearTimeout(timer);
  }, [
    title,
    content,
    transcript,
    category,
    emotions,
    tags,
    contentWarning,
    musicLabel,
    externalShare,
    guestReadable,
    initialDraft,
  ]);

  useEffect(() => {
    if (publicationKind !== 'continuation' || ownStories.length > 0) return;
    setOwnStoriesLoading(true);
    void listMyStories({ status: 'PUBLISHED' }).then((result) => {
      if (result.status === 'ok') {
        setOwnStories(result.data.items);
        if (!continuationId && result.data.items[0]) setContinuationId(result.data.items[0].id);
      }
      setOwnStoriesLoading(false);
    });
  }, [publicationKind, ownStories.length, continuationId]);

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
      setMediaUrl(result.data.fileUrl);
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
      setTranscript('');
      return;
    }
    setError(result.message);
  }

  const continuation = publicationKind === 'continuation';
  const titleReady = continuation || title.trim().length >= 3;
  const contentReady =
    format === 'audio'
      ? Boolean(audioId)
      : content.trim().length > 0 || Boolean(mediaId);
  const canSubmit =
    titleReady &&
    contentReady &&
    (!continuation || Boolean(continuationId)) &&
    !saving &&
    !uploading &&
    !done;

  async function submit(publish: boolean) {
    if (!canSubmit) return;
    setSaving(publish ? 'publish' : 'draft');
    setAction(publish ? 'publish' : 'draft');
    setError('');

    const audioStory = format === 'audio';

    if (continuation) {
      const stage = await addStoryStage(continuationId, {
        content: audioStory ? transcript.trim() : content.trim(),
        mediaAssetId: audioStory ? undefined : mediaId ?? undefined,
        audioAssetId: audioStory ? audioId ?? undefined : undefined,
        transcript: audioStory ? transcript.trim() || undefined : undefined,
        updateKind: continuationKind,
      });

      if (stage.status !== 'ok') {
        setSaving(null);
        setError(stage.message);
        return;
      }

      const parent = await getMyStory(continuationId);
      setSaving(null);

      if (parent.status !== 'ok') {
        setError(parent.message);
        return;
      }

      window.sessionStorage.removeItem('withyouly-compose-draft');
      setDone(true);
      window.setTimeout(() => onCreated(parent.data, true), 1000);
      return;
    }

    const result = await createStory({
      title: title.trim(),
      content: audioStory ? transcript.trim() : content.trim(),
      language,
      countryCode: countryCode || null,
      visibility,
      publish,
      visualCardTheme: format === 'card' ? cardTheme : null,
      contentWarning: contentWarning || null,
      musicLabel: musicLabel.trim() || null,
      externalShare,
      guestReadable,
      categories: category ? [category] : [],
      emotions,
      tags,
      mediaAssetId: audioStory ? undefined : mediaId ?? undefined,
      audioAssetId: audioStory ? audioId ?? undefined : undefined,
      audioTranscript: audioStory ? transcript.trim() || undefined : undefined,
    });

    setSaving(null);

    if (result.status === 'ok') {
      window.sessionStorage.removeItem('withyouly-compose-draft');
      setDone(true);
      window.setTimeout(() => onCreated(result.data, publish), 1000);
      return;
    }

    setError(result.message);
    setDone(false);
  }

  const options = (
    <>
      {catalogError ? <p className="hint" style={{ marginTop: 10 }}>{catalogError}</p> : null}

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
      <div className="story-locale-fields">
        <label className="field-label" htmlFor="storyLanguage">
          Idioma del relato
          <select id="storyLanguage" value={language} onChange={(event) => setLanguage(event.target.value)}>
            {LANGUAGES.map((item) => (
              <option key={item.code} value={item.code}>{item.label}</option>
            ))}
          </select>
        </label>
        <label className="field-label" htmlFor="storyCountry">
          País <span>(opcional)</span>
          <select id="storyCountry" value={countryCode} onChange={(event) => setCountryCode(event.target.value)}>
            <option value="">Sin país</option>
            {COUNTRIES.map((item) => (
              <option key={item.code} value={item.code}>{item.label}</option>
            ))}
          </select>
        </label>
      </div>

      <div className="compose-advanced-settings">
        <label className="field-label" htmlFor="storyWarning">
          Aviso de contenido <span>(opcional)</span>
          <select id="storyWarning" value={contentWarning} onChange={(event) => setContentWarning(event.target.value)}>
            <option value="">Sin aviso</option>
            <option value="Duelo">Duelo</option>
            <option value="Violencia">Violencia</option>
            <option value="Autolesión">Autolesión</option>
            <option value="Tema difícil">Tema difícil</option>
          </select>
        </label>
        <label className="field-label" htmlFor="storyMusic">
          Canción vinculada <span>(opcional)</span>
          <input
            id="storyMusic"
            className="field"
            type="text"
            value={musicLabel}
            maxLength={120}
            placeholder="Canción — Artista"
            onChange={(event) => setMusicLabel(event.target.value)}
          />
        </label>
        <label className="compose-toggle">
          <span>
            <b>Permitir compartir fuera de Withyouly</b>
            <small>Habilita enlace, imagen y tarjeta visual.</small>
          </span>
          <input
            type="checkbox"
            checked={externalShare}
            onChange={(event) => {
              setExternalShare(event.target.checked);
              if (!event.target.checked) setGuestReadable(false);
            }}
          />
        </label>
        <label className="compose-toggle">
          <span>
            <b>Permitir lectura sin iniciar sesión</b>
            <small>Solo aplica a relatos públicos.</small>
          </span>
          <input
            type="checkbox"
            checked={guestReadable}
            disabled={!externalShare}
            onChange={(event) => setGuestReadable(event.target.checked)}
          />
        </label>
      </div>
    </>
  );

  return (
    <div className={`story-form ${minimal ? 'minimal' : ''}`}>
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
      {draftStatus ? <p className="hint compose-draft-status">{draftStatus}</p> : null}

      <div className="compose-kind-selector">
        <span>Tipo de publicación</span>
        <div className="segmented" role="tablist" aria-label="Tipo de publicación">
          <button
            type="button"
            role="tab"
            className={!continuation ? 'active' : undefined}
            aria-selected={!continuation}
            onClick={() => setPublicationKind('new')}
          >
            Relato nuevo
          </button>
          <button
            type="button"
            role="tab"
            className={continuation ? 'active' : undefined}
            aria-selected={continuation}
            onClick={() => {
              setPublicationKind('continuation');
              if (format === 'card') setFormat('text');
            }}
          >
            Continuación
          </button>
        </div>
      </div>

      {continuation ? (
        <label className="field-label">
          Relato que continúa
          <select
            className="field"
            value={continuationId}
            onChange={(event) => setContinuationId(event.target.value)}
            disabled={ownStoriesLoading}
          >
            {ownStories.length === 0 ? (
              <option value="">{ownStoriesLoading ? 'Cargando tus relatos…' : 'No tienes relatos publicados'}</option>
            ) : (
              ownStories.map((story) => (
                <option key={story.id} value={story.id}>
                  {story.title}
                </option>
              ))
            )}
          </select>
        </label>
      ) : null}

      {continuation ? (
        <label className="field-label">
          ¿Qué ocurrió?
          <select
            className="field"
            value={continuationKind}
            onChange={(event) => setContinuationKind(event.target.value)}
          >
            <option>Hubo una conversación</option>
            <option>Tomé una decisión o algo cambió</option>
            <option>Nueva reflexión</option>
            <option>Cierre que deseo compartir</option>
            <option>Sin clasificación</option>
          </select>
        </label>
      ) : null}

      <div className="compose-tabs" role="tablist" aria-label="Formato del relato">
        <button
          type="button"
          role="tab"
          aria-selected={format === 'text'}
          className={format === 'text' ? 'active' : undefined}
          onClick={() => setFormat('text')}
        >
          <Icon name="edit" />
          <span>
            <b>Texto</b>
            <small>Relato clásico</small>
          </span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={format === 'card'}
          className={format === 'card' ? 'active' : undefined}
          onClick={() => setFormat('card')}
          disabled={continuation}
          title={continuation ? 'Las continuaciones se publican como texto o audio' : undefined}
        >
          <Icon name="sparkle" />
          <span>
            <b>Tarjeta visual</b>
            <small>Diseño en el feed</small>
          </span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={format === 'audio'}
          className={format === 'audio' ? 'active' : undefined}
          onClick={() => setFormat('audio')}
        >
          <Icon name="music" />
          <span>
            <b>Audio</b>
            <small>Voz + transcripción</small>
          </span>
        </button>
      </div>

      {format !== 'audio' ? (minimal ? (
        <>
          {!continuation ? (
            <input
              className="composer-title"
              type="text"
              value={title}
              maxLength={TITLE_MAX}
              placeholder="Título"
              onChange={(event) => setTitle(event.target.value)}
            />
          ) : null}
          <textarea
            className="composer-body"
            value={content}
            maxLength={CONTENT_MAX}
            placeholder="¿Qué quieres contar hoy?"
            onChange={(event) => setContent(event.target.value)}
          />
        </>
      ) : (
        <>
          {!continuation ? (
            <label className="field-label" style={{ marginTop: 10 }}>
              Título
              <input
                className="field story-field"
                type="text"
                value={title}
                maxLength={TITLE_MAX}
                placeholder="Una frase que resuma lo que quieres contar"
                onChange={(event) => setTitle(event.target.value)}
              />
            </label>
          ) : null}

          <label className="field-label">
            Tu relato
            <textarea
              className="field story-field"
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
        </>
      )) : (
        <label className="field-label" style={{ marginTop: 10 }}>
          Título
          <input
            className="field story-field"
            type="text"
            value={title}
            maxLength={TITLE_MAX}
            placeholder="Ponle un título a lo que quieres contar"
            onChange={(event) => setTitle(event.target.value)}
          />
        </label>
      )}

      {format === 'card' ? (
        <div className="story-card-picker">
          <div className="story-card-picker-head">
            <div>
              <b>Diseño de tu tarjeta</b>
              <span className="hint">
                El título y el relato se colocan automáticamente. Elige el estilo que más te represente.
              </span>
            </div>
          </div>
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
          <VisualStoryCard
            theme={cardTheme}
            title={title.trim() || 'Tu título aparece aquí'}
            text={content.trim() || 'El texto de tu relato se mostrará sobre este fondo.'}
            category={category}
            author="Tú"
            compact
            preview
          />
        </div>
      ) : null}

      {format === 'audio' ? (
        <>
          <div className="audio-privacy-note">
            <Icon name="shield" />
            <div>
              <b>Tu voz puede permitir que otras personas te reconozcan</b>
              <p>
                No menciones nombres, direcciones, centros de estudio, trabajos ni otros datos
                identificables.
              </p>
            </div>
          </div>
          <AudioRecorder
            audioUrl={audioUrl}
            transcript={transcript}
            language={language}
            disabled={uploading || saving !== null || done}
            onRecorded={(recorded) => {
              setAudioId(recorded.id);
              setAudioName(recorded.name);
              setAudioUrl(recorded.url);
              setTranscript(recorded.transcript);
            }}
            onClear={() => {
              setAudioId(null);
              setAudioName('');
              setAudioUrl(null);
              setTranscript('');
            }}
            onTranscriptChange={setTranscript}
          />
          <div className="audio-upload-row">
            <button
              className="secondary"
              type="button"
              onClick={() => audioInput.current?.click()}
              disabled={uploading || saving !== null || done}
            >
              <Icon name="music" /> {audioName ? 'Cambiar archivo de audio' : 'Subir archivo de audio'}
            </button>
            <span className="hint">También puedes grabar directamente o subir un audio existente.</span>
          </div>
        </>
      ) : null}

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

      {minimal ? (
        <div className="composer-toolbar">
          <div className="toolbar-tools">
            <button
              type="button"
              className={`tool ${mediaName ? 'on' : ''}`}
              onClick={() => fileInput.current?.click()}
              disabled={uploading}
              title={mediaName ? 'Cambiar imagen' : 'Añadir imagen'}
              aria-label="Añadir imagen"
            >
              <Icon name="sparkle" />
            </button>
            <button
              type="button"
              className={`tool ${audioName ? 'on' : ''}`}
              onClick={() => audioInput.current?.click()}
              disabled={uploading}
              title={audioName ? 'Cambiar audio' : 'Añadir audio'}
              aria-label="Añadir audio"
            >
              <Icon name="music" />
            </button>
            <button
              type="button"
              className={`tool ${showOptions ? 'on' : ''}`}
              onClick={() => setShowOptions((value) => !value)}
              title={showOptions ? 'Ocultar opciones' : 'Categoría, emoción y visibilidad'}
              aria-label={showOptions ? 'Ocultar opciones' : 'Mostrar opciones'}
            >
              <Icon name="settings" />
            </button>
          </div>

          <div className="toolbar-actions">
            <button className="ghost sm" type="button" onClick={() => void submit(false)} disabled={!canSubmit}>
              {saving === 'draft' ? '…' : 'Borrador'}
            </button>
            <button className="primary sm" type="button" onClick={() => void submit(true)} disabled={!canSubmit}>
              {saving === 'publish' ? '…' : 'Publicar'}
            </button>
            <button className="tool" type="button" onClick={onCancel} title="Cancelar" aria-label="Cancelar">
              <Icon name="x" />
            </button>
          </div>
        </div>
      ) : (
        <div className="row-between compose-tools-row" style={{ marginTop: 12 }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {format !== 'audio' ? (
              <button
                type="button"
                className="secondary"
                onClick={() => fileInput.current?.click()}
                disabled={uploading}
              >
                <Icon name="sparkle" /> {mediaName ? 'Cambiar imagen' : 'Imagen'}
              </button>
            ) : null}
            <button
              type="button"
              className="secondary"
              onClick={() => setPreviewOpen(true)}
              disabled={!titleReady}
            >
              <Icon name="eye" /> Vista previa
            </button>
            <button type="button" className="secondary" onClick={() => setShowOptions((value) => !value)}>
              <Icon name="settings" /> {showOptions ? 'Menos opciones' : 'Categoría y más'}
            </button>
          </div>
          <span className="hint" style={{ margin: 0 }}>
            {visibility === 'PUBLIC' ? 'Público' : visibility === 'FOLLOWERS' ? 'Seguidores' : 'Privado'}
          </span>
        </div>
      )}

      {showOptions ? <div className="story-options">{options}</div> : null}

      {!minimal ? (
        <div className="modal-actions">
          <button className="ghost" type="button" onClick={onCancel} disabled={saving !== null || done}>
            Cancelar
          </button>
          <button className="secondary" type="button" onClick={() => setPreviewOpen(true)} disabled={!titleReady}>
            <Icon name="eye" /> Vista previa
          </button>
          <button className="secondary" type="button" onClick={() => void submit(false)} disabled={!canSubmit}>
            {saving === 'draft' ? 'Guardando…' : 'Guardar borrador'}
          </button>
          <button
            className="primary"
            type="button"
            style={{ padding: '11px 17px' }}
            onClick={() => void submit(true)}
            disabled={!canSubmit}
          >
            {saving === 'publish'
              ? 'Publicando…'
              : format === 'card'
                ? 'Publicar tarjeta'
                : format === 'audio'
                  ? 'Publicar audio'
                  : 'Publicar relato'}
          </button>
        </div>
      ) : null}

      {previewOpen ? (
        <div
          className="compose-preview-layer"
          role="dialog"
          aria-modal="true"
          aria-label="Vista previa del relato"
          onClick={() => setPreviewOpen(false)}
        >
          <div className="modal compose-preview-modal" onClick={(event) => event.stopPropagation()}>
            <div className="modal-head">
              <div>
                <span className="micro-label">VISTA PREVIA</span>
                <h2>Así se verá tu publicación</h2>
                <p>Revisa el resultado antes de guardarlo o publicarlo.</p>
              </div>
              <button className="close" type="button" onClick={() => setPreviewOpen(false)} aria-label="Cerrar">
                <Icon name="x" />
              </button>
            </div>

            {format === 'card' ? (
              <VisualStoryCard
                theme={cardTheme}
                title={title.trim() || 'Tu título aparecerá aquí'}
                text={content.trim() || 'El texto de tu relato aparecerá aquí.'}
                mediaUrl={mediaUrl}
                category={category}
                author="Tú"
              />
            ) : (
              <article className="compose-preview-story">
                <h2>{title.trim() || 'Tu título aparecerá aquí'}</h2>
                {format === 'audio' ? (
                  <>
                    <p>{transcript.trim() || 'Tu audio aparecerá aquí.'}</p>
                    {audioUrl ? (
                      // eslint-disable-next-line jsx-a11y/media-has-caption
                      <audio controls src={audioUrl} className="post-audio" />
                    ) : (
                      <p className="hint">Todavía no has añadido un audio.</p>
                    )}
                  </>
                ) : (
                  <>
                    <p>{content.trim() || 'Tu relato aparecerá aquí.'}</p>
                    {mediaUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={mediaUrl} alt="" className="post-media" />
                    ) : null}
                  </>
                )}
              </article>
            )}

            <div className="modal-actions">
              <button className="primary" type="button" onClick={() => setPreviewOpen(false)}>
                Volver a editar
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
