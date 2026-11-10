'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { API_URL } from '@/lib/api';
import { fetchAccount } from '@/lib/account';
import { authFetch, logout as endSession, tokenStorage } from '@/lib/auth';
import type { CharacterSummary } from '@/components/feed/types';
import Avatar from '@/components/wy/Avatar';
import Icon from '@/components/wy/Icon';
import PostCard from '@/components/wy/PostCard';
import ShareStoryModal, { type ShareStoryData } from '@/components/wy/ShareStoryModal';
import StoryViewer from '@/components/wy/StoryViewer';
import RightRail from '@/components/wy/RightRail';
import WyFrame, { type WyRoute } from '@/components/wy/Shell';
import { Sheet, type SheetRow } from '@/components/wy/Overlays';
import { V58_EMOTIONS, V58_TOPICS } from '@/lib/v58Taxonomy';
import { listPublicStories, reportStory, type FollowingStory } from '@/lib/stories';
import { searchCharacters, type CharacterSearchItem } from '@/lib/characters';
import { getFeaturedStories, type FeaturedStory } from '@/lib/discovery';
import { followCharacter, listFollowing, unfollowCharacter, whatIFollow } from '@/lib/follows';
import {
  followStory,
  listSupportedStoryIds,
  supportStory,
  unfollowStory,
  unsupportStory,
} from '@/lib/interactions';
import { saveStory, unsaveStory } from '@/lib/bookmarks';
import { saveAuthorPreference } from '@/lib/contentPreferences';
import { REPORT_REASONS, REPORT_REASON_LABELS, type ReportReason } from '@/lib/moderation';
import type { FeedStory } from '@/components/wy/feedData';
import PageSkeleton, { SkeletonList } from '@/components/wy/PageSkeleton';

type SearchTab = 'all' | 'stories' | 'people' | 'categories';
type Scope = '' | 'peru' | 'global';
type Kind = '' | 'updates' | 'new' | 'closure';
type Sort = '' | 'recent';

interface FeedEntry extends FeedStory {
  isOwn: boolean;
  status?: 'DRAFT' | 'PUBLISHED';
  mediaUrl?: string | null;
  audioUrl?: string | null;
}

const TABS: { key: SearchTab; label: string }[] = [
  { key: 'all', label: 'Todos' },
  { key: 'stories', label: 'Relatos' },
  { key: 'people', label: 'Personas' },
  { key: 'categories', label: 'Temas y emociones' },
];

const KIND_LABELS: Record<Exclude<Kind, ''>, string> = {
  updates: 'Con actualizaciones',
  new: 'Relatos nuevos',
  closure: 'Cierres compartidos',
};


function initialsOf(name?: string | null) {
  if (!name) return '?';
  return name.trim().slice(0, 2).toUpperCase();
}

function relativeTime(value: string): string {
  // Mismo estilo que los relatos de ejemplo de v58: «Hace 18 minutos», «Hace 4 días».
  const time = new Date(value).getTime();
  if (Number.isNaN(time)) return '';
  const unit = (n: number, one: string, many: string) => `Hace ${n} ${n === 1 ? one : many}`;
  const minutes = Math.max(0, Math.round((Date.now() - time) / 60_000));
  if (minutes < 1) return 'Ahora mismo';
  if (minutes < 60) return unit(minutes, 'minuto', 'minutos');
  const hours = Math.round(minutes / 60);
  if (hours < 24) return unit(hours, 'hora', 'horas');
  const days = Math.round(hours / 24);
  if (days < 7) return unit(days, 'día', 'días');
  const weeks = Math.round(days / 7);
  if (days < 30) return unit(weeks, 'semana', 'semanas');
  const months = Math.round(days / 30);
  if (months < 12) return unit(months, 'mes', 'meses');
  return unit(Math.round(days / 365), 'año', 'años');
}

