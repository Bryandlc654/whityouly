'use client';

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { API_URL } from '@/lib/api';
import { authFetch, logout as endSession, tokenStorage } from '@/lib/auth';
import type { CharacterSummary } from '@/components/feed/types';
import WyFrame, { type WyRoute } from '@/components/wy/Shell';
import RightRail from '@/components/wy/RightRail';
import Icon from '@/components/wy/Icon';
import MiEspacioNav from '@/components/wy/MiEspacioNav';
import GuideModal from '@/components/wy/GuideModal';
import { GUIDES } from '@/lib/guideContent';
import type { IconName } from '@/components/wy/icons';
import { Sheet, type SheetRow } from '@/components/wy/Overlays';
import TreeArt, { type TreePot, type TreeSpecies } from '@/components/wy/TreeArt';
import {
  getTree,
  updateTreeCustomization,
  type TreeDecoration,
  type TreePathKey,
  type TreeView,
} from '@/lib/tree';

type TreeTab = 'tree' | 'garden' | 'awards';

const PARTS: { key: keyof TreeView['parts']; label: string; hint: string; icon: IconName }[] = [
  { key: 'roots', label: 'Raíces', hint: 'Registros emocionales', icon: 'pulse' },
  { key: 'rings', label: 'Anillos', hint: 'Semanas en las que regresaste', icon: 'calendar' },
  { key: 'branches', label: 'Ramas', hint: 'Relatos, reflexiones y cápsulas', icon: 'book' },
  { key: 'leaves', label: 'Hojas', hint: 'Acompañamiento ofrecido', icon: 'heart' },
  { key: 'flowers', label: 'Flores', hint: 'Comentarios marcados “Me ayudó”', icon: 'sparkle' },
  { key: 'fruits', label: 'Frutos', hint: 'Ciclos y cápsulas completados', icon: 'check' },
];

const PATH_META: Record<TreePathKey, { icon: IconName; color: string; href: string }> = {
  SELF_KNOWLEDGE: { icon: 'pulse', color: 'blue', href: '/mi-estado' },
  CARE_EXPRESSION: { icon: 'sparkle', color: 'gold', href: '/cuidarme' },
  ACCOMPANIMENT: { icon: 'heart', color: 'violet', href: '/explorar' },
};

const SPECIES: { value: TreeSpecies; label: string; requirement: string }[] = [
  { value: 'bonsai', label: 'Bonsái', requirement: 'Disponible' },
  { value: 'jacaranda', label: 'Jacaranda', requirement: 'Con 1 árbol completo' },
  { value: 'olive', label: 'Olivo', requirement: 'Con 1 árbol completo' },
  { value: 'cherry', label: 'Cerezo', requirement: 'Con 3 árboles completos' },
];

const POTS: { value: TreePot; label: string; requirement: string }[] = [
  { value: 'violet', label: 'Morada', requirement: 'Disponible' },
  { value: 'terracotta', label: 'Terracota', requirement: 'Con tu primera gota' },
  { value: 'ivory', label: 'Marfil', requirement: 'Con tu primera gota' },
];

const DECORATIONS: { value: TreeDecoration; label: string; requirement: string; symbol: string }[] = [
  { value: 'none', label: 'Sin adorno', requirement: 'Disponible', symbol: '' },
  { value: 'flower', label: 'Flores', requirement: 'Con 7 días acumulados', symbol: '✿ ✿ ✿' },
  { value: 'stones', label: 'Piedras de río', requirement: 'Con 35 gotas', symbol: '● ● ●' },
  { value: 'butterfly', label: 'Mariposas', requirement: 'Con 30 días acumulados', symbol: '✦ ✿ ✦' },
];

function initialsOf(name?: string | null) {
  if (!name) return '?';
  return name.trim().slice(0, 2).toUpperCase();
}

function SectionHead({
  icon,
  title,
  sub,
  right,
}: {
  icon: IconName;
  title: string;
  sub: string;
  right?: ReactNode;
}) {
  return (
    <div className="chart-head">
      <div className="tree-section-title">
        <span className="tree-section-icon">
          <Icon name={icon} />
        </span>
        <div>
          <h2>{title}</h2>
          <p>{sub}</p>
        </div>
      </div>
      {right}
    </div>
  );
}

function speciesLabel(value: TreeSpecies) {
  return SPECIES.find((item) => item.value === value)?.label ?? 'Bonsái';
}

function decorationLabel(value: TreeDecoration) {
  return DECORATIONS.find((item) => item.value === value)?.label ?? 'Sin adorno';
}

