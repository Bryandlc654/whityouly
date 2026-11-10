'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { API_URL } from '@/lib/api';
import { authFetch, logout as endSession, tokenStorage } from '@/lib/auth';
import type { CharacterSummary } from '@/components/feed/types';
import Icon from '@/components/wy/Icon';
import MiEspacioNav from '@/components/wy/MiEspacioNav';
import Guide58Modal from '@/components/wy/Guide58Modal';
import MoodModal, { MOOD_EMOJI } from '@/components/wy/MoodModal';
import RightRail from '@/components/wy/RightRail';
import WyFrame, { type WyRoute } from '@/components/wy/Shell';
import { Sheet, type SheetRow } from '@/components/wy/Overlays';
import {
  createEmotionalLog,
  daypartToLoggedAt,
  deleteEmotionalLog,
  restoreEmotionalLog,
  updateEmotionalLog,
} from '@/lib/emotionalMap';
import {
  createDiaryNote,
  deleteDiaryNote,
  listDiary,
  restoreDiaryNote,
  updateDiaryNote,
  type DiaryEntry,
  type DiaryEntryType,
} from '@/lib/diary';
import PageSkeleton, { SkeletonList } from '@/components/wy/PageSkeleton';

const DAYPART = 'Todo el día';
const NOTE_MAX_LENGTH = 10_000;
const TITLE_MAX_LENGTH = 100;

type NoteEditorState = {
  mode: 'create' | 'edit';
  id?: string;
  title: string;
  content: string;
};

type MoodEditorState = {
  mode: 'create' | 'edit';
  id?: string;
  name: string;
  value: number;
  note: string;
  daypart: string;
};

function initialsOf(name?: string | null) {
  if (!name) return '?';
  return name.trim().slice(0, 2).toUpperCase();
}