function normalizeSearch(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function toEntry(story: FollowingStory, authorName: string, preferredLanguage: string): FeedEntry {
  const isOwn = story.author.name === authorName;
  return {
    id: story.id,
    author: story.author.name,
    initials: initialsOf(story.author.name),
    time: relativeTime(story.createdAt),
    category: story.categories[0] ?? 'Relato',
    updateKind:
      story.opening?.updateKind ??
      (story.stageCount > 1 ? `Evolución · ${story.stageCount} etapas` : 'Relato'),
    updateDate: relativeTime(story.updatedAt),
    updateText: '',
    title: story.title,
    text: story.opening?.content ?? '',
    language: story.language,
    countryCode: story.countryCode,
    visualCardTheme: story.visualCardTheme,
    contentWarning: story.contentWarning,
    musicLabel: story.musicLabel,
    externalShare: story.externalShare,
    guestReadable: story.guestReadable,
    transcript: story.opening?.transcript ?? null,
    translation:
      preferredLanguage && preferredLanguage !== story.language
        ? story.translations?.[preferredLanguage] ?? null
        : null,
    support: story.supportCount,
    comments: story.commentCount,
    stageCount: story.stageCount,
    mediaUrl: story.opening?.mediaUrl ?? null,
    audioUrl: story.opening?.audioUrl ?? null,
    isOwn,
    ...(isOwn ? { status: 'PUBLISHED' as const } : {}),
  };
}

export default function ExplorePage() {
  const router = useRouter();

  const [character, setCharacter] = useState<CharacterSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [featured, setFeatured] = useState<FeaturedStory[]>([]);
  const [latest, setLatest] = useState<FollowingStory | null>(null);
  const [preferredLanguage, setPreferredLanguage] = useState('es');

  const [q, setQ] = useState('');
  const [selCat, setSelCat] = useState<string | null>(null);
  const [selEmo, setSelEmo] = useState<string | null>(null);
  const [selScope, setSelScope] = useState<Scope>('');
  const [selKind, setSelKind] = useState<Kind>('');
  const [selSort, setSelSort] = useState<Sort>('');
  const [tab, setTab] = useState<SearchTab>('all');

  const [stories, setStories] = useState<FollowingStory[]>([]);
  const [people, setPeople] = useState<CharacterSearchItem[]>([]);
  const [following, setFollowing] = useState<Set<string>>(new Set());
  const [followStories, setFollowStories] = useState<Set<string>>(new Set());
  const [supported, setSupported] = useState<Set<string>>(new Set());
  const [supportCounts, setSupportCounts] = useState<Record<string, number>>({});
  const [saved, setSaved] = useState<Set<string>>(new Set());
  const [busyAuthor, setBusyAuthor] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);

  const [filtersOpen, setFiltersOpen] = useState(false);
  const [draftCat, setDraftCat] = useState('');
  const [draftEmo, setDraftEmo] = useState('');
  const [draftScope, setDraftScope] = useState<Scope>('');
  const [draftKind, setDraftKind] = useState<Kind>('');
  const [draftSort, setDraftSort] = useState<Sort>('');

  const [sheet, setSheet] = useState<{ title: string; rows: SheetRow[] } | null>(null);
  const [toast, setToast] = useState('');
  const [summaryHidden, setSummaryHidden] = useState(false);
  const [reader, setReader] = useState<{ id: string; title: string } | null>(null);
  const [shareStory, setShareStory] = useState<ShareStoryData | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout>>();

  const term = q.trim();
  const searchMode = Boolean(term || selCat || selEmo || selScope || selKind || selSort);

  const notify = useCallback((message: string) => {
    setToast(message);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 2400);
  }, []);

  useEffect(() => () => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
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

    void getFeaturedStories(6).then((result) => {
      if (result.status === 'ok') setFeatured(result.data.items);
    });

    // Si no hay destacados, se recomienda el relato público más reciente.
    void listPublicStories({ limit: 1 }).then((result) => {
      if (result.status === 'ok') setLatest(result.data.items[0] ?? null);
    });

    void fetchAccount().then((result) => {
      if (result.status === 'ok') setPreferredLanguage(result.data.preferences.language || 'es');
    });

    void listFollowing().then((result) => {
      if (result.status === 'ok') {
        setFollowing(new Set(result.data.items.map((item) => item.name)));
      }
    });

    void listSupportedStoryIds().then((result) => {
      if (result.status === 'ok') setSupported(new Set(result.data.storyIds));
    });

    void whatIFollow().then((result) => {
      if (result.status === 'ok') {
        setFollowStories(new Set(result.data.stories.map((story) => story.id)));
      }
    });
  }, [router]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const initialQ = params.get('q');
    const initialTab = params.get('tab');
    const category = params.get('category') ?? params.get('topic');
    const emotion = params.get('emotion');
    const scope = params.get('scope');
    const kind = params.get('kind');
    const sort = params.get('sort');

    if (initialQ) setQ(initialQ);
    if (category) setSelCat(category);
    if (emotion) setSelEmo(emotion);
    if (scope === 'peru' || scope === 'global') setSelScope(scope);
    if (kind === 'updates' || kind === 'new' || kind === 'closure') setSelKind(kind);
    if (sort === 'recent') setSelSort('recent');
    if (initialTab === 'personajes') setTab('people');
    else if (initialTab === 'historias') setTab('stories');
  }, []);

  useEffect(() => {
    if (!searchMode) {
      setStories([]);
      setPeople([]);
      setBusy(false);
      setError('');
      return;
    }

    let active = true;
    setBusy(true);
    setError('');

    const timer = setTimeout(async () => {
      const [storyResult, peopleResult] = await Promise.all([
        listPublicStories({
          q: term || undefined,
          category: selCat ?? undefined,
          emotion: selEmo ?? undefined,
          countryCode: selScope === 'peru' ? 'PE' : undefined,
          limit: 50,
        }),
        term
          ? searchCharacters(term, 12)
          : Promise.resolve({
              status: 'ok' as const,
              data: { items: [] as CharacterSearchItem[] },
            }),
      ]);

      if (!active) return;
      setBusy(false);

      if (storyResult.status === 'ok') {
        let items = storyResult.data.items;

        if (selKind === 'updates') items = items.filter((story) => story.stageCount > 1);
        else if (selKind === 'new') items = items.filter((story) => story.stageCount <= 1);
        else if (selKind === 'closure') {
          items = items.filter((story) =>
            /cierr|cerrar/i.test(story.opening?.updateKind ?? ''),
          );
        }

        if (selSort === 'recent') {
          items = [...items].sort(
            (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
          );
        }

        setStories(items);
      } else {
        setStories([]);
        setError(storyResult.message);
      }

      setPeople(peopleResult.status === 'ok' ? peopleResult.data.items : []);
    }, 220);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [searchMode, term, selCat, selEmo, selScope, selKind, selSort, refreshKey]);

  useEffect(() => {
    if (!searchMode) return;
    setTab(term ? 'all' : 'stories');
  }, [searchMode, term, selCat, selEmo, selScope, selKind, selSort]);

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
        { label: 'Lo que sigo', icon: 'users', onClick: () => router.push('/siguiendo') },
        { label: 'Editar perfil', icon: 'edit', onClick: () => router.push('/perfil/editar') },
        { label: 'Mis reportes', icon: 'flag', onClick: () => router.push('/mis-reportes') },
        { label: 'Ayuda y soporte', icon: 'mail', onClick: () => router.push('/soporte') },
        { label: 'Configuración de la cuenta', icon: 'settings', onClick: () => router.push('/cuenta/configuracion') },
        { label: 'Cerrar sesión', icon: 'user', danger: true, onClick: () => void logout() },
      ],
    });
  };

  const navigate = (route: WyRoute) => {
    switch (route) {
      case 'home':
        router.push('/feed');
        break;
      case 'following':
        router.push('/siguiendo');
        break;
      case 'profile':
        router.push('/cuenta');
        break;
      case 'my-stories':
        router.push('/mis-relatos');
        break;
      case 'explore':
        window.scrollTo({ top: 0, behavior: 'smooth' });
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

  const openFilters = () => {
    setDraftCat(selCat ?? '');
    setDraftEmo(selEmo ?? '');
    setDraftScope(selScope);
    setDraftKind(selKind);
    setDraftSort(selSort);
    setFiltersOpen(true);
  };

  const applyFilters = () => {
    setSelCat(draftCat || null);
    setSelEmo(draftEmo || null);
    setSelScope(draftScope);
    setSelKind(draftKind);
    setSelSort(draftSort);
    setFiltersOpen(false);
  };

  const clearFilters = () => {
    setSelCat(null);
    setSelEmo(null);
    setSelScope('');
    setSelKind('');
    setSelSort('');
    setDraftCat('');
    setDraftEmo('');
    setDraftScope('');
    setDraftKind('');
    setDraftSort('');
    setFiltersOpen(false);
  };

  const toggleFollow = async (name: string) => {
    const isFollowing = following.has(name);
    setBusyAuthor(name);
    const result = isFollowing ? await unfollowCharacter(name) : await followCharacter(name);
    setBusyAuthor(null);

    if (result.status !== 'ok') {
      notify(result.message);
      return;
    }

    setFollowing((prev) => {
      const next = new Set(prev);
      if (isFollowing) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const toggleSupport = async (storyId: string) => {
    const active = supported.has(storyId);
    const result = active ? await unsupportStory(storyId) : await supportStory(storyId);

    if (result.status !== 'ok') {
      notify(result.message);
      return;
    }

    setSupported((prev) => {
      const next = new Set(prev);
      if (active) next.delete(storyId);
      else next.add(storyId);
      return next;
    });
    setSupportCounts((prev) => ({ ...prev, [storyId]: result.data.count }));

    if (active) {
      const followed = await whatIFollow();
      if (followed.status === 'ok') {
        setFollowStories(new Set(followed.data.stories.map((story) => story.id)));
      }
    } else {
      setFollowStories((prev) => new Set(prev).add(storyId));
    }

    notify(active ? 'Quitaste tu apoyo.' : 'Tu apoyo fue enviado.');
  };

  const toggleFollowStory = async (storyId: string) => {
    const active = followStories.has(storyId);
    const result = active ? await unfollowStory(storyId) : await followStory(storyId);

    if (result.status !== 'ok') {
      notify(result.message);
      return;
    }

    setFollowStories((prev) => {
      const next = new Set(prev);
      if (active) next.delete(storyId);
      else next.add(storyId);
      return next;
    });
    notify(
      active
        ? 'Dejaste de seguir sus actualizaciones.'
        : 'Seguirás las actualizaciones de este relato.',
    );
  };

  const toggleSave = async (storyId: string) => {
    const active = saved.has(storyId);
    const result = active ? await unsaveStory(storyId) : await saveStory(storyId);

    if (result.status !== 'ok') {
      notify(result.message);
      return;
    }

    setSaved((prev) => {
      const next = new Set(prev);
      if (active) next.delete(storyId);
      else next.add(storyId);
      return next;
    });
    notify(active ? 'Relato eliminado de guardados.' : 'Relato guardado en privado.');
  };

  const shareFromId = (storyId: string) => {
    const story = stories.find((item) => item.id === storyId);
    if (!story) return;
    const entry = toEntry(story, character?.name ?? '', preferredLanguage);
    setShareStory({
      id: entry.id,
      title: entry.title,
      text: entry.text,
      author: entry.author,
      initials: entry.initials,
      category: entry.category,
      externalShare: entry.externalShare,
      guestReadable: entry.guestReadable,
      format: entry.audioUrl
        ? 'Audio con transcripción'
        : entry.visualCardTheme
          ? 'Tarjeta visual'
          : 'Relato escrito',
    });
  };

  const openPostMenu = (storyId: string) => {
    const story = stories.find((item) => item.id === storyId);
    const authorName = story?.author.name;
    setSheet({
      title: 'Opciones del relato',
      rows: [
        { label: 'Seguir actualizaciones', icon: 'bell', onClick: () => void toggleFollowStory(storyId) },
        { label: 'Guardar relato', icon: 'bookmark', onClick: () => void toggleSave(storyId) },
        { label: 'Compartir relato', icon: 'share', onClick: () => shareFromId(storyId) },
        ...(authorName && authorName !== character?.name
          ? [
              {
                label: 'Silenciar autor',
                icon: 'eye' as const,
                onClick: () => {
                  void saveAuthorPreference(authorName, 'MUTE').then(() => {
                    notify('Silenciaste a este autor.');
                    setRefreshKey((value) => value + 1);
                  });
                },
              },
              {
                label: 'Ver menos de este autor',
                icon: 'trend' as const,
                onClick: () => {
                  void saveAuthorPreference(authorName, 'LESS').then(() => {
                    notify('Verás menos contenido de este autor.');
                    setRefreshKey((value) => value + 1);
                  });
                },
              },
              {
                label: 'Bloquear autor',
                icon: 'lock' as const,
                danger: true,
                onClick: () => {
                  void saveAuthorPreference(authorName, 'BLOCK').then(() => {
                    notify('Bloqueaste a este autor.');
                    setRefreshKey((value) => value + 1);
                  });
                },
              },
            ]
          : []),
        {
          label: 'Reportar contenido',
          icon: 'flag',
          danger: true,
          onClick: () => openReportMenu(storyId),
        },
      ],
    });
  };

  const openReportMenu = (storyId: string) => {
    setSheet({
      title: '¿Por qué lo reportas?',
      rows: REPORT_REASONS.map((reason) => ({
        label: REPORT_REASON_LABELS[reason],
        icon: 'flag' as const,
        onClick: () => void submitStoryReport(storyId, reason),
      })),
    });
  };

  const submitStoryReport = async (storyId: string, reason: ReportReason) => {
    setSheet(null);
    const result = await reportStory(storyId, reason);
    notify(result.status === 'ok' ? 'Reporte enviado a revisión.' : result.message);
  };

  // v58 muestra siempre sus 7 temas y 8 emociones públicas, en este orden.
  const categories = V58_TOPICS.map((topic) => ({ id: topic.name, name: topic.name }));
  const emotions = V58_EMOTIONS.map((name) => ({ id: name, name }));
  // v58 recomienda un solo relato bajo «Relatos que podrían acompañarte».
  const recommended: FollowingStory | null = featured[0] ?? latest;
  const categoryMatches = term
    ? [
        ...categories
          .filter((item) => normalizeSearch(item.name).includes(normalizeSearch(term)))
          .map((item) => ({ name: item.name, kind: 'category' as const })),
        ...emotions
          .filter((item) => normalizeSearch(item.name).includes(normalizeSearch(term)))
          .map((item) => ({ name: item.name, kind: 'emotion' as const })),
      ]
    : [];

  const activeFilters: { key: string; label: string }[] = [];
  if (selCat) activeFilters.push({ key: 'category', label: selCat });
  if (selEmo) activeFilters.push({ key: 'emotion', label: selEmo });
  if (selKind) activeFilters.push({ key: 'kind', label: KIND_LABELS[selKind] });
  if (selSort) activeFilters.push({ key: 'sort', label: 'Más recientes' });
  if (selScope) activeFilters.push({ key: 'scope', label: selScope === 'peru' ? 'Perú' : 'Global' });

  const removeFilter = (key: string) => {
    if (key === 'category') setSelCat(null);
    else if (key === 'emotion') setSelEmo(null);
    else if (key === 'kind') setSelKind('');
    else if (key === 'sort') setSelSort('');
    else if (key === 'scope') setSelScope('');
  };

  const renderStory = (story: FollowingStory) => {
    const entry = toEntry(story, character?.name ?? '', preferredLanguage);
    return (
      <PostCard
        key={story.id}
        story={entry}
        isOwn={entry.isOwn}
        statusLabel={entry.status}
        mediaUrl={entry.mediaUrl}
        audioUrl={entry.audioUrl}
        supported={supported.has(entry.id)}
        supportCount={supportCounts[entry.id]}
        saved={saved.has(entry.id)}
        followingAuthor={following.has(entry.author)}
        followingStory={followStories.has(entry.id)}
        onSupport={() => void toggleSupport(entry.id)}
        onSave={() => void toggleSave(entry.id)}
        onFollowAuthor={() => void toggleFollow(entry.author)}
        onFollowStory={() => void toggleFollowStory(entry.id)}
        onOpenMenu={() => openPostMenu(entry.id)}
        onPlay={() => notify('Reproduciendo vista previa')}
        onAuthor={() => router.push(`/personaje/${encodeURIComponent(entry.author)}`)}
        onComment={() => setReader({ id: story.id, title: story.title })}
        onOpenStory={() => setReader({ id: story.id, title: story.title })}
        onShare={() => shareFromId(entry.id)}
      />
    );
  };

  const renderPerson = (person: CharacterSearchItem) => {
    const isSelf = person.name === character?.name;
    const isFollowing = following.has(person.name);
    return (
      <article key={person.name} className="card follow-row explore-person">
        <Avatar initials={initialsOf(person.name)} avatarUrl={person.avatarUrl} size="sm" />
        <div>
          <b>{person.name}</b>
          <small>@{person.name.toLowerCase()}</small>
          {person.tagline ? <small>{person.tagline}</small> : null}
        </div>
        {isSelf ? (
          <button className="text-link" type="button" onClick={() => router.push('/cuenta')}>
            Ver perfil
          </button>
        ) : (
          <button
            className={`secondary${isFollowing ? ' following' : ''}`}
            type="button"
            disabled={busyAuthor === person.name}
            onClick={() => void toggleFollow(person.name)}
          >
            {isFollowing ? 'Siguiendo' : 'Seguir autor'}
          </button>
        )}
      </article>
    );
  };

  const renderCategoryMatches = () =>
    categoryMatches.map((item) => {
      const active = item.kind === 'category' ? selCat === item.name : selEmo === item.name;
      return (
        <button
          key={`${item.kind}-${item.name}`}
          className={`filter-pill${active ? ' active' : ''}`}
          type="button"
          onClick={() => {
            if (item.kind === 'category') setSelCat(active ? null : item.name);
            else setSelEmo(active ? null : item.name);
          }}
        >
          {item.name}
        </button>
      );
    });

  const emptyResults = (
    <div className="empty-state">
      <h2>No encontramos coincidencias</h2>
      <p>Prueba con otra palabra o ajusta los filtros.</p>
      {activeFilters.length > 0 ? (
        <button className="secondary" type="button" onClick={clearFilters}>
          Limpiar filtros
        </button>
      ) : null}
    </div>
  );

  const storyResults = stories.length > 0 ? <>{stories.map(renderStory)}</> : null;
  const personResults = people.length > 0 ? people.map(renderPerson) : null;
  const categoryResults = categoryMatches.length > 0 ? (
    <div className="filter-row">{renderCategoryMatches()}</div>
  ) : null;

  let results: ReactNode = null;
  if (tab === 'people') {
    results = personResults ?? emptyResults;
  } else if (tab === 'stories') {
    results = storyResults ?? emptyResults;
  } else if (tab === 'categories') {
    results = categoryResults ?? emptyResults;
  } else {
    results = (
      <>
        {personResults ? (
          <>
            <h2 className="search-section-title">Personas</h2>
            {personResults}
          </>
        ) : null}
        {categoryResults ? (
          <>
            <h2 className="search-section-title">Temas y emociones</h2>
            {categoryResults}
          </>
        ) : null}
        {storyResults ? (
          <>
            <h2 className="search-section-title">Relatos</h2>
            {storyResults}
          </>
        ) : null}
        {!personResults && !categoryResults && !storyResults ? emptyResults : null}
      </>
    );
  }

  if (loading) {
    return (
      <PageSkeleton variant="grid" />
    );
  }

  return (
    <WyFrame
      characterInitials={initialsOf(character?.name)}
      avatarUrl={character?.avatarUrl}
      activeRoute="explore"
      onNavigate={navigate}
      onOpenAccount={openAccount}
      toast={toast}
      overlay={
        <>
          {filtersOpen ? (
            <div className="modal discovery-filter-modal" role="dialog" aria-modal="true" aria-label="Filtrar relatos">
              <div className="modal-head">
                <div>
                  <h2>Filtrar relatos</h2>
                  <p>Ajusta el tema, la emoción o el tipo de relato.</p>
                </div>
                <button className="close" type="button" onClick={() => setFiltersOpen(false)} aria-label="Cerrar filtros">
                  <Icon name="x" />
                </button>
              </div>

              <div className="discovery-filter-fields">
                <div>
                  <label htmlFor="filterTopic">Tema</label>
                  <select id="filterTopic" value={draftCat} onChange={(event) => setDraftCat(event.target.value)}>
                    <option value="">Todos los temas</option>
                    {categories.map((item) => (
                      <option key={item.id} value={item.name}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="filterEmotion">Emoción o estado</label>
                  <select id="filterEmotion" value={draftEmo} onChange={(event) => setDraftEmo(event.target.value)}>
                    <option value="">Todas las emociones</option>
                    {emotions.map((item) => (
                      <option key={item.id} value={item.name}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="filterKind">Tipo de relato</label>
                  <select
                    id="filterKind"
                    value={draftKind}
                    onChange={(event) => setDraftKind(event.target.value as Kind)}
                  >
                    <option value="">Todos los relatos</option>
                    <option value="updates">Con actualizaciones</option>
                    <option value="new">Relatos nuevos</option>
                    <option value="closure">Cierres compartidos</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="filterOrder">Orden</label>
                  <select
                    id="filterOrder"
                    value={draftSort}
                    onChange={(event) => setDraftSort(event.target.value as Sort)}
                  >
                    <option value="">Recomendados</option>
                    <option value="recent">Más recientes</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="filterScope">Ámbito</label>
                  <select
                    id="filterScope"
                    value={draftScope}
                    onChange={(event) => setDraftScope(event.target.value as Scope)}
                  >
                    <option value="">Todos</option>
                    <option value="peru">Perú</option>
                    <option value="global">Global</option>
                  </select>
                </div>
              </div>

              <div className="modal-actions">
                <button className="ghost" type="button" onClick={clearFilters}>
                  Quitar filtros
                </button>
                <button className="primary" type="button" onClick={applyFilters}>
                  Aplicar filtros
                </button>
              </div>
            </div>
          ) : null}

          {reader ? (
            <StoryViewer
              storyId={reader.id}
              title={reader.title}
              onClose={() => setReader(null)}
              onNotify={notify}
            />
          ) : null}

          {shareStory ? (
            <ShareStoryModal story={shareStory} onClose={() => setShareStory(null)} onNotify={notify} />
          ) : null}
        </>
      }
      sheet={sheet ? <Sheet title={sheet.title} rows={sheet.rows} onClose={() => setSheet(null)} /> : null}
      rightRail={
        <RightRail
          summaryHidden={summaryHidden}
          onToggleSummary={() => setSummaryHidden((value) => !value)}
          onMood={() => router.push('/mi-estado')}
        />
      }
    >
      <section className="screen explore-page">
        <div className="screen-heading">
          <div>
            <h1>{searchMode ? 'Buscar' : 'Explorar'}</h1>
            <p>
              {searchMode
                ? 'Encuentra relatos y personas, o explora por tema y emoción.'
                : 'Encuentra relatos por emoción, tema o seudónimo.'}
            </p>
          </div>
          <button className="secondary" type="button" onClick={openFilters}>
            <Icon name="settings" /> Filtros
          </button>
        </div>

        <label className="search-input">
          <Icon name="search" />
          <input
            type="search"
            value={q}
            placeholder="Buscar en Withyouly"
            aria-label="Buscar en Withyouly"
            onChange={(event) => setQ(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') setQ(event.currentTarget.value.trim());
            }}
          />
          <button className="ghost" type="button" onClick={() => setQ(q.trim())}>
            Buscar
          </button>
        </label>

        {activeFilters.length > 0 ? (
          <div className="active-discovery-filters" aria-label="Filtros aplicados">
            {activeFilters.map((filter) => (
              <button
                key={filter.key}
                className="filter-pill active"
                type="button"
                aria-label={`Quitar filtro: ${filter.label}`}
                onClick={() => removeFilter(filter.key)}
              >
                {filter.label}
                <Icon name="x" />
              </button>
            ))}
            <button className="text-link" type="button" onClick={clearFilters}>
              Limpiar filtros
            </button>
          </div>
        ) : null}

        {!searchMode ? (
          <>
            <div className="filter-row" role="group" aria-label="Descubrimiento">
              <button
                className="filter-pill"
                type="button"
                onClick={clearFilters}
              >
                Recomendados
              </button>
              <button
                className={`filter-pill${selScope === 'peru' ? ' active' : ''}`}
                type="button"
                onClick={() => setSelScope('peru')}
              >
                Perú
              </button>
              <button
                className={`filter-pill${selScope === 'global' ? ' active' : ''}`}
                type="button"
                onClick={() => setSelScope('global')}
              >
                Global
              </button>
              <button
                className={`filter-pill${selEmo === 'Esperanza' ? ' active' : ''}`}
                type="button"
                onClick={() => setSelEmo('Esperanza')}
              >
                Esperanza
              </button>
              <button
                className={`filter-pill${selCat === 'Relación conmigo' ? ' active' : ''}`}
                type="button"
                onClick={() => setSelCat('Relación conmigo')}
              >
                Relación conmigo
              </button>
            </div>

            <h2 className="discovery-section-title">Explorar por tema</h2>
            <div className="category-grid">
              {V58_TOPICS.map((topic) => (
                <button
                  key={topic.name}
                  className="category-tile"
                  type="button"
                  onClick={() => setSelCat(topic.name)}
                >
                  <span>
                    <Icon name={topic.icon} />
                  </span>
                  <b>{topic.name}</b>
                  <small>{topic.description}</small>
                </button>
              ))}
            </div>

            <section className="emotion-discovery">
              <h2 className="discovery-section-title">Explorar por emoción</h2>
              <div className="filter-row">
                {emotions.map((item) => (
                  <button
                    key={item.id}
                    className={`filter-pill${selEmo === item.name ? ' active' : ''}`}
                    type="button"
                    onClick={() => setSelEmo(item.name)}
                  >
                    {item.name}
                  </button>
                ))}
              </div>
            </section>

            {recommended ? (
              <>
                <div className="section-title">
                  <div>
                    <h2>Relatos que podrían acompañarte</h2>
                  </div>
                </div>
                {renderStory(recommended)}
              </>
            ) : null}
          </>
        ) : (
          <>
            <div className="filter-row search-result-tabs" role="tablist" aria-label="Tipo de resultado">
              {TABS.map((item) => (
                <button
                  key={item.key}
                  className={`filter-pill${tab === item.key ? ' active' : ''}`}
                  type="button"
                  role="tab"
                  aria-selected={tab === item.key}
                  onClick={() => setTab(item.key)}
                >
                  {item.label}
                </button>
              ))}
            </div>

            <p className="search-result-query">
              {term ? `Resultados para “${term}”` : activeFilters.length ? 'Relatos según tus filtros' : 'Relatos recomendados'}
              {tab === 'stories' ? ` · ${stories.length} ${stories.length === 1 ? 'relato' : 'relatos'}` : ''}
            </p>

            {busy ? <SkeletonList kind="post" count={2} /> : null}
            {error ? (
              <div className="auth-error" role="alert">
                {error}
              </div>
            ) : null}

            <div className="search-results">{!busy && !error ? results : null}</div>
          </>
        )}
      </section>
    </WyFrame>
  );
}
