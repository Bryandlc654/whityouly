'use client';

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import Icon from './Icon';
import Guide58Modal from './Guide58Modal';
import Avatar from './Avatar';
import { Sheet, type SheetRow } from './Overlays';
import { V58_EMOTIONS, V58_TOPIC_NAMES } from '@/lib/v58Taxonomy';
import { uploadAudio } from '@/lib/files';
import {
  addStoryStage,
  createStory,
  getMyStory,
  listMyStories,
  type MyStory,
  type MyStoryListItem,
} from '@/lib/stories';
import { LANGUAGES } from '@/lib/locales';

/**
 * Pantalla «Comparte tu relato» con el mismo marcado final que la entrega v58
 * (create() + capas v38/v53), conectada al backend real. Las hojas de estilo de
 * v58 ya están en withyouly-v58-parity.css, así que basta con reproducir el DOM.
 */

const TITLE_MAX = 100;
const CONTENT_MAX = 5000;
const DRAFT_KEY = 'withyouly-compose-draft';
const MAX_RECORD_SECONDS = 120;

type Mode = 'classic' | 'card' | 'audio';
type Accompaniment = '' | 'share' | 'experiences' | 'suggestions';
type CardStyle = 'violet' | 'hope' | 'calm' | 'dawn' | 'night' | 'minimal';

// SHARE_CARD_TEMPLATES de v58.
const CARD_STYLES: Record<CardStyle, { label: string; from: string; to: string; ink: string; soft: string }> = {
  violet: { label: 'Violeta', from: '#6246F5', to: '#7942CC', ink: '#ffffff', soft: 'rgba(255,255,255,.17)' },
  hope: { label: 'Esperanza', from: '#23704F', to: '#2D7D56', ink: '#ffffff', soft: 'rgba(255,255,255,.18)' },
  calm: { label: 'Calma', from: '#146B78', to: '#187A7B', ink: '#ffffff', soft: 'rgba(255,255,255,.18)' },
  dawn: { label: 'Amanecer', from: '#fff0de', to: '#efb2c4', ink: '#38283f', soft: 'rgba(255,255,255,.4)' },
  night: { label: 'Noche', from: '#171f46', to: '#4d3d87', ink: '#ffffff', soft: 'rgba(255,255,255,.13)' },
  minimal: { label: 'Minimal', from: '#ffffff', to: '#f3f0ff', ink: '#292432', soft: 'rgba(108,67,243,.1)' },
};
const CARD_STYLE_ORDER: CardStyle[] = ['violet', 'hope', 'calm', 'dawn', 'night', 'minimal'];


const ACCOMPANIMENT_CHOICES: { value: Accompaniment; title: string; hint?: string }[] = [
  { value: 'share', title: 'Solo quiero compartirlo', hint: 'Que me lean y me acompañen, sin buscar consejos.' },
  { value: 'experiences', title: 'Quiero conocer experiencias similares', hint: 'Leer cómo lo han vivido otras personas.' },
  { value: 'suggestions', title: 'Me vienen bien sugerencias', hint: 'Recibir ideas y consejos con respeto.' },
  { value: '', title: 'Sin preferencia' },
];

const SENSITIVE_CHOICES = [
  'Duelo o pérdida',
  'Violencia o abuso',
  'Autolesión o crisis',
  'Contenido sexual sensible',
  'Otro tema difícil',
];

const UPDATE_TYPES = [
  'Hubo una conversación',
  'Tomé una decisión o algo cambió',
  'Nueva reflexión',
  'Quiero cerrar este capítulo',
  'Sin clasificación',
];

// El backend guarda el cierre con su etiqueta histórica.
const UPDATE_KIND_VALUE: Record<string, string> = {
  'Quiero cerrar este capítulo': 'Cierre que deseo compartir',
};

const WAVE = Array.from({ length: 28 }, (_, i) => 8 + ((i * 7) % 24));

function clock(seconds: number) {
  return `${Math.floor(seconds / 60)}:${(seconds % 60).toString().padStart(2, '0')}`;
}

function initialsOf(name: string) {
  return name.trim().slice(0, 2).toUpperCase() || 'TÚ';
}

function supportedMimeType(): string | null {
  if (typeof MediaRecorder === 'undefined') return null;
  return ['audio/webm', 'audio/mp4', 'audio/ogg'].find((type) => MediaRecorder.isTypeSupported(type)) ?? null;
}

interface Props {
  characterName: string;
  avatarUrl?: string | null;
  onCreated: (story: MyStory, published: boolean) => void;
}