export default function MiArbolPage() {
  const router = useRouter();
  const [character, setCharacter] = useState<CharacterSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [guideOpen, setGuideOpen] = useState(false);
  const [tree, setTree] = useState<TreeView | null>(null);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<TreeTab>('tree');
  const [gardenPage, setGardenPage] = useState(0);
  const [customizeOpen, setCustomizeOpen] = useState(false);
  const [customizing, setCustomizing] = useState(false);
  const [customizeError, setCustomizeError] = useState('');

  const [sheet, setSheet] = useState<{ title: string; rows: SheetRow[] } | null>(null);
  const [toast, setToast] = useState('');

  const notify = useCallback((message: string) => {
    setToast(message);
    window.setTimeout(() => setToast((current) => (current === message ? '' : current)), 2400);
  }, []);

  const loadTree = useCallback(async () => {
    setError('');
    try {
      setTree(await getTree());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cargar tu árbol.');
    }
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
        if (res.ok) setCharacter(await res.json());
      } catch {
        /* el árbol se intenta cargar igualmente */
      } finally {
        setLoading(false);
      }
    };
    void verify();
  }, [router]);

  useEffect(() => {
    if (!loading) void loadTree();
  }, [loading, loadTree]);

  useEffect(() => {
    if (!tree) return;
    setGardenPage((page) => Math.min(page, tree.garden.pages - 1));
  }, [tree]);

  const logout = useCallback(async () => {
    await endSession();
    router.push('/login');
  }, [router]);

  const openAccount = () => {
    setSheet({
      title: 'Tu cuenta',
      rows: [
        { label: 'Ir al Feed', icon: 'home', onClick: () => router.push('/feed') },
        { label: 'Editar perfil', icon: 'edit', onClick: () => router.push('/perfil/editar') },
        { label: 'Mis reportes', icon: 'flag', onClick: () => router.push('/mis-reportes') },
        { label: 'Ayuda y soporte', icon: 'mail', onClick: () => router.push('/soporte') },
        {
          label: 'Configuración de la cuenta',
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
        router.push('/explorar');
        break;
      case 'mood':
        router.push('/mi-espacio');
        break;
      case 'pulso':
        router.push('/pulso');
        break;
      case 'tree':
        break;
      case 'help':
        router.push('/ayuda');
        break;
      default:
        notify('Esta sección llega con los próximos módulos.');
    }
  };

  const stageIndex = tree?.stage.reached ? tree.stage.index : 0;
  const stageLabel = tree?.stage.reached ? tree.stage.label : 'Semilla';
  const cycleDrops = tree?.cycle.drops ?? 0;
  const remaining = tree?.stage.nextDrops !== null && tree ? Math.max(0, tree.stage.nextDrops - cycleDrops) : 0;
  const progressPct = tree ? Math.round(tree.stage.progress * 100) : 0;
  const visibleGardenTrees = useMemo(() => {
    if (!tree) return [];
    const start = gardenPage * 9;
    return tree.garden.trees.slice(start, start + 9);
  }, [tree, gardenPage]);

  const chooseCustomization = async (input: {
    species?: TreeSpecies;
    pot?: TreePot;
    decoration?: TreeDecoration;
  }) => {
    if (!tree) return;
    setCustomizing(true);
    setCustomizeError('');
    try {
      const updated = await updateTreeCustomization(input);
      setTree(updated);
      notify('Personalización guardada.');
    } catch (err) {
      setCustomizeError(err instanceof Error ? err.message : 'No se pudo guardar la personalización.');
    } finally {
      setCustomizing(false);
    }
  };

  const customizeModal = customizeOpen && tree ? (
    <div className="modal garden-customize49" role="dialog" aria-modal="true" aria-label="Personalizar mi recorrido">
      <div className="modal-head">
        <div>
          <span className="diary-private">
            <Icon name="lock" /> Solo para ti
          </span>
          <h2>Personaliza tu recorrido</h2>
        </div>
        <button className="close" type="button" onClick={() => setCustomizeOpen(false)} aria-label="Cerrar personalización">
          <Icon name="x" />
        </button>
      </div>
      <p>
        Elige lo que te guste. La especie y la maceta se aplican a tu árbol actual; los árboles completados conservan su
        estilo.
      </p>

      {[
        {
          key: 'species' as const,
          label: 'Especie del árbol actual',
          items: SPECIES,
          selected: tree.customization.species,
          allowed: tree.unlocks.species,
        },
        {
          key: 'pot' as const,
          label: 'Maceta del árbol actual',
          items: POTS,
          selected: tree.customization.pot,
          allowed: tree.unlocks.pots,
        },
        {
          key: 'decoration' as const,
          label: 'Adorno del jardín',
          items: DECORATIONS,
          selected: tree.customization.decoration,
          allowed: tree.unlocks.decorations,
        },
      ].map((group) => (
        <fieldset className="customize-options49" key={group.key}>
          <legend>{group.label}</legend>
          {group.items.map((item) => {
            const allowed = (group.allowed as string[]).includes(item.value);
            const selected = group.selected === item.value;
            return (
              <button
                key={item.value}
                className={`customize-choice49${selected ? ' selected' : ''}`}
                type="button"
                disabled={!allowed || customizing}
                aria-pressed={selected}
                onClick={() => void chooseCustomization({ [group.key]: item.value })}
              >
                <b>{item.label}</b>
                <small>{allowed ? (selected ? 'En uso' : 'Disponible') : item.requirement}</small>
              </button>
            );
          })}
        </fieldset>
      ))}

      {customizeError ? (
        <p className="diary-error" role="alert">
          {customizeError}
        </p>
      ) : null}

      <button className="primary" type="button" onClick={() => setCustomizeOpen(false)} disabled={customizing}>
        {customizing ? 'Guardando…' : 'Listo'}
      </button>
    </div>
  ) : null;

  return (
    <WyFrame
      characterInitials={initialsOf(character?.name)}
      avatarUrl={character?.avatarUrl}
      activeRoute="tree"
      onNavigate={navigate}
      onOpenAccount={openAccount}
      toast={toast}
      overlay={customizeModal}
      sheet={sheet ? <Sheet title={sheet.title} rows={sheet.rows} onClose={() => setSheet(null)} /> : null}
      rightRail={
        <RightRail
          summaryHidden={false}
          onToggleSummary={() => notify('Tu árbol es privado: solo tú lo ves.')}
          onMood={() => router.push('/mi-estado')}
        />
      }
    >
      <section className="screen tree-page">
        <MiEspacioNav active="tree" />
        <header className="card tree-hero">
          <div className="tree-hero-copy">
            <span className="micro-label">SOLO PARA TI · OPCIONAL</span>
            <h1>Mi árbol</h1>
            <p>
              Mira cómo crece tu árbol con tus momentos de autoconocimiento, cuidado y expresión. Es privado,
              opcional y no pierde progreso por ausencias.
            </p>
          </div>
          <button className="secondary tree-guide-btn" type="button" onClick={() => setGuideOpen(true)}>
            <Icon name="help" /> Cómo usarlo
          </button>
        </header>

        {error ? (
          <div className="auth-error" role="alert">
            {error}
            <button className="text-link" type="button" onClick={() => void loadTree()} style={{ marginLeft: 8 }}>
              Reintentar
            </button>
          </div>
        ) : null}

        {loading && !tree ? <p className="muted small">Cargando tu árbol…</p> : null}

        {tree ? (
          <nav className="tree-tabs49" aria-label="Vistas de Mi árbol">
            {[
              ['tree', 'Mi árbol'],
              ['garden', 'Mi jardín'],
              ['awards', 'Mis logros'],
            ].map(([key, label]) => (
              <button
                key={key}
                type="button"
                aria-pressed={tab === key}
                onClick={() => {
                  setTab(key as TreeTab);
                  setGardenPage(0);
                }}
              >
                {label}
              </button>
            ))}
          </nav>
        ) : null}

        {tree && tab === 'tree' ? (
          <>
            <div className="card tree-stage">
              <div className="tree-stage-visual">
                <TreeArt
                  stage={stageIndex}
                  species={tree.customization.species}
                  pot={tree.customization.pot}
                  className="tree-art"
                />
                <span className="tree-stage-chip">
                  <span>Etapa actual</span> · <b>{stageLabel}</b>
                </span>
              </div>
              <div className="tree-stage-detail">
                <p className="tree-counter49">
                  Árbol {tree.cycle.number} · {tree.cycle.completed} completado
                  {tree.cycle.completed === 1 ? '' : 's'} · {speciesLabel(tree.customization.species)}
                </p>
                <span className="tree-eyebrow">
                  {tree.stage.nextLabel ? 'PRÓXIMA ETAPA' : 'ETAPA ALCANZADA'}
                </span>
                <h2>{tree.stage.nextLabel ?? 'Frutos'}</h2>
                <p className="tree-stage-copy">
                  {cycleDrops > 0
                    ? 'Has reunido ' +
                      cycleDrops +
                      (cycleDrops === 1 ? ' gota' : ' gotas') +
                      ' en este árbol.'
                    : 'Tu árbol empieza como una semilla. Puedes cuidarlo cuando quieras.'}{' '}
                  {tree.stage.nextLabel
                    ? 'Faltan ' +
                      remaining +
                      (remaining === 1 ? ' gota' : ' gotas') +
                      ' para ' +
                      tree.stage.nextLabel +
                      '.'
                    : 'Tu árbol sigue contigo; puedes continuar a tu ritmo.'}
                </p>
                <div
                  className="big-progress"
                  role="progressbar"
                  aria-label={
                    tree.stage.nextLabel
                      ? 'Camino de ' + stageLabel + ' a ' + tree.stage.nextLabel
                      : 'Etapa Frutos alcanzada'
                  }
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={progressPct}
                >
                  <i style={{ width: progressPct + '%' }} />
                </div>
                <div className="progress-ends">
                  <span>{stageLabel}</span>
                  <span>
                    {tree.stage.nextLabel ? remaining + ' restantes' : 'Tu cuidado continúa'}
                  </span>
                  <span>{tree.stage.nextLabel ?? 'Frutos'}</span>
                </div>
                <p className="growth-days">
                  {tree.history.length > 0
                    ? tree.history.length +
                      (tree.history.length === 1
                        ? ' día con acciones registradas'
                        : ' días con acciones registradas')
                    : 'Todavía no has registrado acciones de cuidado.'}
                </p>
                <div className="no-streak">
                  <Icon name="shield" /> Tu progreso se conserva, aunque dejes de entrar.
                </div>
                <p className="tree-total49">
                  {cycleDrops} de {tree.cycle.goal} gotas en este árbol · {tree.totalDrops} en total
                </p>
                <button className="secondary" type="button" onClick={() => setCustomizeOpen(true)}>
                  Personalizar mi árbol
                </button>
              </div>
            </div>

            <section className="daily-growth" aria-labelledby="dailyGrowthTitle">
              <div className="section-title">
                <div>
                  <h2 id="dailyGrowthTitle">Pequeños gestos para hoy</h2>
                  <p>
                    Elige si te apetece. Cada camino puede sumar una gota al día; no necesitas completar
                    los tres.
                  </p>
                </div>
                <span className="tree-count-pill">
                  {tree.today.earned}/{tree.today.max} gotas hoy
                </span>
              </div>
              <div className="drop-grid">
                {tree.today.paths.map((path) => {
                  const meta = PATH_META[path.key];
                  return (
                    <button
                      key={path.key}
                      type="button"
                      className={'drop-card' + (path.earned ? ' done' : '')}
                      onClick={() => router.push(meta.href)}
                    >
                      <span className={'drop-icon ' + meta.color}>
                        <Icon name={path.earned ? 'check' : meta.icon} />
                      </span>
                      <b>{path.label}</b>
                      <small>{path.hint}</small>
                      <em>{path.earned ? 'Gota de hoy obtenida' : 'Puede sumar 1 gota'}</em>
                    </button>
                  );
                })}
              </div>
            </section>

            <div className="card tree-panel stage-card">
              <SectionHead
                icon="trend"
                title="Explora las etapas"
                sub="Puedes verlas sin cambiar tu progreso."
              />
              <ol className="tree-ladder">
                {tree.stages.map((stage, index) => (
                  <li
                    key={stage.key}
                    className={`tree-ladder-step${stage.reached ? ' reached' : ''}${
                      stageIndex === index && tree.stage.reached ? ' current' : ''
                    }`}
                  >
                    <span className="tree-ladder-dot">
                      {stage.reached ? <Icon name="check" /> : index + 1}
                    </span>
                    <b>{stage.label}</b>
                    <small>
                      {stage.drops} {stage.drops === 1 ? 'gota' : 'gotas'}
                    </small>
                  </li>
                ))}
              </ol>
            </div>

            <div className="card tree-panel stage-card">
              <SectionHead
                icon="sparkle"
                title="Lo que representa tu árbol"
                sub="Raíces, ramas, hojas, flores y frutos simbolizan tu recorrido."
              />
              <p className="tree-meaning-copy">
                Las etapas cambian con las gotas que acumulas; no dependen de que otras personas reaccionen a
                tus publicaciones. Tu árbol no compara tu bienestar con el de nadie ni mide qué tan feliz estás.
              </p>
              <div className="tree-parts">
                {PARTS.map((part) => (
                  <div key={part.key} className="tree-part">
                    <span className="tree-part-icon">
                      <Icon name={part.icon} />
                    </span>
                    <div className="tree-part-body">
                      <b>{tree.parts[part.key]}</b>
                      <span>{part.label}</span>
                      <small>{part.hint}</small>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        ) : null}

        {tree && tab === 'garden' ? (
          <section className="card garden49" aria-labelledby="gardenTitle49">
            <div className="chart-head">
              <div>
                <h2 id="gardenTitle49">Mi jardín</h2>
                <p>
                  {tree.cycle.completed} {tree.cycle.completed === 1 ? 'árbol completado' : 'árboles completados'} ·{' '}
                  {tree.totalDrops} gotas acumuladas
                </p>
              </div>
              <button className="secondary" type="button" onClick={() => setCustomizeOpen(true)}>
                Personalizar mi jardín
              </button>
            </div>
            <p>
              Cada árbol completo conserva su lugar. Tu recorrido es privado y continúa a tu ritmo.
            </p>
            <div className="garden-decoration49" aria-label={`Adorno: ${decorationLabel(tree.garden.decoration)}`}>
              {DECORATIONS.find((item) => item.value === tree.garden.decoration)?.symbol ?? ''}
            </div>
            <div className="garden-grid49">
              {visibleGardenTrees.length ? (
                visibleGardenTrees.map((item) => (
                  <article className="garden-tree49" key={item.index}>
                    <TreeArt
                      stage={7}
                      species={item.species}
                      pot={item.pot}
                      className="garden-tree-art"
                    />
                    <b>{item.label}</b>
                    <span>Completado · 300 gotas</span>
                  </article>
                ))
              ) : (
                <div className="empty-state">
                  <p>Tu primer árbol tendrá un lugar aquí al alcanzar 300 gotas.</p>
                  <button className="secondary" type="button" onClick={() => setTab('tree')}>
                    Ver mi árbol
                  </button>
                </div>
              )}
            </div>
            <p className="garden-capacity49">
              Espacio {tree.garden.spaceNumber} · {tree.garden.spaceFilled} de {tree.garden.spaceSize} árboles.{' '}
              {tree.cycle.completed >= 3
                ? 'Tu jardín ya se amplió; cada grupo de tres árboles abre otro espacio.'
                : 'Al completar tres árboles se abre un nuevo espacio.'}
            </p>
            {tree.garden.pages > 1 ? (
              <div className="garden-pagination49">
                <button
                  className="secondary"
                  type="button"
                  onClick={() => setGardenPage((page) => Math.max(0, page - 1))}
                  disabled={gardenPage === 0}
                >
                  Anteriores
                </button>
                <span>
                  Página {gardenPage + 1} de {tree.garden.pages}
                </span>
                <button
                  className="secondary"
                  type="button"
                  onClick={() => setGardenPage((page) => Math.min(tree.garden.pages - 1, page + 1))}
                  disabled={gardenPage === tree.garden.pages - 1}
                >
                  Siguientes
                </button>
              </div>
            ) : null}
          </section>
        ) : null}

        {tree && tab === 'awards' ? (
          <section className="card awards49" aria-labelledby="awardsTitle49">
            <div className="chart-head">
              <div>
                <h2 id="awardsTitle49">Mis logros</h2>
                <p>
                  Reconocimientos de tus momentos de participación. Los días se acumulan aunque no sean consecutivos;
                  todas las emociones cuentan igual.
                </p>
              </div>
              <button className="secondary" type="button" onClick={() => setCustomizeOpen(true)}>
                Elegir mis personalizaciones
              </button>
            </div>
            <div className="award-list49">
              {tree.achievements.map((award) => (
                <article className={`award49${award.unlocked ? ' unlocked' : ''}`} key={award.id}>
                  <span className="award-symbol49" aria-hidden>
                    {award.unlocked ? '✓' : '○'}
                  </span>
                  <div>
                    <h3>{award.title}</h3>
                    <p>{award.detail}</p>
                    <span className="award-status49">
                      {award.unlocked ? 'Conseguido' : `${award.value} de ${award.goal} ${award.unit}`}
                    </span>
                    <progress max={award.goal} value={award.value} aria-label={award.title} />
                  </div>
                </article>
              ))}
            </div>
          </section>
        ) : null}


        {guideOpen ? (
          <div className="modal-layer">
            <GuideModal guide={GUIDES.tree} onClose={() => setGuideOpen(false)} />
          </div>
        ) : null}
      </section>
    </WyFrame>
  );
}
