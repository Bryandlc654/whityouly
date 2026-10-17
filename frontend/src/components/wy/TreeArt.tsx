'use client';

interface TreeArtProps {
  /** Índice de etapa 0..7 (Semilla..Frutos). */
  stage: number;
  className?: string;
}

/**
 * Bonsái procedural: la silueta cambia con la etapa (0 = semilla, 7 = frutos).
 * No usa imágenes: cada parte se dibuja con formas para que el crecimiento se
 * sienta vivo y no dependa de recursos externos.
 */
export default function TreeArt({ stage, className }: TreeArtProps) {
  const s = Math.max(0, Math.min(7, Math.round(stage)));

  const baseY = 196;
  const trunkHeight = s === 0 ? 0 : 26 + s * 15;
  const trunkWidth = 3 + s * 1.5;
  const topY = baseY - trunkHeight;

  const showTrunk = s >= 1;
  const showBranches = s >= 2;
  const canopyCount = Math.max(0, Math.min(7, s - 1));
  const showFlowers = s >= 6;
  const showFruits = s >= 7;
  const leafGreen = '#4f9d63';
  const leafLight = '#7cc98a';

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
      className={className}
      viewBox="0 0 240 240"
      role="img"
      aria-label={`Árbol en etapa ${s + 1} de 8`}
    >
      <defs>
        <linearGradient id="tree-ground" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#efe9dd" />
          <stop offset="100%" stopColor="#e2d8c5" />
        </linearGradient>
        <linearGradient id="tree-trunk" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#8a5a37" />
          <stop offset="100%" stopColor="#6f4527" />
        </linearGradient>
        <radialGradient id="tree-leaf" cx="40%" cy="35%" r="70%">
          <stop offset="0%" stopColor={leafLight} />
          <stop offset="100%" stopColor={leafGreen} />
        </radialGradient>
      </defs>

      {/* Suelo / maceta */}
      <ellipse cx="120" cy={baseY + 12} rx="64" ry="12" fill="url(#tree-ground)" />
      <ellipse cx="120" cy={baseY + 8} rx="40" ry="7" fill="#d9cdb6" opacity="0.7" />

      {/* Tronco */}
      {showTrunk ? (
        <path
          d={`M ${120 - trunkWidth} ${baseY}
              C ${120 - trunkWidth * 0.6} ${baseY - trunkHeight * 0.5},
                ${120 - trunkWidth * 0.5} ${topY + trunkHeight * 0.4}, 120 ${topY}
              C ${120 + trunkWidth * 0.5} ${topY + trunkHeight * 0.4},
                ${120 + trunkWidth * 0.6} ${baseY - trunkHeight * 0.5}, ${120 + trunkWidth} ${baseY} Z`}
          fill="url(#tree-trunk)"
        />
      ) : null}

      {/* Ramas */}
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

      {/* Follaje */}
      {canopy.map((leaf, index) => (
        <circle
          key={index}
          cx={leaf.cx}
          cy={leaf.cy}
          r={leaf.r}
          fill="url(#tree-leaf)"
          opacity={0.96}
        />
      ))}

      {/* Brote inicial (etapa Semilla/Brote) */}
      {s >= 1 && canopyCount === 0 ? (
        <>
          <ellipse cx={120 - 8} cy={topY + 4} rx="9" ry="5.5" fill={leafGreen} transform="rotate(-28 112 208)" />
          <ellipse cx={120 + 8} cy={topY + 4} rx="9" ry="5.5" fill={leafLight} transform="rotate(28 128 208)" />
        </>
      ) : null}

      {/* Semilla (etapa 0) */}
      {s === 0 ? (
        <ellipse cx="120" cy={baseY - 2} rx="7" ry="9" fill="#b98a55" stroke="#8a5a37" strokeWidth="1.5" />
      ) : null}

      {/* Flores */}
      {flowers.map((f, index) => (
        <g key={`f-${index}`}>
          <circle cx={f.cx} cy={f.cy} r={f.r} fill="#f6a8c9" />
          <circle cx={f.cx} cy={f.cy} r={f.r * 0.4} fill="#fff1f6" />
        </g>
      ))}

      {/* Frutos */}
      {fruits.map((fr, index) => (
        <circle key={`fruit-${index}`} cx={fr.cx} cy={fr.cy} r="4.6" fill="#e8604c" stroke="#c94a38" strokeWidth="1" />
      ))}
    </svg>
  );
}