export default function CreateStoryV58({ characterName, avatarUrl, onCreated }: Props) {
  const alias = characterName || 'tu seudónimo';

  const [mode, setMode] = useState<Mode>('classic');

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [accompaniment, setAccompaniment] = useState<Accompaniment>('');
  const [category, setCategory] = useState('');
  const [emotion, setEmotion] = useState('');
  const [kind, setKind] = useState<'new' | 'continuation'>('new');
  const [ownStories, setOwnStories] = useState<MyStoryListItem[]>([]);
  const [originId, setOriginId] = useState('');
  const [updateType, setUpdateType] = useState(UPDATE_TYPES[0]);
  const [music, setMusic] = useState('');
  const [sensitive, setSensitive] = useState('');
  const [externalShare, setExternalShare] = useState(true);
  const [guestRead, setGuestRead] = useState(true);
  const [language, setLanguage] = useState('');
  const [cardStyle, setCardStyle] = useState<CardStyle>('violet');

  const [showTranscript, setShowTranscript] = useState(true);
  const [transcript, setTranscript] = useState('');
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [audioId, setAudioId] = useState<string | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioDuration, setAudioDuration] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState('');
  const [modal, setModal] = useState<null | 'sensitive' | 'preview' | 'music' | 'guide'>(null);
  const [sheet, setSheet] = useState<{ title: string; rows: SheetRow[] } | null>(null);
  const [musicQuery, setMusicQuery] = useState('');
  const [detailsOpen, setDetailsOpen] = useState(false);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const playerRef = useRef<HTMLAudioElement | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const restored = useRef(false);

  const audio = mode === 'audio';
  const continuation = kind === 'continuation';

  function notify(message: string) {
    setToast(message);
    window.setTimeout(() => setToast((current) => (current === message ? '' : current)), 2400);
  }

  // Borrador local: v58 lo guarda mientras se escribe.
  useEffect(() => {
    const raw = window.sessionStorage.getItem(DRAFT_KEY);
    restored.current = true;
    if (!raw) return;
    try {
      const d = JSON.parse(raw) as Record<string, unknown>;
      if (typeof d.title === 'string') setTitle(d.title);
      if (typeof d.content === 'string') setContent(d.content);
      if (typeof d.transcript === 'string') setTranscript(d.transcript);
      if (typeof d.music === 'string') setMusic(d.music);
      if (typeof d.sensitive === 'string') setSensitive(d.sensitive);
    } catch {
      /* borrador inválido */
    }
  }, []);

  useEffect(() => {
    if (!restored.current) return;
    const timer = window.setTimeout(() => {
      if (!title.trim() && !content.trim() && !transcript.trim()) return;
      window.sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ title, content, transcript, music, sensitive }));
    }, 500);
    return () => window.clearTimeout(timer);
  }, [title, content, transcript, music, sensitive]);

  // «Continuar relato» (Mis relatos) llega con ?continuar=<id>: igual que v58,
  // se abre una continuación de ese relato con «Nueva reflexión» y su tema.
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get('continuar');
    if (!id) return;
    setMode('classic');
    setKind('continuation');
    setOriginId(id);
    setUpdateType('Nueva reflexión');
    setDetailsOpen(true);
    void getMyStory(id).then((result) => {
      if (result.status !== 'ok') {
        setError('No encontramos el relato que quieres continuar.');
        return;
      }
      const story = result.data;
      // legacyTopic() de v58: las categorías antiguas equivalentes pasan a su tema.
      const legacy: Record<string, string> = { Relaciones: 'Pareja', Aprendizaje: 'Relación conmigo' };
      const topic = story.categories
        .map((name) => legacy[name] ?? name)
        .find((name) => V58_TOPIC_NAMES.includes(name));
      if (topic) setCategory(topic);
      // El relato aparece en el selector aunque no esté en la primera página de la lista.
      setOwnStories((current) =>
        current.some((item) => item.id === story.id)
          ? current
          : [{ id: story.id, title: story.title } as MyStoryListItem, ...current],
      );
    });
  }, []);

  useEffect(() => {
    if (!continuation) return;
    void listMyStories({ status: 'PUBLISHED' }).then((result) => {
      if (result.status !== 'ok') return;
      setOwnStories((current) => {
        const extra = current.filter((item) => !result.data.items.some((story) => story.id === item.id));
        return [...extra, ...result.data.items];
      });
      if (result.data.items[0]) setOriginId((current) => current || result.data.items[0].id);
    });
  }, [continuation]);

  useEffect(
    () => () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
      recorderRef.current?.stream.getTracks().forEach((track) => track.stop());
    },
    [],
  );

  /* ---------- Audio ---------- */

  async function saveAudio(file: File, seconds: number) {
    setUploading(true);
    const result = await uploadAudio(file);
    setUploading(false);
    if (result.status !== 'ok') {
      setError(result.message);
      return;
    }
    setAudioId(result.data.id);
    setAudioUrl(result.data.fileUrl);
    setAudioDuration(seconds);
    setError('');
  }

  function stopRecording() {
    if (timerRef.current) window.clearInterval(timerRef.current);
    timerRef.current = null;
    if (recorderRef.current?.state === 'recording') recorderRef.current.stop();
    setRecording(false);
  }

  async function toggleRecording() {
    if (recording) {
      stopRecording();
      notify('Grabación detenida');
      return;
    }
    const mime = supportedMimeType();
    if (!mime || !navigator.mediaDevices?.getUserMedia) {
      notify('Tu navegador no permite grabar. Puedes subir un archivo de audio.');
      return;
    }
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      notify('No pudimos acceder al micrófono. Revisa los permisos del navegador.');
      return;
    }
    const recorder = new MediaRecorder(stream, { mimeType: mime });
    chunksRef.current = [];
    let seconds = 0;
    recorder.ondataavailable = (event) => {
      if (event.data.size) chunksRef.current.push(event.data);
    };
    recorder.onstop = () => {
      stream.getTracks().forEach((track) => track.stop());
      const blob = new Blob(chunksRef.current, { type: mime });
      const ext = mime.includes('mp4') ? 'm4a' : mime.includes('ogg') ? 'ogg' : 'webm';
      void saveAudio(new File([blob], `relato-${Date.now()}.${ext}`, { type: mime }), seconds);
    };
    recorderRef.current = recorder;
    recorder.start();
    setElapsed(0);
    setRecording(true);
    timerRef.current = window.setInterval(() => {
      seconds += 1;
      setElapsed(seconds);
      if (seconds >= MAX_RECORD_SECONDS) stopRecording();
    }, 1000);
  }

  function clearAudio(message: string) {
    stopRecording();
    playerRef.current?.pause();
    setPlaying(false);
    setAudioId(null);
    setAudioUrl(null);
    setAudioDuration(0);
    setElapsed(0);
    notify(message);
  }

  function toggleListen() {
    const player = playerRef.current;
    if (!audioUrl || !player) {
      notify('Graba un audio antes de escucharlo');
      return;
    }
    if (playing) {
      player.pause();
      setPlaying(false);
    } else {
      void player.play();
      setPlaying(true);
    }
  }

  async function pickAudioFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    const seconds = await new Promise<number>((resolve) => {
      const probe = document.createElement('audio');
      probe.preload = 'metadata';
      probe.onloadedmetadata = () => resolve(Number.isFinite(probe.duration) ? Math.round(probe.duration) : 0);
      probe.onerror = () => resolve(0);
      probe.src = URL.createObjectURL(file);
    });
    await saveAudio(file, seconds);
  }

  const recordTitle = recording ? 'Grabando…' : uploading ? 'Guardando el audio…' : audioId ? 'Audio listo para revisar' : 'Toca para comenzar';
  const recordTime = recording
    ? `${clock(elapsed)} de 2:00`
    : audioId
      ? `${clock(audioDuration)} · Puedes volver a grabarlo`
      : 'Duración máxima: 2:00 minutos';

  /* ---------- Publicación ---------- */

  async function submit(publish: boolean) {
    if (saving || uploading) return;
    const finalTitle = title.trim();
    const body = audio ? transcript.trim() : content.trim();
    if (!continuation && finalTitle.length < 3) {
      setError('Escribe un título de al menos 3 caracteres.');
      return;
    }
    if (audio && !audioId) {
      setError('Graba o sube un audio antes de publicar.');
      return;
    }
    if (!audio && !body) {
      setError('Escribe tu relato antes de publicar.');
      return;
    }
    if (continuation && !originId) {
      setError('Elige el relato que quieres continuar.');
      return;
    }
    setError('');
    setSaving(true);
    setStatus(publish ? 'Publicando tu relato…' : 'Guardando tu borrador…');

    if (continuation) {
      const stage = await addStoryStage(originId, {
        title: finalTitle || undefined,
        content: body,
        audioAssetId: audio ? audioId ?? undefined : undefined,
        transcript: audio && showTranscript ? transcript.trim() || undefined : undefined,
        updateKind: UPDATE_KIND_VALUE[updateType] ?? updateType,
      });
      if (stage.status !== 'ok') {
        setSaving(false);
        setStatus('');
        setError(stage.message);
        return;
      }
      const parent = await getMyStory(originId);
      setSaving(false);
      if (parent.status !== 'ok') {
        setStatus('');
        setError(parent.message);
        return;
      }
      window.sessionStorage.removeItem(DRAFT_KEY);
      setStatus('Continuación publicada.');
      onCreated(parent.data, true);
      return;
    }

    const result = await createStory({
      title: finalTitle,
      content: body,
      language: language || undefined,
      publish,
      visualCardTheme: mode === 'card' ? cardStyle : null,
      ...(accompaniment ? { accompaniment } : {}),
      contentWarning: sensitive || null,
      musicLabel: music || null,
      externalShare,
      guestReadable: externalShare && guestRead,
      categories: category ? [category] : [],
      emotions: emotion ? [emotion] : [],
      audioAssetId: audio ? audioId ?? undefined : undefined,
      audioTranscript: audio && showTranscript ? transcript.trim() || undefined : undefined,
    });
    setSaving(false);
    if (result.status !== 'ok') {
      setStatus('');
      setError(result.message);
      return;
    }
    window.sessionStorage.removeItem(DRAFT_KEY);
    setStatus(publish ? 'Relato publicado.' : 'Borrador guardado.');
    onCreated(result.data, publish);
  }

  /* ---------- Piezas compartidas ---------- */

  const tabs = (
    <div className="compose-tabs compose-tabs-three card" role="tablist" aria-label="Formato del relato">
      {(
        [
          ['classic', 'edit', 'Texto'],
          ['card', 'sparkle', 'Tarjeta visual'],
          ['audio', 'mic', 'Audio'],
        ] as const
      ).map(([value, icon, label]) => (
        <button
          key={value}
          type="button"
          className={mode === value ? 'active' : ''}
          role="tab"
          aria-selected={mode === value}
          onClick={() => {
            setMode(value);
            setError('');
          }}
        >
          <Icon name={icon} />
          <span>
            <b>{label}</b>
          </span>
        </button>
      ))}
    </div>
  );

  const badge = (
    <>
      <div className="privacy-badge">
        <Icon name="lock" /> Publicarás como {alias}
      </div>
      {sensitive ? (
        <div className="sensitive-banner">
          <Icon name="shield" />
          <div>
            <b>Aviso añadido: {sensitive}</b>
            <small>Las personas verán una advertencia antes de abrir el relato.</small>
          </div>
          <button type="button" className="text-link" onClick={() => setModal('sensitive')}>
            Cambiar
          </button>
        </div>
      ) : null}
    </>
  );

  const prefix = audio ? 'audio' : 'story';
  const accompanimentField = (
    <fieldset className="accompaniment-options" aria-describedby={`${prefix}AccompanimentHelp ${prefix}AccompanimentContext`}>
      <legend>
        ¿Qué te gustaría recibir al compartir? <span className="field-optional">(opcional)</span>
      </legend>
      <p id={`${prefix}AccompanimentHelp`}>Dile a la comunidad qué te vendría bien. Puedes publicar sin elegir.</p>
      <div className="accompaniment-choices">
        {ACCOMPANIMENT_CHOICES.map((choice) => (
          <label className="accompaniment-choice" key={choice.title}>
            <input
              type="radio"
              name={`${prefix}AccompanimentChoice`}
              value={choice.value}
              checked={accompaniment === choice.value}
              onChange={() => setAccompaniment(choice.value)}
            />
            <span>
              <b>{choice.title}</b>
              {choice.hint ? <small>{choice.hint}</small> : null}
            </span>
          </label>
        ))}
      </div>
      <p className="accompaniment-context" id={`${prefix}AccompanimentContext`}>
        Tu elección se mostrará junto a los comentarios para orientar las respuestas.
      </p>
    </fieldset>
  );

  const metadataFields = (
    <div className="metadata-fields">
      <div>
        <label htmlFor={`${prefix}Category`}>
          Tema <span className="field-optional">(opcional)</span>
        </label>
        <select id={`${prefix}Category`} value={category} onChange={(event) => setCategory(event.target.value)}>
          <option value="">Sin elegir tema</option>
          {V58_TOPIC_NAMES.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor={`${prefix}Emotion`}>
          Emoción o estado <span className="field-optional">(opcional)</span>
        </label>
        <select id={`${prefix}Emotion`} value={emotion} onChange={(event) => setEmotion(event.target.value)}>
          <option value="">Sin elegir emoción</option>
          {V58_EMOTIONS.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
      </div>
    </div>
  );

  const originOptions =
    ownStories.length === 0 ? (
      <option value="">No tienes relatos publicados</option>
    ) : (
      ownStories.map((story) => (
        <option key={story.id} value={story.id}>
          {story.title}
        </option>
      ))
    );

  const draftAction = (
    <div className="compose-draft-action">
      <span>Puedes continuar más tarde.</span>
      <button type="button" className="ghost" onClick={() => void submit(false)} disabled={continuation}>
        Guardar borrador
      </button>
    </div>
  );

  const languageField = (
    <div className="story-language-field">
      <label htmlFor="storyLanguage">Idioma del relato</label>
      <select id="storyLanguage" value={language} onChange={(event) => setLanguage(event.target.value)}>
        <option value="">Detectar al publicar</option>
        {LANGUAGES.map((item) => (
          <option key={item.code} value={item.code}>
            {item.label}
          </option>
        ))}
      </select>
      <small>Puedes indicar el idioma si la sugerencia no es correcta.</small>
    </div>
  );

  // updateMetadataSummary() de v58: «Tema · Emoción · Continuación».
  const detailsSummary =
    [category, emotion, continuation ? 'Continuación' : ''].filter(Boolean).join(' · ') ||
    'Tema, emoción, continuación y más';

  const summary = (
    <summary>
      <span>
        <b>
          Detalles del relato <small>(opcional)</small>
        </b>
        <span data-compose-details-summary="">{detailsSummary}</span>
      </span>
      <Icon name="chevron" />
    </summary>
  );

  const feedback = (
    <>
      <p id="composeError" className="compose-error" role="alert" hidden={!error}>
        {error}
      </p>
      <p id="composeStatus" role="status" hidden={!status}>
        {status}
      </p>
    </>
  );

  const style = CARD_STYLES[cardStyle];
  const cardSource = content.trim() || 'El inicio de tu relato aparecerá aquí.';
  const cardExcerpt = cardSource.length > 260 ? `${cardSource.slice(0, 257).trim()}…` : cardSource;
  const cardTitle = title.trim() || 'Tu título aparecerá aquí';

  /* ---------- Render ---------- */

  return (
    <section className="screen">
      <div className="screen-heading">
        <div>
          <h1>Comparte tu relato</h1>
          <p>
            {audio
              ? 'Una alegría, una experiencia o algo de tu día, con tu voz.'
              : 'Tus alegrías, tus días difíciles y lo cotidiano tienen un lugar aquí.'}
          </p>
        </div>
        {audio ? (
          <button className="guide-btn" type="button" onClick={() => setModal('guide')}>
            <Icon name="help" />
            <span>Guía</span>
          </button>
        ) : null}
      </div>

      {tabs}

      {!audio ? (
        <form
          className="editor card compose-editor"
          id="storyForm"
          onSubmit={(event) => {
            event.preventDefault();
            void submit(true);
          }}
        >
          {badge}
          <label htmlFor="storyTitle">Título</label>
          <input
            id="storyTitle"
            maxLength={TITLE_MAX}
            placeholder="Ponle un título a lo que quieres contar"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
          />
          <label htmlFor="storyBody">Tu relato</label>
          <textarea
            id="storyBody"
            maxLength={CONTENT_MAX}
            placeholder="Cuenta algo que quieras compartir: una alegría, una experiencia o un momento de tu día…"
            value={content}
            onChange={(event) => setContent(event.target.value)}
          />
          <div className="char-count">
            <span id="charCount">{content.length}</span>/5000 caracteres
          </div>
          <p className="draft-status" role="status">
            Tu borrador se guarda mientras escribes.
          </p>

          {mode === 'card' ? (
            <section className="compose-card-appearance" aria-label="Diseño y vista previa de tu tarjeta">
              <div className="feed-compose-preview">
                <span>Vista previa de tu tarjeta</span>
                <div data-compose-card-preview="">
                  <div
                    className="feed-visual-card compose-card-preview"
                    style={
                      {
                        '--feed-card-from': style.from,
                        '--feed-card-to': style.to,
                        '--feed-card-ink': style.ink,
                        '--feed-card-soft': style.soft,
                      } as CSSProperties
                    }
                    role="group"
                    aria-label={`Vista previa de relato ${cardTitle}`}
                  >
                    <div className="feed-card-top">
                      <div className="feed-card-brand">
                        <span>♡</span>
                        <b>Withyouly</b>
                      </div>
                      {category ? <span className="feed-card-category">{category}</span> : null}
                    </div>
                    <div className="feed-card-copy">
                      <h3>{cardTitle}</h3>
                      <p>{cardExcerpt}</p>
                    </div>
                    <div className="feed-card-author">
                      <span>{initialsOf(characterName)}</span>
                      <b>{alias}</b>
                      <em>Vista previa</em>
                    </div>
                  </div>
                </div>
              </div>
              <details className="compose-card-styles">
                <summary>Cambiar estilo de la tarjeta</summary>
                <div className="feed-style-picker">
                  {CARD_STYLE_ORDER.map((id) => (
                    <button
                      key={id}
                      type="button"
                      className={cardStyle === id ? 'selected' : ''}
                      aria-pressed={cardStyle === id}
                      onClick={() => setCardStyle(id)}
                    >
                      <i style={{ '--swatch-a': CARD_STYLES[id].from, '--swatch-b': CARD_STYLES[id].to } as CSSProperties} />
                      <span>{CARD_STYLES[id].label}</span>
                    </button>
                  ))}
                </div>
              </details>
              <p className="compose-excerpt-note">
                Si tu relato es largo, la tarjeta muestra un extracto. El texto completo seguirá disponible en tu publicación.
              </p>
            </section>
          ) : null}

          {accompanimentField}

          <details
            className="compose-details"
            open={detailsOpen}
            onToggle={(event) => setDetailsOpen(event.currentTarget.open)}
          >
            {summary}
            <div className="compose-details-body">
              {metadataFields}
              <div className="editor-grid">
                <div>
                  <label htmlFor="storyKind">Tipo de publicación</label>
                  <select
                    id="storyKind"
                    value={kind}
                    onChange={(event) => setKind(event.target.value === 'continuation' ? 'continuation' : 'new')}
                  >
                    <option value="new">Relato nuevo</option>
                    <option value="continuation">Continuación de un relato</option>
                  </select>
                </div>
                <div className={`update-fields${continuation ? ' show' : ''}`} id="updateFields">
                  <div>
                    <label htmlFor="originStory">Relato que continúa</label>
                    <select id="originStory" value={originId} onChange={(event) => setOriginId(event.target.value)}>
                      {originOptions}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="updateType">Qué ocurrió</label>
                    <select id="updateType" value={updateType} onChange={(event) => setUpdateType(event.target.value)}>
                      {UPDATE_TYPES.map((item) => (
                        <option key={item}>{item}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
              <label>Música opcional</label>
              <button
                type="button"
                className="secondary"
                onClick={() =>
                  setSheet({
                    title: 'Vincular una canción',
                    rows: [
                      { label: 'Buscar en Spotify', icon: 'music', onClick: () => setModal('music') },
                      { label: 'Pegar enlace de canción', icon: 'share', onClick: () => setModal('music') },
                    ],
                  })
                }
              >
                <Icon name="music" /> Vincular una canción
              </button>
              <div className="publish-safety-row">
                <button className="secondary" type="button" onClick={() => setModal('sensitive')}>
                  <Icon name="shield" /> Añadir aviso de contenido
                </button>
                <small>Úsalo si mencionas violencia, duelo, autolesión u otro tema difícil.</small>
              </div>
              <details className="publish-options">
                <summary>Opciones de privacidad al compartir</summary>
                <label className="control-toggle">
                  <span>Permitir compartir fuera de Withyouly</span>
                  <input
                    id="allowExternalShare"
                    type="checkbox"
                    checked={externalShare}
                    onChange={(event) => setExternalShare(event.target.checked)}
                  />
                </label>
                <label className="control-toggle">
                  <span>Permitir lectura sin iniciar sesión</span>
                  <input
                    id="allowGuestRead"
                    type="checkbox"
                    checked={guestRead}
                    onChange={(event) => setGuestRead(event.target.checked)}
                  />
                </label>
              </details>
              {draftAction}
            </div>
            {languageField}
          </details>

          <div className="tip compose-privacy-hint">
            <Icon name="shield" />
            <span>Antes de publicar, revisa que no hayas incluido datos que te identifiquen.</span>
          </div>
          {feedback}
          <div className="editor-actions compose-publish-bar">
            <button type="button" className="secondary" onClick={() => setModal('preview')}>
              Vista previa
            </button>
            <button type="submit" className="primary" disabled={saving}>
              {mode === 'card' ? 'Publicar tarjeta' : 'Publicar relato'}
            </button>
          </div>
        </form>
      ) : (
        <section className="audio-editor card compose-editor">
          {badge}
          <div className="audio-recording">
            <button
              type="button"
              className={`record-button${recording ? ' recording' : ''}`}
              aria-label={recording ? 'Detener grabación' : 'Iniciar grabación'}
              onClick={() => void toggleRecording()}
              disabled={uploading}
            >
              <Icon name="mic" />
            </button>
            <h2 id="recordTitle">{recordTitle}</h2>
            <p id="recordTime">{recordTime}</p>
            <div className="record-wave">
              {WAVE.map((height, index) => (
                <i key={index} style={{ height }} />
              ))}
            </div>
            <div className="audio-review-controls">
              <button type="button" className="secondary" onClick={toggleListen}>
                <Icon name={playing ? 'pause' : 'play'} /> {playing ? 'Pausar' : 'Escuchar'}
              </button>
              <button
                type="button"
                className="secondary"
                onClick={() => clearAudio('Audio anterior descartado. Puedes grabar de nuevo')}
              >
                <Icon name="mic" /> Volver a grabar
              </button>
              <button type="button" className="ghost danger-button" onClick={() => clearAudio('Grabación eliminada')}>
                <Icon name="trash" /> Eliminar
              </button>
            </div>
            <p className="audio-record-note">Puedes grabar con tu micrófono o subir un archivo de audio.</p>
            <button type="button" className="text-link" onClick={() => fileRef.current?.click()} disabled={uploading}>
              Subir un archivo de audio
            </button>
            <input
              ref={fileRef}
              type="file"
              hidden
              accept="audio/mpeg,audio/mp4,audio/aac,audio/ogg,audio/webm,audio/wav"
              onChange={(event) => void pickAudioFile(event)}
            />
            {audioUrl ? (
              // eslint-disable-next-line jsx-a11y/media-has-caption
              <audio ref={playerRef} src={audioUrl} hidden onEnded={() => setPlaying(false)} />
            ) : null}
          </div>
          <div className="audio-warning">
            <Icon name="shield" />
            <div>
              <b>Tu voz puede permitir que otras personas te reconozcan</b>
              <p>No menciones nombres, direcciones, centros de estudio, trabajos ni otros datos identificables.</p>
            </div>
          </div>
          <label htmlFor="audioTitle">Título del relato</label>
          <input
            id="audioTitle"
            maxLength={TITLE_MAX}
            placeholder="Ponle un título a lo que quieres contar"
            aria-label="Título del relato"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
          />
          <p className="draft-status" role="status">
            Tu borrador se guarda mientras escribes.
          </p>
          {accompanimentField}
          <details
            className="compose-details"
            open={detailsOpen}
            onToggle={(event) => setDetailsOpen(event.currentTarget.open)}
          >
            {summary}
            <div className="compose-details-body">
              {metadataFields}
              <label htmlFor="audioKind">Tipo de publicación</label>
              <select
                id="audioKind"
                value={kind}
                onChange={(event) => setKind(event.target.value === 'continuation' ? 'continuation' : 'new')}
              >
                <option value="new">Relato nuevo</option>
                <option value="continuation">Continuación de un relato</option>
              </select>
              <div className="audio-origin-field" hidden={!continuation}>
                <label htmlFor="audioOrigin">Relato que continúa</label>
                <select id="audioOrigin" value={originId} onChange={(event) => setOriginId(event.target.value)}>
                  {originOptions}
                </select>
              </div>
              <label className="transcript-choice">
                <span>
                  <b>Mostrar transcripción</b>
                  <small>Opcional. Puedes escribirla o corregirla antes de publicar.</small>
                </span>
                <input
                  type="checkbox"
                  id="showAudioTranscript"
                  checked={showTranscript}
                  onChange={(event) => setShowTranscript(event.target.checked)}
                />
              </label>
              <textarea
                id="audioTranscript"
                maxLength={CONTENT_MAX}
                placeholder="Transcripción opcional del relato…"
                value={transcript}
                hidden={!showTranscript}
                onChange={(event) => setTranscript(event.target.value)}
              />
              <div className="publish-safety-row">
                <button className="secondary" type="button" onClick={() => setModal('sensitive')}>
                  <Icon name="shield" /> Añadir aviso de contenido
                </button>
                <small>Opcional para temas difíciles.</small>
              </div>
              {draftAction}
            </div>
            {languageField}
          </details>
          {feedback}
          <div className="editor-actions compose-publish-bar">
            <button type="button" className="secondary" onClick={() => setModal('preview')}>
              Vista previa
            </button>
            <button type="button" className="primary" onClick={() => void submit(true)} disabled={saving}>
              Publicar audio
            </button>
          </div>
        </section>
      )}

      {modal ? (
        <div className="modal-layer">
          {modal === 'guide' ? <Guide58Modal type="audio" onClose={() => setModal(null)} /> : null}

          {modal === 'sensitive' ? (
            <div className="modal" role="dialog" aria-modal="true">
              <div className="modal-head">
                <div>
                  <h2>Aviso de contenido</h2>
                  <p>Ayuda a que cada persona decida si está preparada para leer o escuchar.</p>
                </div>
                <button className="close" type="button" onClick={() => setModal(null)} aria-label="Cerrar">
                  <Icon name="x" />
                </button>
              </div>
              <div className="sensitive-options">
                {SENSITIVE_CHOICES.map((choice) => (
                  <button
                    key={choice}
                    type="button"
                    onClick={() => {
                      setSensitive(choice);
                      setModal(null);
                      notify('Aviso de contenido añadido');
                    }}
                  >
                    <Icon name="shield" />
                    <span>{choice}</span>
                    <Icon name="chevron" />
                  </button>
                ))}
              </div>
              <button
                className="ghost"
                type="button"
                onClick={() => {
                  setSensitive('');
                  setModal(null);
                  notify('Publicación sin aviso adicional');
                }}
              >
                Continuar sin aviso
              </button>
            </div>
          ) : null}

          {modal === 'music' ? (
            <div className="modal" role="dialog" aria-modal="true">
              <div className="modal-head">
                <div>
                  <h2>Vincular una canción</h2>
                  <p>La música acompaña el texto; nunca reemplaza el relato.</p>
                </div>
                <button className="close" type="button" onClick={() => setModal(null)} aria-label="Cerrar">
                  <Icon name="x" />
                </button>
              </div>
              <label className="search-input" style={{ margin: '16px 0' }}>
                <Icon name="search" />
                <input
                  value={musicQuery}
                  placeholder="Canción — Artista o enlace"
                  aria-label="Buscar canción"
                  maxLength={120}
                  onChange={(event) => setMusicQuery(event.target.value)}
                />
              </label>
              <div className="story-list">
                {musicQuery.trim() ? (
                  <button
                    type="button"
                    className="settings-row card"
                    onClick={() => {
                      setMusic(musicQuery.trim());
                      setModal(null);
                      notify('Canción vinculada al relato');
                    }}
                  >
                    <span>
                      <Icon name="music" />
                    </span>
                    <span>
                      <b>{musicQuery.trim()}</b>
                      <small>Vincular esta canción</small>
                    </span>
                    <span>
                      <Icon name="plus" />
                    </span>
                  </button>
                ) : null}
                {music ? (
                  <button
                    type="button"
                    className="settings-row card"
                    onClick={() => {
                      setMusic('');
                      setMusicQuery('');
                      setModal(null);
                      notify('Canción quitada del relato');
                    }}
                  >
                    <span>
                      <Icon name="music" />
                    </span>
                    <span>
                      <b>{music}</b>
                      <small>Canción vinculada · Quitar</small>
                    </span>
                    <span>
                      <Icon name="x" />
                    </span>
                  </button>
                ) : null}
              </div>
            </div>
          ) : null}

          {modal === 'preview' ? (
            <div className="modal preview-modal" role="dialog" aria-modal="true">
              <div className="modal-head">
                <div>
                  <span className="micro-label">VISTA PREVIA</span>
                  <h2>Así lo verá la comunidad</h2>
                </div>
                <button className="close" type="button" onClick={() => setModal(null)} aria-label="Cerrar">
                  <Icon name="x" />
                </button>
              </div>
              <article className="preview-post">
                <div className="comment-head">
                  <Avatar initials={initialsOf(characterName)} avatarUrl={avatarUrl} />
                  <div>
                    <b>{alias}</b>
                    <div className="post-time">Ahora · Seudónimo único</div>
                  </div>
                </div>
                <h3>{title.trim() || 'Tu relato sin título'}</h3>
                <p>
                  {audio
                    ? audioId
                      ? `Vista previa del audio · ${clock(audioDuration)} minutos`
                      : 'Todavía no has grabado tu audio.'
                    : content.trim() || 'Aquí aparecerá el texto de tu relato.'}
                </p>
                {audio && audioUrl ? (
                  // eslint-disable-next-line jsx-a11y/media-has-caption
                  <audio controls src={audioUrl} className="post-audio" />
                ) : null}
                {sensitive ? <span className="status-pill review">Aviso: {sensitive}</span> : null}
              </article>
              <div className="modal-actions">
                <button className="secondary" type="button" onClick={() => setModal(null)}>
                  Seguir editando
                </button>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {sheet ? (
        <div className="sheet-layer">
          <Sheet title={sheet.title} rows={sheet.rows} onClose={() => setSheet(null)} />
        </div>
      ) : null}

      <div className={`toast ${toast ? 'show' : ''}`} role="status">
        {toast}
      </div>
    </section>
  );
}