function dateKey(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value.slice(0, 10);
  return new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

function dateLabel(value: string): string {
  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  const label = new Intl.DateTimeFormat('es-ES', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date);
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function timeLabel(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('es-ES', { hour: '2-digit', minute: '2-digit' }).format(date);
}

function dayRange(value: string): { from?: string; to?: string } {
  if (!value) return {};
  const from = new Date(`${value}T00:00:00`);
  const to = new Date(`${value}T23:59:59.999`);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return {};
  return { from: from.toISOString(), to: to.toISOString() };
}

function entryTitle(entry: DiaryEntry): string {
  if (entry.kind === 'NOTE') return entry.title?.trim() || 'Nota sin título';
  const emoji = entry.emotion?.name ? MOOD_EMOJI[entry.emotion.name] ?? '·' : '·';
  return `${emoji} ${entry.emotion?.name ?? 'Emoción'} · ${entry.intensity ?? '—'}/10`;
}

function entryContent(entry: DiaryEntry): string {
  return entry.content?.trim() ?? '';
}

export default function DiaryPage() {
  const router = useRouter();

  const [character, setCharacter] = useState<CharacterSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [guideOpen, setGuideOpen] = useState(false);
  const [entries, setEntries] = useState<DiaryEntry[]>([]);
  const [trashCount, setTrashCount] = useState(0);
  const [nextCursor, setNextCursor] = useState<{ at: string; id: string } | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [listLoading, setListLoading] = useState(true);
  const [error, setError] = useState('');

  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [date, setDate] = useState('');
  const [filter, setFilter] = useState<DiaryEntryType>('ALL');
  const [trash, setTrash] = useState(false);

  const [noteEditor, setNoteEditor] = useState<NoteEditorState | null>(null);
  const [noteError, setNoteError] = useState('');
  const [savingNote, setSavingNote] = useState(false);
  const [moodEditor, setMoodEditor] = useState<MoodEditorState | null>(null);
  const [moodError, setMoodError] = useState('');
  const [savingMood, setSavingMood] = useState(false);
  const [reader, setReader] = useState<DiaryEntry | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DiaryEntry | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [sheet, setSheet] = useState<{ title: string; rows: SheetRow[] } | null>(null);
  const [toast, setToast] = useState('');
  const [summaryHidden, setSummaryHidden] = useState(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout>>();

  const notify = useCallback((message: string) => {
    setToast(message);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 2400);
  }, []);

  useEffect(() => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 250);
    return () => clearTimeout(timer);
  }, [query]);

  const load = useCallback(async () => {
    setListLoading(true);
    setError('');
    const range = dayRange(date);
    const result = await listDiary({
      q: debouncedQuery,
      from: range.from,
      to: range.to,
      type: filter,
      trash,
      limit: 50,
    });
    setListLoading(false);

    if (result.status !== 'ok') {
      setEntries([]);
      setError(result.message);
      return;
    }

    setEntries(result.data.items);
    setTrashCount(result.data.trashCount);
    setNextCursor(result.data.nextCursor);
  }, [debouncedQuery, date, filter, trash]);

  const loadMore = useCallback(async () => {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    const range = dayRange(date);
    const result = await listDiary({
      q: debouncedQuery,
      from: range.from,
      to: range.to,
      type: filter,
      trash,
      limit: 50,
      before: nextCursor.at,
      beforeId: nextCursor.id,
    });
    setLoadingMore(false);

    if (result.status !== 'ok') {
      notify(result.message);
      return;
    }

    setEntries((prev) => [...prev, ...result.data.items]);
    setTrashCount(result.data.trashCount);
    setNextCursor(result.data.nextCursor);
  }, [debouncedQuery, date, filter, loadingMore, nextCursor, notify, trash]);

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
    if (!loading) void load();
  }, [loading, load]);

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
        router.push('/mi-espacio');
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
        router.push('/ayuda');
        break;
      default:
        notify('Esta sección llega con los próximos módulos.');
    }
  };

  const openNewNote = () => {
    setReader(null);
    setNoteError('');
    setNoteEditor({ mode: 'create', title: '', content: '' });
  };

  const openNewMood = () => {
    setReader(null);
    setMoodError('');
    setMoodEditor({
      mode: 'create',
      name: 'Esperanza',
      value: 7,
      note: '',
      daypart: DAYPART,
    });
  };

  const editEntry = (entry: DiaryEntry) => {
    setReader(null);
    if (entry.kind === 'NOTE') {
      setNoteError('');
      setNoteEditor({
        mode: 'edit',
        id: entry.id,
        title: entry.title ?? '',
        content: entry.content ?? '',
      });
      return;
    }

    setMoodError('');
    setMoodEditor({
      mode: 'edit',
      id: entry.id,
      name: entry.emotion?.name ?? 'Esperanza',
      value: entry.intensity ?? 7,
      note: entry.content ?? '',
      daypart: DAYPART,
    });
  };

  const saveNote = async () => {
    if (!noteEditor) return;
    const content = noteEditor.content.trim();
    if (!content) {
      setNoteError('Escribe algo antes de guardar tu nota.');
      return;
    }

    setSavingNote(true);
    setNoteError('');
    const title = noteEditor.title.trim();
    const result =
      noteEditor.mode === 'edit' && noteEditor.id
        ? await updateDiaryNote(noteEditor.id, { title, content })
        : await createDiaryNote({ title: title || undefined, content });
    setSavingNote(false);

    if (result.status !== 'ok') {
      setNoteError(result.message);
      return;
    }

    if (noteEditor.mode === 'create') {
      setQuery('');
      setDebouncedQuery('');
      setDate('');
      setFilter('ALL');
      setTrash(false);
    }

    setNoteEditor(null);
    notify(noteEditor.mode === 'edit' ? 'Cambios guardados.' : 'Nota guardada solo para ti.');
    await load();
  };

  const saveMood = async () => {
    if (!moodEditor) return;
    setSavingMood(true);
    setMoodError('');

    const result =
      moodEditor.mode === 'edit' && moodEditor.id
        ? await updateEmotionalLog(moodEditor.id, {
            emotion: moodEditor.name,
            intensity: moodEditor.value,
            contextNote: moodEditor.note.trim(),
          })
        : await createEmotionalLog({
            emotion: moodEditor.name,
            intensity: moodEditor.value,
            contextNote: moodEditor.note.trim() || undefined,
            loggedAt: daypartToLoggedAt(moodEditor.daypart),
          });

    setSavingMood(false);

    if (result.status !== 'ok') {
      setMoodError(result.message);
      return;
    }

    if (moodEditor.mode === 'create') {
      setQuery('');
      setDebouncedQuery('');
      setDate('');
      setFilter('ALL');
      setTrash(false);
    }

    setMoodEditor(null);
    notify(moodEditor.mode === 'edit' ? 'Registro actualizado.' : 'Registro guardado en tu diario.');
    await load();
  };

  const removeEntry = async (entry: DiaryEntry) => {
    setBusyId(entry.id);
    const result =
      entry.kind === 'NOTE' ? await deleteDiaryNote(entry.id) : await deleteEmotionalLog(entry.id);
    setBusyId(null);

    if (result.status !== 'ok') {
      notify(result.message);
      return;
    }

    setDeleteTarget(null);
    setReader(null);
    notify('Registro movido a tu papelera privada.');
    await load();
  };

  const restoreEntry = async (entry: DiaryEntry) => {
    setBusyId(entry.id);
    const result =
      entry.kind === 'NOTE' ? await restoreDiaryNote(entry.id) : await restoreEmotionalLog(entry.id);
    setBusyId(null);

    if (result.status !== 'ok') {
      notify(result.message);
      return;
    }

    setReader(null);
    notify('Registro recuperado en tu diario.');
    await load();
  };

  const clearFilters = () => {
    setQuery('');
    setDebouncedQuery('');
    setDate('');
    setFilter('ALL');
  };

  const toggleTrash = () => {
    setTrash((value) => !value);
    clearFilters();
  };

  const groups = entries.reduce<{ date: string; items: DiaryEntry[] }[]>((acc, entry) => {
    const key = dateKey(entry.occurredAt);
    const group = acc.find((item) => item.date === key);
    if (group) group.items.push(entry);
    else acc.push({ date: key, items: [entry] });
    return acc;
  }, []);

  const filtered = Boolean(query.trim() || date || filter !== 'ALL');
  const resultLabel = trash
    ? `${entries.length} ${entries.length === 1 ? 'registro en la papelera' : 'registros en la papelera'}`
    : filtered
      ? `${entries.length} ${entries.length === 1 ? 'resultado' : 'resultados'}`
      : `${entries.length} ${entries.length === 1 ? 'registro guardado' : 'registros guardados'}`;

  const renderNoteEditor = () =>
    noteEditor ? (
      <div className="modal diary-editor" role="dialog" aria-modal="true" aria-label="Editor de nota privada">
        <div className="modal-head">
          <div>
            <span className="diary-private">
              <Icon name="lock" /> Solo para ti
            </span>
            <h2>{noteEditor.mode === 'edit' ? 'Editar nota' : 'Escribir una nota'}</h2>
          </div>
          <button
            className="close"
            type="button"
            onClick={() => setNoteEditor(null)}
            aria-label="Cerrar editor de nota"
          >
            <Icon name="x" />
          </button>
        </div>

        <label htmlFor="diaryTitle">
          Título <span>(opcional)</span>
        </label>
        <input
          id="diaryTitle"
          maxLength={TITLE_MAX_LENGTH}
          value={noteEditor.title}
          placeholder="Un nombre para este recuerdo o idea"
          onChange={(event) => setNoteEditor((prev) => (prev ? { ...prev, title: event.target.value } : prev))}
        />

        <label htmlFor="diaryText">Mi nota</label>
        <textarea
          id="diaryText"
          maxLength={NOTE_MAX_LENGTH}
          value={noteEditor.content}
          placeholder="Una alegría, algo que pasó hoy, una idea…"
          onChange={(event) => setNoteEditor((prev) => (prev ? { ...prev, content: event.target.value } : prev))}
        />
        <div className="diary-text-count">
          {noteEditor.content.length}/{NOTE_MAX_LENGTH} caracteres
        </div>
        <p className="diary-storage-note">Solo tú puedes verla. No se publica en el feed.</p>

        {noteError ? (
          <p className="diary-error" role="alert">
            {noteError}
          </p>
        ) : null}

        <div className="modal-actions">
          <button className="ghost" type="button" onClick={() => setNoteEditor(null)} disabled={savingNote}>
            Cancelar
          </button>
          <button className="primary" type="button" onClick={() => void saveNote()} disabled={savingNote}>
            {savingNote ? 'Guardando…' : noteEditor.mode === 'edit' ? 'Guardar cambios' : 'Guardar nota'}
          </button>
        </div>
      </div>
    ) : null;

  const renderMoodEditor = () =>
    moodEditor ? (
      <MoodModal
        name={moodEditor.name}
        value={moodEditor.value}
        note={moodEditor.note}
        daypart={moodEditor.daypart}
        mode={moodEditor.mode}
        saving={savingMood}
        error={moodError}
        onChangeName={(name) => setMoodEditor((prev) => (prev ? { ...prev, name } : prev))}
        onChangeValue={(value) => setMoodEditor((prev) => (prev ? { ...prev, value } : prev))}
        onChangeNote={(note) => setMoodEditor((prev) => (prev ? { ...prev, note } : prev))}
        onChangeDaypart={(daypart) => setMoodEditor((prev) => (prev ? { ...prev, daypart } : prev))}
        onSave={() => void saveMood()}
        onClose={() => setMoodEditor(null)}
      />
    ) : null;

  const renderReader = () =>
    reader ? (
      <div className="modal diary-reader" role="dialog" aria-modal="true" aria-label="Lectura privada">
        <div className="modal-head">
          <span className="diary-private">
            <Icon name="lock" /> {reader.kind === 'NOTE' ? 'Nota privada' : 'Registro privado'}
          </span>
          <button className="close" type="button" onClick={() => setReader(null)} aria-label="Cerrar lectura">
            <Icon name="x" />
          </button>
        </div>

        <p className="diary-entry-meta">
          {dateLabel(dateKey(reader.occurredAt))} · {timeLabel(reader.occurredAt)}
        </p>
        <h2>{entryTitle(reader)}</h2>
        {entryContent(reader) ? (
          <div className="diary-full-text">{entryContent(reader)}</div>
        ) : (
          <p>Este registro no tiene una nota adicional.</p>
        )}

        <div className="modal-actions">
          {trash ? (
            <button className="primary" type="button" onClick={() => void restoreEntry(reader)} disabled={busyId === reader.id}>
              <Icon name="restore" /> {busyId === reader.id ? 'Restaurando…' : 'Restaurar'}
            </button>
          ) : (
            <>
              <button
                className="ghost diary-delete"
                type="button"
                onClick={() => {
                  setDeleteTarget(reader);
                  setReader(null);
                }}
              >
                Eliminar
              </button>
              <button className="primary" type="button" onClick={() => editEntry(reader)}>
                <Icon name="edit" /> Editar {reader.kind === 'NOTE' ? 'nota' : 'emoción'}
              </button>
            </>
          )}
        </div>
      </div>
    ) : null;

  const renderDelete = () =>
    deleteTarget ? (
      <div className="modal diary-confirm" role="dialog" aria-modal="true" aria-label="Confirmar eliminación">
        <div className="modal-head">
          <h2>
            ¿Eliminar {deleteTarget.kind === 'NOTE' ? 'esta nota' : 'este registro de emoción'}?
          </h2>
          <button
            className="close"
            type="button"
            onClick={() => setDeleteTarget(null)}
            aria-label="Cancelar eliminación"
          >
            <Icon name="x" />
          </button>
        </div>
        <p>Se moverá a tu papelera privada. Podrás restaurarlo cuando quieras.</p>
        <p className="diary-delete-title">{entryTitle(deleteTarget)}</p>
        <div className="modal-actions">
          <button className="secondary" type="button" onClick={() => setDeleteTarget(null)}>
            Cancelar
          </button>
          <button
            className="primary"
            type="button"
            onClick={() => void removeEntry(deleteTarget)}
            disabled={busyId === deleteTarget.id}
          >
            {busyId === deleteTarget.id ? 'Eliminando…' : 'Eliminar'}
          </button>
        </div>
      </div>
    ) : null;

  if (loading) {
    return (
      <PageSkeleton variant="form" />
    );
  }

  return (
    <WyFrame
      className="diary-mode"
      characterInitials={initialsOf(character?.name)}
      avatarUrl={character?.avatarUrl}
      activeRoute="mood"
      onNavigate={navigate}
      onOpenAccount={openAccount}
      toast={toast}
      overlay={renderNoteEditor() ?? renderMoodEditor() ?? renderReader() ?? renderDelete()}
      sheet={sheet ? <Sheet title={sheet.title} rows={sheet.rows} onClose={() => setSheet(null)} /> : null}
      rightRail={
        <RightRail
          summaryHidden={summaryHidden}
          onToggleSummary={() => setSummaryHidden((value) => !value)}
          onMood={() => router.push('/mi-estado')}
        />
      }
    >
      <section className="screen diary-screen">
        <MiEspacioNav active="diary" />

        <header className="diary-heading space-description">
          <div>
            <span className="diary-private">
              <Icon name="lock" /> Solo para ti · Opcional
            </span>
            <h1>Mi diario</h1>
            <p>
              Escribe recuerdos e ideas, o registra cómo te sientes. Aquí encontrarás tus notas y emociones
              guardadas; solo tú puedes verlas.
            </p>
          </div>
          <button className="guide-btn" type="button" onClick={() => setGuideOpen(true)} aria-label="Cómo usar Mi diario">
            <Icon name="help" />
            <span>Cómo usarlo</span>
          </button>
        </header>

        <div className="diary-create-actions">
          <button className="primary" type="button" onClick={openNewNote}>
            <Icon name="edit" /> Escribir una nota
          </button>
          <button className="secondary" type="button" onClick={openNewMood}>
            <Icon name="pulse" /> Registrar cómo me siento
          </button>
        </div>

        <p className="diary-storage-note">
          Tus notas y emociones son privadas. No se publican en tu perfil ni en el feed.
        </p>

        <section className="diary-history" aria-labelledby="diaryHistoryTitle">
          <div className="diary-history-heading">
            <h2 id="diaryHistoryTitle">{trash ? 'Papelera privada' : 'Mis notas y emociones'}</h2>
            <button className={`text-link ${trash ? 'active' : ''}`} type="button" onClick={toggleTrash} aria-pressed={trash}>
              {trash ? 'Volver al diario' : `Papelera${trashCount ? ` (${trashCount})` : ''}`}
            </button>
          </div>
          <p className="diary-history-help">
            {trash
              ? 'Aquí puedes recuperar las notas y emociones que eliminaste.'
              : 'Aquí encontrarás las notas y emociones que has guardado. Solo tú puedes verlas.'}
          </p>

          <div className="diary-search-row">
            <label className="diary-search" htmlFor="diarySearch">
              <Icon name="search" />
              <input
                id="diarySearch"
                type="search"
                value={query}
                maxLength={200}
                autoComplete="off"
                placeholder="Buscar una nota o emoción"
                onChange={(event) => setQuery(event.target.value)}
              />
            </label>
            <label className="diary-date-filter" htmlFor="diaryDateFilter">
              <span>Filtrar por fecha</span>
              <input
                id="diaryDateFilter"
                type="date"
                value={date}
                max={new Intl.DateTimeFormat('en-CA').format(new Date())}
                onChange={(event) => setDate(event.target.value)}
              />
            </label>
          </div>

          <div className="diary-filters" role="group" aria-label="Tipo de registro">
            {[
              ['ALL', 'Todas'],
              ['NOTE', 'Notas'],
              ['EMOTIONAL', 'Emociones'],
            ].map(([key, label]) => (
              <button
                key={key}
                className={`filter-pill ${filter === key ? 'active' : ''}`}
                type="button"
                aria-pressed={filter === key}
                onClick={() => setFilter(key as DiaryEntryType)}
              >
                {label}
              </button>
            ))}
            {filtered ? (
              <button className="text-link" type="button" onClick={clearFilters}>
                Limpiar filtros
              </button>
            ) : null}
          </div>

          <p className="diary-result-count" aria-live="polite">
            {resultLabel}
            {nextCursor ? ' · Hay más para cargar' : ''}
          </p>

          {listLoading ? <SkeletonList count={2} /> : null}

          {!listLoading && error ? (
            <div className="auth-error" role="alert">
              {error}
              <button className="text-link" type="button" onClick={() => void load()} style={{ marginLeft: 8 }}>
                Reintentar
              </button>
            </div>
          ) : null}

          {!listLoading && !error && groups.length === 0 ? (
            <div className="diary-empty">
              <span>
                <Icon name={trash ? 'trash' : 'book'} />
              </span>
              <h3>
                {filtered
                  ? 'No encontramos notas ni emociones con esos filtros'
                  : trash
                    ? 'Tu papelera está vacía'
                    : 'Tu diario comienza cuando tú quieras'}
              </h3>
              <p>
                {filtered
                  ? 'Prueba otras palabras o limpia los filtros.'
                  : trash
                    ? 'Aquí puedes recuperar las notas y emociones que elimines.'
                    : 'Puedes guardar una idea, una alegría, un recuerdo o cómo te sientes. No necesitas escribir todos los días.'}
              </p>
              {filtered ? (
                <button className="text-link" type="button" onClick={clearFilters}>
                  Limpiar filtros
                </button>
              ) : trash ? null : (
                <button className="text-link" type="button" onClick={openNewNote}>
                  Escribir mi primera nota
                </button>
              )}
            </div>
          ) : null}

          {!listLoading && !error
            ? groups.map((group) => (
                <div className="diary-day-group" key={group.date}>
                  <h3 className="diary-date">{dateLabel(group.date)}</h3>
                  {group.items.map((entry) => (
                    <article className="diary-entry" key={`${entry.kind}-${entry.id}`}>
                      <div className="diary-entry-meta">
                        <span>
                          <Icon name={entry.kind === 'NOTE' ? 'edit' : 'pulse'} />
                          {entry.kind === 'NOTE' ? 'Nota' : 'Emoción'}
                        </span>
                        <time dateTime={entry.occurredAt}>{timeLabel(entry.occurredAt)}</time>
                      </div>

                      <button
                        className="diary-entry-open"
                        type="button"
                        disabled={trash}
                        onClick={() => setReader(entry)}
                      >
                        <span className="diary-entry-title">{entryTitle(entry)}</span>
                        {entryContent(entry) ? (
                          <span className="diary-entry-excerpt">{entryContent(entry)}</span>
                        ) : null}
                      </button>

                      <div className="diary-entry-actions">
                        {trash ? (
                          <>
                            <small>Eliminada el {dateLabel(dateKey(entry.deletedAt ?? entry.occurredAt))}</small>
                            <button
                              className="text-link"
                              type="button"
                              onClick={() => void restoreEntry(entry)}
                              disabled={busyId === entry.id}
                            >
                              <Icon name="restore" /> {busyId === entry.id ? 'Restaurando…' : 'Restaurar'}
                            </button>
                          </>
                        ) : (
                          <>
                            <button className="text-link" type="button" onClick={() => editEntry(entry)}>
                              <Icon name="edit" /> Editar
                            </button>
                            <button
                              className="text-link diary-delete"
                              type="button"
                              onClick={() => setDeleteTarget(entry)}
                            >
                              <Icon name="trash" /> Eliminar
                            </button>
                          </>
                        )}
                      </div>
                    </article>
                  ))}
                </div>
              ))
            : null}

          {!listLoading && !error && nextCursor ? (
            <div className="diary-load-more-wrap">
              <button className="secondary diary-load-more" type="button" onClick={() => void loadMore()} disabled={loadingMore}>
                {loadingMore ? 'Cargando…' : 'Cargar más'}
              </button>
            </div>
          ) : null}
        </section>

        {guideOpen ? (
          <div className="modal-layer">
            <Guide58Modal type="diary" onClose={() => setGuideOpen(false)} />
          </div>
        ) : null}
      </section>
    </WyFrame>
  );
}
