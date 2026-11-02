'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { API_URL } from '@/lib/api';
import { authFetch, logout as endSession, tokenStorage } from '@/lib/auth';
import type { CharacterSummary } from '@/components/feed/types';
import Icon from '@/components/wy/Icon';
import RightRail from '@/components/wy/RightRail';
import WyFrame, { type WyRoute } from '@/components/wy/Shell';
import { Sheet, type SheetRow } from '@/components/wy/Overlays';
import { listMyStories, type MyStoryListItem } from '@/lib/stories';

type CreativeFormat = 'Poema' | 'Canción' | 'Relato literario';
type CreativeTone = 'Esperanzador' | 'Íntimo' | 'Sereno' | 'Nostálgico';

const FORMATS: { value: CreativeFormat; icon: 'book' | 'music' | 'edit'; hint: string }[] = [
  { value: 'Poema', icon: 'book', hint: 'Breve y emocional' },
  { value: 'Canción', icon: 'music', hint: 'Versos y coro' },
  { value: 'Relato literario', icon: 'edit', hint: 'Narración ampliada' },
];

const TONES: CreativeTone[] = ['Esperanzador', 'Íntimo', 'Sereno', 'Nostálgico'];

const TONE_OPENINGS: Record<CreativeTone, string> = {
  Esperanzador: 'Un paso a la vez.',
  Íntimo: 'Estas palabras son mías.',
  Sereno: 'Me doy un momento para mirar.',
  Nostálgico: 'Vuelvo a ese momento con mis palabras.',
};

const DRAFT_MAX = 5000;

function initialsOf(name?: string | null) {
  if (!name) return '?';
  return name.trim().slice(0, 2).toUpperCase();
}

