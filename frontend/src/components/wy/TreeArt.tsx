'use client';

import { useId } from 'react';

export type TreeSpecies = 'bonsai' | 'jacaranda' | 'olive' | 'cherry';
export type TreePot = 'violet' | 'terracotta' | 'ivory';

interface TreeArtProps {
  /** Indice de etapa 0..7 (Semilla..Frutos). */
  stage: number;
  className?: string;
  species?: TreeSpecies;
  pot?: TreePot;
}

const SPECIES_COLORS: Record<TreeSpecies, { leaf: string; light: string; label: string }> = {
  bonsai: { leaf: '#4f9d63', light: '#7cc98a', label: 'Bonsái' },
  jacaranda: { leaf: '#7157b6', light: '#a899e7', label: 'Jacaranda' },
  olive: { leaf: '#657a48', light: '#b1c48d', label: 'Olivo' },
  cherry: { leaf: '#c67d9e', light: '#f6b5cb', label: 'Cerezo' },
};

const POT_COLORS: Record<TreePot, { body: string; rim: string; stroke: string; label: string }> = {
  violet: { body: '#7250df', rim: '#8c6cf0', stroke: '#3d277c', label: 'Morada' },
  terracotta: { body: '#b46c47', rim: '#dda17b', stroke: '#75452e', label: 'Terracota' },
  ivory: { body: '#c9b79a', rim: '#f4ead5', stroke: '#796b56', label: 'Marfil' },
};

/**
 * Bonsai procedural: la silueta cambia con la etapa (0 = semilla, 7 = frutos).
 * Especie y maceta son personalizables; los ids de gradiente son unicos para
 * poder mostrar varios arboles en el jardin sin colisiones.
 */
