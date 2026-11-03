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
import type { IconName } from '@/components/wy/icons';
import { Sheet, type SheetRow } from '@/components/wy/Overlays';
import TreeArt, { type TreePot, type TreeSpecies } from '@/components/wy/TreeArt';
import {
  getTree,
  updateTreeCustomization,
  type TreeDecoration,
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
        router.push('/soporte');
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
        <div className="card tree-hero">
          <div className="tree-hero-copy">
            <span className="privacy-badge">
              <Icon name="lock" /> Tu crecimiento es privado
            </span>
            <h1>Mi árbol</h1>
            <p>
              Crece cuando te conoces, te cuidas y acompañas. Cada 300 gotas completa un árbol y conserva su lugar en
              tu jardín.
            </p>
          </div>
          {tree ? (
            <div className="tree-hero-today" aria-label={`${tree.today.earned} de ${tree.today.max} gotas hoy`}>
              <span className="tree-hero-dots" aria-hidden>
                {tree.today.paths.map((path) => (
                  <i key={path.key} className={path.earned ? 'on' : undefined} />
                ))}
              </span>
              <b>
                {tree.today.earned}/{tree.today.max}
              </b>
              <small>gotas hoy</small>
            </div>
          ) : null}
        </div>

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
                <span className="tree-stage-chip">{stageLabel}</span>
              </div>
              <div className="tree-stage-detail">
                <span className="tree-eyebrow">
                  Etapa {stageIndex + 1} de {tree.stages.length}
                </span>
                <p className="tree-counter49">
                  Árbol {tree.cycle.number} · {tree.cycle.completed} completado{tree.cycle.completed === 1 ? '' : 's'} ·{' '}
                  {speciesLabel(tree.customization.species)}
                </p>
                <h2>
                  {cycleDrops} de {tree.cycle.goal} gotas en este árbol
                </h2>
                <div className="tree-progress" aria-hidden>
                  <i style={{ width: `${progressPct}%` }} />
                </div>
                <div className="tree-progress-meta">
                  <span className="muted small">{stageLabel}</span>
                  <span className="muted small">{tree.stage.nextLabel ?? 'Forma plena'}</span>
                </div>
                <p className="muted small">
                  {tree.stage.nextLabel
                    ? `A ${remaining} ${remaining === 1 ? 'gota' : 'gotas'} de ${tree.stage.nextLabel}.`
                    : 'Tu árbol ha llegado a su forma más plena.'}
                </p>
                <p className="tree-total49">
                  {cycleDrops} de 300 gotas en este árbol · {tree.totalDrops} en total
                </p>
                <button className="secondary" type="button" onClick={() => setCustomizeOpen(true)}>
                  Personalizar mi árbol
                </button>
              </div>
            </div>

            <div className="card tree-panel">
              <SectionHead
                icon="plus"
                title="Hoy"
                sub="Tres caminos para crecer. Máximo una gota por cada uno al día."
                right={
                  tree.today.complete ? (
                    <span className="tag hope">
                      <Icon name="check" /> Camino completo
                    </span>
                  ) : (
                    <span className="tree-count-pill">
                      {tree.today.earned}/{tree.today.max} gotas
                    </span>
                  )
                }
              />
              <div className="tree-paths">
                {tree.today.paths.map((path) => (
                  <div key={path.key} className={`tree-path${path.earned ? ' on' : ''}`}>
                    <span className="tree-path-icon">
                      <Icon name={path.earned ? 'check' : 'plus'} />
                    </span>
                    <div className="tree-path-text">
                      <b>{path.label}</b>
                      <small>{path.hint}</small>
                    </div>
                    <span className="tree-path-state">{path.earned ? 'Gota obtenida' : 'Obtener 1 gota'}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="card tree-panel">
              <SectionHead
                icon="trend"
                title="De semilla a fruto"
                sub="Cada etapa necesita gotas de cuidado dentro de este árbol."
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

            <div className="card tree-panel">
              <SectionHead
                icon="sparkle"
                title="Lo que cuenta tu árbol"
                sub="Partes que crecen con tu cuidado y tu acompañamiento."
              />
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
      </section>
    </WyFrame>
  );
}