function buildCreativeDraft(source: string, format: CreativeFormat, tone: CreativeTone): string {
  const opening = TONE_OPENINGS[tone];
  const lines = source
    .split(/(?<=[.!?])\s+/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (format === 'Canción') {
    return `Verso\n${lines.join('\n')}\n\nCoro\n${opening}`;
  }
  if (format === 'Poema') {
    return `${lines.join('\n\n')}\n\n${opening}`;
  }
  return `${opening}\n\n${source}`;
}

export default function TransformPage() {
  const router = useRouter();
  const [character, setCharacter] = useState<CharacterSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [sources, setSources] = useState<MyStoryListItem[]>([]);
  const [sourcesError, setSourcesError] = useState('');
  const [sourceId, setSourceId] = useState('');
  const [format, setFormat] = useState<CreativeFormat>('Poema');
  const [tone, setTone] = useState<CreativeTone>('Esperanzador');
  const [formError, setFormError] = useState('');

  const [draftOpen, setDraftOpen] = useState(false);
  const [draftText, setDraftText] = useState('');
  const [draftError, setDraftError] = useState('');
  const requestedSource = useRef<string | null>(null);

  const [sheet, setSheet] = useState<{ title: string; rows: SheetRow[] } | null>(null);
  const [toast, setToast] = useState('');
  const [summaryHidden, setSummaryHidden] = useState(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout>>();

  const notify = useCallback((message: string) => {
    setToast(message);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 2400);
  }, []);

  useEffect(() => () => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    requestedSource.current = params.get('source');
  }, []);

  const loadSources = useCallback(async () => {
    setSourcesError('');
    const [published, drafts] = await Promise.all([
      listMyStories({ status: 'PUBLISHED' }),
      listMyStories({ status: 'DRAFT' }),
    ]);

    if (published.status !== 'ok' && drafts.status !== 'ok') {
      setSources([]);
      setSourcesError(published.status === 'error' ? published.message : 'No se pudieron cargar tus relatos.');
      return;
    }

    const merged = [
      ...(published.status === 'ok' ? published.data.items : []),
      ...(drafts.status === 'ok' ? drafts.data.items : []),
    ];
    const unique = merged.filter((story, index) => merged.findIndex((item) => item.id === story.id) === index);
    const usable = unique.filter((story) => !story.withdrawnAt && Boolean(story.opening?.content?.trim()));
    setSources(usable);

    const requested = requestedSource.current;
    setSourceId((current) => {
      if (current && usable.some((story) => story.id === current)) return current;
      if (requested && usable.some((story) => story.id === requested)) return requested;
      return usable[0]?.id ?? '';
    });
  }, []);

  useEffect(() => {
    const verify = async () => {
      if (!tokenStorage.getAccess()) {
        router.replace('/login');
        return;
      }
      try {
        const res = await authFetch(`${API_URL}/characters/me`);
        if (res.status === 401) {
          tokenStorage.clear();
          router.replace('/login');
          return;
        }
        if (res.status === 404) {
          router.replace('/onboarding');
          return;
        }
        if (res.ok) setCharacter(await res.json());
      } catch (err) {
        console.error('Error verificando sesión', err);
      } finally {
        setLoading(false);
      }
    };
    void verify();
  }, [router]);

  useEffect(() => {
    if (!loading) void loadSources();
  }, [loading, loadSources]);

  const logout = useCallback(async () => {
    await endSession();
    router.push('/login');
  }, [router]);

  const openAccount = () => {
    setSheet({
      title: 'Tu cuenta',
      rows: [
        { label: 'Ir al Feed', icon: 'home', onClick: () => router.push('/feed') },
        { label: 'Mis relatos', icon: 'book', onClick: () => router.push('/mis-relatos') },
        { label: 'Mi perfil', icon: 'user', onClick: () => router.push('/cuenta') },
        { label: 'Mis reportes', icon: 'flag', onClick: () => router.push('/mis-reportes') },
        { label: 'Ayuda y soporte', icon: 'mail', onClick: () => router.push('/soporte') },
        {
          label: 'Privacidad y configuración',
          icon: 'settings',
          onClick: () => router.push('/cuenta/configuracion'),
        },
        { label: 'Cerrar sesión', icon: 'user', danger: true, onClick: () => void logout() },
      ],
    });
  };

  const navigate = (route: WyRoute) => {
    switch (route) {
      case 'home':
        router.push('/feed');
        break;
      case 'mood':
        router.push('/mi-estado');
        break;
      case 'pulso':
        router.push('/pulso');
        break;
      case 'tree':
        router.push('/mi-arbol');
        break;
      case 'my-stories':
        router.push('/mis-relatos');
        break;
      case 'following':
        router.push('/siguiendo');
        break;
      case 'explore':
        router.push('/explorar');
        break;
      case 'profile':
        router.push('/cuenta');
        break;
      case 'notifications':
        router.push('/notificaciones');
        break;
      case 'help':
        router.push('/soporte');
        break;
      default:
        notify('Esta sección llega con los próximos módulos.');
    }
  };

  const source = sources.find((item) => item.id === sourceId) ?? null;
  const sourceText = source?.opening?.content?.trim() ?? '';

  const openDraft = () => {
    setFormError('');
    if (!source) {
      setFormError('Elige un relato propio disponible.');
      return;
    }
    if (sourceText.length < 20) {
      setFormError('Ese relato todavía no tiene suficiente texto para transformarlo.');
      return;
    }
    setDraftError('');
    setDraftText(buildCreativeDraft(sourceText, format, tone));
    setDraftOpen(true);
  };

  const continueToComposer = () => {
    if (!source) {
      setDraftError('Elige un relato propio disponible.');
      return;
    }
    const text = draftText.trim();
    if (text.length < 20) {
      setDraftError('Escribe al menos 20 caracteres.');
      return;
    }

    try {
      sessionStorage.setItem(
        'creativeDraft',
        JSON.stringify({
          title: `${format}: ${source.title}`.slice(0, 120),
          content: text,
          categories: source.categories,
          emotions: source.emotions.map((emotion) => emotion.name),
          language: source.language,
          countryCode: source.countryCode,
        }),
      );
    } catch {
      setDraftError('No se pudo preparar el borrador. Tu texto sigue aquí.');
      return;
    }

    setDraftError('');
    setDraftOpen(false);
    router.push('/mis-relatos?compose=1');
  };

  const draftModal = draftOpen ? (
    <div className="modal transform-editor" role="dialog" aria-modal="true" aria-label="Borrador creativo">
      <div className="modal-head">
        <div>
          <span className="micro-label">BORRADOR CREATIVO</span>
          <h2>Borrador de {format.toLowerCase()}</h2>
        </div>
        <button className="close" type="button" onClick={() => setDraftOpen(false)} aria-label="Cerrar borrador creativo">
          <Icon name="x" />
        </button>
      </div>
      <p>
        {tone} · Revisa y edita tus palabras antes de guardarlo. El relato original no cambia.
      </p>
      <label className="field-label" htmlFor="creativeDraftText">
        Mi borrador
      </label>
      <textarea
        id="creativeDraftText"
        className="field"
        maxLength={DRAFT_MAX}
        value={draftText}
        onChange={(event) => setDraftText(event.target.value)}
      />
      <div className="transform-count">
        {draftText.length}/{DRAFT_MAX} caracteres
      </div>
      {draftError ? (
        <p className="auth-error" role="alert">
          {draftError}
        </p>
      ) : null}
      <div className="modal-actions">
        <button className="ghost" type="button" onClick={() => setDraftOpen(false)}>
          Descartar
        </button>
        <button className="primary" type="button" onClick={continueToComposer}>
          Seguir editando para publicar
        </button>
      </div>
    </div>
  ) : null;

  if (loading) {
    return (
      <div className="wy" style={{ display: 'grid', placeItems: 'center' }}>
        <p className="muted">Verificando acceso…</p>
      </div>
    );
  }

  return (
    <WyFrame
      characterInitials={initialsOf(character?.name)}
      avatarUrl={character?.avatarUrl}
      activeRoute="my-stories"
      onNavigate={navigate}
      onOpenAccount={openAccount}
      toast={toast}
      overlay={draftModal}
      sheet={sheet ? <Sheet title={sheet.title} rows={sheet.rows} onClose={() => setSheet(null)} /> : null}
      rightRail={
        <RightRail
          summaryHidden={summaryHidden}
          onToggleSummary={() => setSummaryHidden((value) => !value)}
          onMood={() => router.push('/mi-estado')}
        />
      }
    >
      <section className="screen transform-page">
        <section className="card transform-hero">
          <div>
            <span className="micro-label">CREATIVIDAD · PLANTILLAS LOCALES</span>
            <h1>Transforma tu relato</h1>
            <p>Dale otra forma a un texto propio. Elige formato y tono; el resultado es un borrador privado que puedes editar.</p>
          </div>
          <span className="privacy-badge">
            <Icon name="lock" /> Borrador privado
          </span>
        </section>

        <section className="card transform-form">
          <div className="transform-note">
            <Icon name="sparkle" />
            <p>
              Esta transformación usa plantillas locales. Tu texto no se envía a un servicio externo de inteligencia
              artificial y tu relato original no se modifica.
            </p>
          </div>

          {sourcesError ? (
            <div className="auth-error" role="alert">
              {sourcesError}
              <button className="text-link" type="button" onClick={() => void loadSources()} style={{ marginLeft: 8 }}>
                Reintentar
              </button>
            </div>
          ) : null}

          {!sourcesError && sources.length === 0 ? (
            <div className="transform-empty">
              <Icon name="book" />
              <h2>Necesitas un relato propio para transformar</h2>
              <p>Crea o guarda un relato con texto y vuelve a esta pantalla cuando quieras darle otra forma.</p>
              <button className="secondary" type="button" onClick={() => router.push('/mis-relatos?compose=1')}>
                Crear un relato
              </button>
            </div>
          ) : (
            <>
              <label className="field-label" htmlFor="creativeOrigin">
                Relato de origen
              </label>
              <select
                id="creativeOrigin"
                className="transform-select"
                value={sourceId}
                onChange={(event) => {
                  setSourceId(event.target.value);
                  setFormError('');
                }}
              >
                {sources.map((item) => (
                  <option value={item.id} key={item.id}>
                    {item.title}
                  </option>
                ))}
              </select>

              <div className="transform-source-preview">
                <span className="micro-label">TEXTO DE PARTIDA</span>
                <b>{source?.title ?? 'Elige un relato'}</b>
                <p>{sourceText ? `${sourceText.slice(0, 260)}${sourceText.length > 260 ? '…' : ''}` : 'Sin texto disponible.'}</p>
              </div>

              <fieldset className="transform-fieldset">
                <legend>Elige el formato</legend>
                <div className="transform-format-grid">
                  {FORMATS.map((item) => (
                    <button
                      key={item.value}
                      className={`transform-format-card${format === item.value ? ' selected' : ''}`}
                      type="button"
                      aria-pressed={format === item.value}
                      onClick={() => setFormat(item.value)}
                    >
                      <span>
                        <Icon name={item.icon} />
                      </span>
                      <b>{item.value}</b>
                      <small>{item.hint}</small>
                    </button>
                  ))}
                </div>
              </fieldset>

              <fieldset className="transform-fieldset">
                <legend>Tono</legend>
                <div className="filter-row transform-tones">
                  {TONES.map((item) => (
                    <button
                      key={item}
                      className={`filter-pill${tone === item ? ' active' : ''}`}
                      type="button"
                      aria-pressed={tone === item}
                      onClick={() => setTone(item)}
                    >
                      {item}
                    </button>
                  ))}
                </div>
              </fieldset>

              {formError ? (
                <p className="auth-error" role="alert">
                  {formError}
                </p>
              ) : null}

              <div className="editor-actions transform-actions">
                <button className="ghost" type="button" onClick={() => router.push('/mis-relatos')}>
                  Cancelar
                </button>
                <button className="primary" type="button" onClick={openDraft} disabled={!source}>
                  <Icon name="sparkle" /> Crear borrador
                </button>
              </div>
            </>
          )}
        </section>
      </section>
    </WyFrame>
  );
}