export default function TreeArt({
  stage,
  className,
  species = 'bonsai',
  pot = 'violet',
}: TreeArtProps) {
  const s = Math.max(0, Math.min(7, Math.round(stage)));
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const groundId = `tree-ground-${uid}`;
  const trunkId = `tree-trunk-${uid}`;
  const leafId = `tree-leaf-${uid}`;
  const colors = SPECIES_COLORS[species];
  const potColors = POT_COLORS[pot];

  const baseY = 196;
  const trunkHeight = s === 0 ? 0 : 26 + s * 15;
  const trunkWidth = 3 + s * 1.5;
  const topY = baseY - trunkHeight;

  const showTrunk = s >= 1;
  const showBranches = s >= 2;
  const canopyCount = Math.max(0, Math.min(7, s - 1));
  const showFlowers = s >= 6;
  const showFruits = s >= 7;

  const canopy: { cx: number; cy: number; r: number }[] = [];
  if (canopyCount > 0) {
    const spread = 12 + s * 3;
    const capTop = topY - 6 - Math.min(20, canopyCount * 3);
    canopy.push({ cx: 120, cy: capTop, r: 20 + canopyCount * 2.2 });
    if (canopyCount >= 2) canopy.push({ cx: 120 - spread, cy: capTop + 12, r: 16 + canopyCount * 1.6 });
    if (canopyCount >= 3) canopy.push({ cx: 120 + spread, cy: capTop + 12, r: 16 + canopyCount * 1.6 });
    if (canopyCount >= 4) canopy.push({ cx: 120 - spread * 0.7, cy: capTop - 12, r: 13 + canopyCount * 1.2 });
    if (canopyCount >= 5) canopy.push({ cx: 120 + spread * 0.7, cy: capTop - 12, r: 13 + canopyCount * 1.2 });
    if (canopyCount >= 6) canopy.push({ cx: 120 - spread * 1.25, cy: capTop + 4, r: 11 + canopyCount });
    if (canopyCount >= 7) canopy.push({ cx: 120 + spread * 1.25, cy: capTop + 4, r: 11 + canopyCount });
  }

  const branches = showBranches
    ? [
        { x1: 120, y1: topY + trunkHeight * 0.35, x2: 120 - (24 + s * 4), y2: topY + trunkHeight * 0.12 },
        { x1: 120, y1: topY + trunkHeight * 0.5, x2: 120 + (24 + s * 4), y2: topY + trunkHeight * 0.25 },
      ]
    : [];

  const flowers = showFlowers
    ? [
        { cx: 120 - 22, cy: topY - 8, r: 3.4 },
        { cx: 120 + 20, cy: topY + 2, r: 3 },
        { cx: 120, cy: topY - 22, r: 3.2 },
        { cx: 120 - 6, cy: topY + 14, r: 2.8 },
      ]
    : [];

  const fruits = showFruits
    ? [
        { cx: 120 + 14, cy: topY - 4 },
        { cx: 120 - 16, cy: topY + 10 },
        { cx: 120 + 2, cy: topY + 22 },
      ]
    : [];

  return (
    <svg
      className={`${className ?? ''} species-${species} pot-${pot}`.trim()}
      viewBox="0 0 240 240"
      role="img"
      aria-label={`${colors.label} en maceta ${potColors.label}, etapa ${s + 1} de 8`}
    >
      <defs>
        <linearGradient id={groundId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#efe9dd" />
          <stop offset="100%" stopColor="#e2d8c5" />
        </linearGradient>
        <linearGradient id={trunkId} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#8a5a37" />
          <stop offset="100%" stopColor="#6f4527" />
        </linearGradient>
        <radialGradient id={leafId} cx="40%" cy="35%" r="70%">
          <stop offset="0%" stopColor={colors.light} />
          <stop offset="100%" stopColor={colors.leaf} />
        </radialGradient>
      </defs>

      <ellipse cx="120" cy={baseY + 12} rx="64" ry="12" fill={`url(#${groundId})`} />
      <ellipse cx="120" cy={baseY + 8} rx="40" ry="7" fill="#d9cdb6" opacity="0.7" />

      {showTrunk ? (
        <path
          d={`M ${120 - trunkWidth} ${baseY}
              C ${120 - trunkWidth * 0.6} ${baseY - trunkHeight * 0.5},
                ${120 - trunkWidth * 0.5} ${topY + trunkHeight * 0.4}, 120 ${topY}
              C ${120 + trunkWidth * 0.5} ${topY + trunkHeight * 0.4},
                ${120 + trunkWidth * 0.6} ${baseY - trunkHeight * 0.5}, ${120 + trunkWidth} ${baseY} Z`}
          fill={`url(#${trunkId})`}
        />
      ) : null}

      {branches.map((b, index) => (
        <path
          key={index}
          d={`M 120 ${b.y1} Q ${(120 + b.x2) / 2} ${b.y2 - 8} ${b.x2} ${b.y2}`}
          stroke="#6f4527"
          strokeWidth={Math.max(1.6, trunkWidth * 0.5)}
          fill="none"
          strokeLinecap="round"
        />
      ))}

      {canopy.map((leaf, index) => (
        <circle key={index} cx={leaf.cx} cy={leaf.cy} r={leaf.r} fill={`url(#${leafId})`} opacity={0.96} />
      ))}

      {s >= 1 && canopyCount === 0 ? (
        <>
          <ellipse cx={120 - 8} cy={topY + 4} rx="9" ry="5.5" fill={colors.leaf} transform="rotate(-28 112 208)" />
          <ellipse cx={120 + 8} cy={topY + 4} rx="9" ry="5.5" fill={colors.light} transform="rotate(28 128 208)" />
        </>
      ) : null}

      {s === 0 ? (
        <ellipse cx="120" cy={baseY - 2} rx="7" ry="9" fill="#b98a55" stroke="#8a5a37" strokeWidth="1.5" />
      ) : null}

      {flowers.map((f, index) => (
        <g key={`f-${index}`}>
          <circle cx={f.cx} cy={f.cy} r={f.r} fill={species === 'cherry' ? '#f6b5cb' : '#f6a8c9'} />
          <circle cx={f.cx} cy={f.cy} r={f.r * 0.4} fill="#fff1f6" />
        </g>
      ))}

      {fruits.map((fr, index) => (
        <circle key={`fruit-${index}`} cx={fr.cx} cy={fr.cy} r="4.6" fill="#e8604c" stroke="#c94a38" strokeWidth="1" />
      ))}

      <path
        d="M 82 202 L 158 202 L 148 230 L 92 230 Z"
        fill={potColors.body}
        stroke={potColors.stroke}
        strokeWidth="2"
      />
      <ellipse cx="120" cy="202" rx="38" ry="8" fill={potColors.rim} stroke={potColors.stroke} strokeWidth="2" />
    </svg>
  );
}
