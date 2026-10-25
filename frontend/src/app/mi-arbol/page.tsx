'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { API_URL } from '@/lib/api';
import { authFetch, logout as endSession, tokenStorage } from '@/lib/auth';
import type { CharacterSummary } from '@/components/feed/types';
import WyFrame, { type WyRoute } from '@/components/wy/Shell';
import RightRail from '@/components/wy/RightRail';
import Icon from '@/components/wy/Icon';
import type { IconName } from '@/components/wy/icons';
import { Sheet, type SheetRow } from '@/components/wy/Overlays';
import TreeArt from '@/components/wy/TreeArt';
import { getTree, type TreeView } from '@/lib/tree';

const PARTS: { key: keyof TreeView['parts']; label: string; hint: string; icon: IconName }[] = [
  { key: 'roots', label: 'Raíces', hint: 'Registros emocionales', icon: 'pulse' },
  { key: 'rings', label: 'Anillos', hint: 'Semanas en las que regresaste', icon: 'calendar' },
  { key: 'branches', label: 'Ramas', hint: 'Relatos, reflexiones y cápsulas', icon: 'book' },
  { key: 'leaves', label: 'Hojas', hint: 'Acompañamiento ofrecido', icon: 'heart' },
  { key: 'flowers', label: 'Flores', hint: 'Comentarios marcados «Me ayudó»', icon: 'sparkle' },
  { key: 'fruits', label: 'Frutos', hint: 'Ciclos y cápsulas completados', icon: 'check' },
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

export default function MiArbolPage() {
  const router = useRouter();
  const [character, setCharacter] = useState<CharacterSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [tree, setTree] = useState<TreeView | null>(null);
  const [error, setError] = useState('');

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
        router.push('/explorar');
        break;
      case 'mood':
        router.push('/mi-estado');
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
  const remaining = tree && tree.stage.nextDrops !== null ? Math.max(0, tree.stage.nextDrops - tree.totalDrops) : 0;
  const progressPct = tree ? Math.round(tree.stage.progress * 100) : 0;

  return (
    <WyFrame
      characterInitials={initialsOf(character?.name)}
      avatarUrl={character?.avatarUrl}
      activeRoute="tree"
      onNavigate={navigate}
      onOpenAccount={openAccount}
      toast={toast}
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
        {/* Cabecera */}
        <div className="card tree-hero">
          <div className="tree-hero-copy">
            <span className="privacy-badge">
              <Icon name="lock" /> Tu crecimiento es privado
            </span>
            <h1>Mi árbol</h1>
            <p>Crece cuando te conoces, te cuidas y acompañas. No se marchita ni retrocede: si descansas, solo reposa.</p>
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

        {/* Etapa actual */}
        {tree ? (
          <div className="card tree-stage">
            <div className="tree-stage-visual">
              <TreeArt stage={stageIndex} className="tree-art" />
              <span className="tree-stage-chip">{stageLabel}</span>
            </div>
            <div className="tree-stage-detail">
              <span className="tree-eyebrow">Etapa {stageIndex + 1} de {tree.stages.length}</span>
              <h2>
                {tree.totalDrops} {tree.totalDrops === 1 ? 'gota' : 'gotas'} de crecimiento
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
            </div>
          </div>
        ) : null}

        {/* Hoy */}
        {tree ? (
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
        ) : null}

        {/* Etapas */}
        {tree ? (
          <div className="card tree-panel">
            <SectionHead
              icon="trend"
              title="De semilla a fruto"
              sub="Cada etapa necesita gotas de cuidado, en días distintos."
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
        ) : null}

        {/* Partes del árbol */}
        {tree ? (
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
        ) : null}
      </section>
    </WyFrame>
  );
}
