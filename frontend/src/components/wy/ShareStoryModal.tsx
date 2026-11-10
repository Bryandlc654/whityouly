'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Avatar from './Avatar';
import Icon from './Icon';

export interface ShareStoryData {
  id: string;
  title: string;
  text: string;
  author: string;
  initials: string;
  category?: string;
  format?: string;
  externalShare?: boolean;
  guestReadable?: boolean;
}

interface Props {
  story: ShareStoryData;
  onClose: () => void;
  onNotify: (message: string) => void;
}

type CardTemplate = 'violet' | 'hope' | 'calm' | 'dawn' | 'night' | 'custom';
type CardFormat = 'post' | 'story' | 'square';
type CardPattern = 'none' | 'dots' | 'waves' | 'grid' | 'lines' | 'hearts' | 'sparkles';

interface CardColors {
  from: string;
  to: string;
  ink: string;
  soft: string;
}

interface CardOptions {
  colors: CardColors;
  pattern: CardPattern;
  logo: HTMLImageElement | null;
}

const TEMPLATES: Record<CardTemplate, { label: string; from: string; to: string; ink: string; soft: string }> = {
  violet: { label: 'Violeta', from: '#6246f5', to: '#7942cc', ink: '#ffffff', soft: 'rgba(255,255,255,.17)' },
  hope: { label: 'Esperanza', from: '#23704f', to: '#2d7d56', ink: '#ffffff', soft: 'rgba(255,255,255,.18)' },
  calm: { label: 'Calma', from: '#146b78', to: '#187a7b', ink: '#ffffff', soft: 'rgba(255,255,255,.18)' },
  dawn: { label: 'Amanecer', from: '#fff0de', to: '#efb2c4', ink: '#38283f', soft: 'rgba(255,255,255,.4)' },
  night: { label: 'Noche', from: '#171f46', to: '#4d3d87', ink: '#ffffff', soft: 'rgba(255,255,255,.13)' },
  custom: { label: 'Personalizado', from: '#6246f5', to: '#ef7fb0', ink: '#ffffff', soft: 'rgba(255,255,255,.17)' },
};

const PATTERNS: { id: CardPattern; label: string }[] = [
  { id: 'none', label: 'Sin patrón' },
  { id: 'dots', label: 'Puntos' },
  { id: 'waves', label: 'Ondas' },
  { id: 'grid', label: 'Cuadrícula' },
  { id: 'lines', label: 'Líneas' },
  { id: 'hearts', label: 'Corazones' },
  { id: 'sparkles', label: 'Destellos' },
];

/** Luminancia relativa (WCAG) de un color #rrggbb. */
function luminance(hex: string): number {
  const value = hex.replace('#', '');
  const channels = [0, 2, 4].map((index) => parseInt(value.slice(index, index + 2), 16) / 255);
  const [r, g, b] = channels.map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Colores de texto legibles sobre un degradado elegido por la persona. */
function customColors(from: string, to: string): CardColors {
  const light = (luminance(from) + luminance(to)) / 2 > 0.42;
  return {
    from,
    to,
    ink: light ? '#2a2238' : '#ffffff',
    soft: light ? 'rgba(42,34,56,.10)' : 'rgba(255,255,255,.17)',
  };
}

/** Patrón decorativo sobre el fondo, siempre suave para no restar legibilidad. */
function drawPattern(ctx: CanvasRenderingContext2D, pattern: CardPattern, w: number, h: number, ink: string) {
  if (pattern === 'none') return;
  const unit = w / 1080;
  ctx.save();
  ctx.fillStyle = ink;
  ctx.strokeStyle = ink;
  ctx.globalAlpha = 0.11;
  ctx.lineWidth = Math.max(1, 3 * unit);
  ctx.lineCap = 'round';

  if (pattern === 'dots') {
    const step = 54 * unit;
    for (let y = step / 2, row = 0; y < h; y += step, row += 1) {
      for (let x = (row % 2 ? step : step / 2); x < w; x += step) {
        ctx.beginPath();
        ctx.arc(x, y, 5 * unit, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  } else if (pattern === 'waves') {
    const step = 64 * unit;
    const amp = 14 * unit;
    for (let y = step / 2; y < h + step; y += step) {
      ctx.beginPath();
      for (let x = 0; x <= w; x += 8 * unit) {
        const yy = y + Math.sin((x / (150 * unit)) * Math.PI * 2) * amp;
        if (x === 0) ctx.moveTo(x, yy);
        else ctx.lineTo(x, yy);
      }
      ctx.stroke();
    }
  } else if (pattern === 'grid') {
    const step = 72 * unit;
    ctx.lineWidth = Math.max(1, 2 * unit);
    for (let x = step; x < w; x += step) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    for (let y = step; y < h; y += step) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }
  } else if (pattern === 'lines') {
    const step = 46 * unit;
    for (let x = -h; x < w; x += step) {
      ctx.beginPath();
      ctx.moveTo(x, h);
      ctx.lineTo(x + h, 0);
      ctx.stroke();
    }
  } else if (pattern === 'hearts' || pattern === 'sparkles') {
    const step = 120 * unit;
    for (let y = step / 2, row = 0; y < h + step; y += step, row += 1) {
      for (let x = (row % 2 ? step : step / 2); x < w + step; x += step) {
        const r = (pattern === 'hearts' ? 16 : 14) * unit;
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(((row * 7 + Math.round(x)) % 5 - 2) * 0.12);
        ctx.beginPath();
        if (pattern === 'hearts') {
          ctx.moveTo(0, r * 0.9);
          ctx.bezierCurveTo(-r * 1.4, -r * 0.1, -r * 0.7, -r * 1.2, 0, -r * 0.45);
          ctx.bezierCurveTo(r * 0.7, -r * 1.2, r * 1.4, -r * 0.1, 0, r * 0.9);
        } else {
          ctx.moveTo(0, -r);
          ctx.quadraticCurveTo(0, 0, r, 0);
          ctx.quadraticCurveTo(0, 0, 0, r);
          ctx.quadraticCurveTo(0, 0, -r, 0);
          ctx.quadraticCurveTo(0, 0, 0, -r);
        }
        ctx.fill();
        ctx.restore();
      }
    }
  }
  ctx.restore();
}

/**
 * Dibuja el logo. Sobre fondos claros se usan sus colores originales; sobre
 * fondos oscuros se pinta del color del texto para que siempre se lea.
 */
function drawLogo(
  ctx: CanvasRenderingContext2D,
  logo: HTMLImageElement | null,
  x: number,
  y: number,
  height: number,
  colors: CardColors,
) {
  if (!logo || !logo.naturalWidth) {
    ctx.font = `800 ${Math.round(height * 0.62)}px system-ui, sans-serif`;
    ctx.fillStyle = colors.ink;
    ctx.fillText('Withyouly', x, y + height * 0.18);
    return;
  }
  const width = Math.round((logo.naturalWidth / logo.naturalHeight) * height);
  const lightBackground = colors.ink !== '#ffffff';
  if (lightBackground) {
    ctx.drawImage(logo, x, y, width, height);
    return;
  }
  const tinted = document.createElement('canvas');
  tinted.width = width;
  tinted.height = height;
  const tctx = tinted.getContext('2d');
  if (!tctx) return;
  tctx.drawImage(logo, 0, 0, width, height);
  tctx.globalCompositeOperation = 'source-in';
  tctx.fillStyle = colors.ink;
  tctx.fillRect(0, 0, width, height);
  ctx.drawImage(tinted, x, y);
}

const FORMATS: Record<CardFormat, { label: string; size: string; w: number; h: number; ratio: string }> = {
  post: { label: 'Publicación', size: '1080 × 1350', w: 1080, h: 1350, ratio: '4 / 5' },
  story: { label: 'Historia', size: '1080 × 1920', w: 1080, h: 1920, ratio: '9 / 16' },
  square: { label: 'Cuadrado', size: '1080 × 1080', w: 1080, h: 1080, ratio: '1 / 1' },
};

function defaultExcerpt(text: string): string {
  const trimmed = text.trim();
  return trimmed.length > 390 ? `${trimmed.slice(0, 387).trim()}.` : trimmed;
}

function roundedCanvasRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, radius);
  ctx.closePath();
}

function wrappedCanvasLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines: number,
): string[] {
  const lines: string[] = [];
  let line = '';
  let truncated = false;
  const paragraphs = String(text).replace(/\r\n?/g, '\n').split('\n');

  outer: for (let p = 0; p < paragraphs.length; p += 1) {
    for (const word of paragraphs[p].trim().split(/\s+/).filter(Boolean)) {
      if (line && ctx.measureText(`${line} ${word}`).width <= maxWidth) {
        line += ` ${word}`;
        continue;
      }
      if (line) {
        lines.push(line);
        line = '';
        if (lines.length >= maxLines) {
          truncated = true;
          break outer;
        }
      }
      for (const char of Array.from(word)) {
        if (line && ctx.measureText(line + char).width > maxWidth) {
          lines.push(line);
          line = '';
          if (lines.length >= maxLines) {
            truncated = true;
            break outer;
          }
        }
        line += char;
      }
    }
    if (line) {
      lines.push(line);
      line = '';
      if (lines.length >= maxLines) {
        truncated = p < paragraphs.length - 1;
        break;
      }
    }
  }

  if (line && lines.length < maxLines) lines.push(line);
  if (truncated && lines.length) {
    const last = lines[lines.length - 1];
    lines[lines.length - 1] = `${last.slice(0, Math.max(0, last.length - 1)).trimEnd()}…`;
  }
  return lines;
}

function buildCardCanvas(
  story: ShareStoryData,
  options: CardOptions,
  format: CardFormat,
  excerpt: string,
  alias: boolean,
  includeLink: boolean,
  host: string,
  target?: HTMLCanvasElement,
): HTMLCanvasElement {
  const { colors } = options;
  const size = FORMATS[format];
  const canvas = target ?? document.createElement('canvas');
  canvas.width = size.w;
  canvas.height = size.h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  const pad = Math.round(size.w * 0.075);
  const width = size.w - pad * 2;
  const gradient = ctx.createLinearGradient(0, 0, size.w, size.h);
  gradient.addColorStop(0, colors.from);
  gradient.addColorStop(1, colors.to);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size.w, size.h);
  drawPattern(ctx, options.pattern, size.w, size.h, colors.ink);
  ctx.fillStyle = colors.ink;
  ctx.textBaseline = 'top';

  drawLogo(ctx, options.logo, pad - 6, pad - 22, Math.round(size.w * 0.085), colors);
  ctx.fillStyle = colors.ink;

  if (story.category) {
    const category = story.category;
    ctx.font = `700 ${Math.round(size.w * 0.023)}px system-ui, sans-serif`;
    const pillWidth = ctx.measureText(category).width + 40;
    ctx.fillStyle = colors.soft;
    roundedCanvasRect(ctx, size.w - pad - pillWidth, pad - 3, pillWidth, 46, 23);
    ctx.fill();
    ctx.fillStyle = colors.ink;
    ctx.fillText(category, size.w - pad - pillWidth + 20, pad + 8);
  }

  const footerLine = size.h - pad - (includeLink ? 110 : 65);
  const footerText = footerLine + 25;
  const titleSize = Math.round(size.w * 0.052);
  const titleStep = Math.round(titleSize * 1.22);
  const bodySize = Math.round(size.w * 0.036);
  const bodyStep = Math.round(bodySize * 1.58);

  ctx.font = `800 ${titleSize}px system-ui, sans-serif`;
  const titles = wrappedCanvasLines(ctx, story.title, width, 3);
  const contentTop = pad + 110;
  const bodyTop = contentTop + titles.length * titleStep + 30;

  ctx.font = `400 ${bodySize}px system-ui, sans-serif`;
  const maxLines = Math.max(1, Math.floor((footerLine - 35 - bodyTop) / bodyStep));
  const body = wrappedCanvasLines(ctx, excerpt, width, maxLines);
  const spare = Math.max(0, footerLine - 35 - (bodyTop + body.length * bodyStep));
  const offset = spare * 0.5;

  let y = contentTop + offset;
  ctx.font = `800 ${titleSize}px system-ui, sans-serif`;
  titles.forEach((line) => {
    ctx.fillText(line, pad, y);
    y += titleStep;
  });

  y += 30;
  ctx.font = `400 ${bodySize}px system-ui, sans-serif`;
  body.forEach((line) => {
    ctx.fillText(line, pad, y);
    y += bodyStep;
  });

  ctx.globalAlpha = 0.28;
  ctx.fillRect(pad, footerLine, width, 2);
  ctx.globalAlpha = 1;

  ctx.font = `700 ${Math.round(size.w * 0.028)}px system-ui, sans-serif`;
  const author = alias ? story.author : 'Compartido de forma anónima';
  ctx.fillText(wrappedCanvasLines(ctx, author, width, 1)[0] ?? '', pad, footerText);

  if (includeLink) {
    ctx.font = `400 ${Math.round(size.w * 0.023)}px system-ui, sans-serif`;
    ctx.fillText(wrappedCanvasLines(ctx, `Lee el relato completo · ${host}`, width, 1)[0] ?? '', pad, footerText + 48);
  }

  return canvas;
}

function canvasBlob(canvas: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/png', 0.96));
}

async function copyText(value: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    try {
      const field = document.createElement('textarea');
      field.value = value;
      field.setAttribute('readonly', '');
      field.style.position = 'fixed';
      field.style.opacity = '0';
      document.body.appendChild(field);
      field.select();
      const copied = document.execCommand('copy');
      field.remove();
      return copied;
    } catch {
      return false;
    }
  }
}

function downloadBlob(blob: Blob, storyId: string, format: CardFormat) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `withyouly-${storyId.replace(/[^a-z0-9-]/gi, '-')}-${format}.png`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
}

/** Miniatura de un patrón con los colores actuales del fondo. */
function PatternSwatch({ pattern, colors }: { pattern: CardPattern; colors: CardColors }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    gradient.addColorStop(0, colors.from);
    gradient.addColorStop(1, colors.to);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    // Escala ampliada para que el patrón se aprecie en la miniatura.
    drawPattern(ctx, pattern, 400, 400, colors.ink);
  }, [pattern, colors]);
  return <canvas ref={ref} width={120} height={120} aria-hidden />;
}

export default function ShareStoryModal({ story, onClose, onNotify }: Props) {
  const [template, setTemplate] = useState<CardTemplate>('violet');
  const [format, setFormat] = useState<CardFormat>('post');
  const [alias, setAlias] = useState(true);
  const [includeLink, setIncludeLink] = useState(true);
  const [excerpt, setExcerpt] = useState(() => defaultExcerpt(story.text));
  const [link, setLink] = useState('');
  const [busy, setBusy] = useState<'link' | 'copy' | 'download' | 'share' | null>(null);
  const [view, setView] = useState<'options' | 'customize'>('options');
  const [pattern, setPattern] = useState<CardPattern>('none');
  const [customFrom, setCustomFrom] = useState(TEMPLATES.custom.from);
  const [customTo, setCustomTo] = useState(TEMPLATES.custom.to);
  const [logo, setLogo] = useState<HTMLImageElement | null>(null);
  const previewRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const image = new Image();
    image.onload = () => setLogo(image);
    image.src = '/logo.png';
  }, []);

  useEffect(() => {
    setLink(`${window.location.origin}/relato/${encodeURIComponent(story.id)}`);
  }, [story.id]);

  const host = useMemo(() => {
    try {
      return new URL(link).hostname;
    } catch {
      return 'withyouly.app';
    }
  }, [link]);

  const colors: CardColors = useMemo(
    () => (template === 'custom' ? customColors(customFrom, customTo) : TEMPLATES[template]),
    [template, customFrom, customTo],
  );
  const cardOptions: CardOptions = useMemo(() => ({ colors, pattern, logo }), [colors, pattern, logo]);
  const size = FORMATS[format];

  // La vista previa usa el mismo dibujo que la imagen descargada.
  useEffect(() => {
    if (view !== 'customize' || !previewRef.current) return;
    buildCardCanvas(story, cardOptions, format, excerpt, alias, includeLink, host, previewRef.current);
  }, [view, story, cardOptions, format, excerpt, alias, includeLink, host]);

  const copyLink = async () => {
    setBusy('copy');
    const copied = await copyText(link);
    setBusy(null);
    onNotify(copied ? 'Enlace copiado para compartir.' : 'No se pudo copiar el enlace.');
  };

  const shareLink = async () => {
    setBusy('link');
    if (navigator.share) {
      try {
        await navigator.share({
          title: story.title,
          text: `Un relato de ${story.author} en Withyouly`,
          url: link,
        });
        setBusy(null);
        onNotify('Opciones para compartir abiertas.');
        return;
      } catch (error) {
        if ((error as Error)?.name === 'AbortError') {
          setBusy(null);
          return;
        }
      }
    }
    const copied = await copyText(link);
    setBusy(null);
    onNotify(copied ? 'Enlace copiado para compartir.' : 'No se pudo compartir el enlace.');
  };

  const exportCard = async (share: boolean) => {
    setBusy(share ? 'share' : 'download');
    const canvas = buildCardCanvas(story, cardOptions, format, excerpt, alias, includeLink, host);
    const blob = await canvasBlob(canvas);
    if (!blob) {
      setBusy(null);
      onNotify('No pudimos generar la tarjeta.');
      return;
    }

    const file = new File([blob], `withyouly-${story.id}.png`, { type: 'image/png' });
    if (share && navigator.share && navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ title: story.title, text: 'Un relato compartido desde Withyouly', files: [file] });
        setBusy(null);
        onNotify('Tarjeta lista para compartir.');
        return;
      } catch (error) {
        if ((error as Error)?.name === 'AbortError') {
          setBusy(null);
          return;
        }
      }
    }

    downloadBlob(blob, story.id, format);
    setBusy(null);
    onNotify(share ? 'Tu dispositivo descargó la tarjeta para compartirla.' : 'Tarjeta descargada en formato PNG.');
  };

  return (
    <div
      className={`modal ${view === 'options' ? 'share-hub-modal' : 'share-builder-modal'}`}
      role="dialog"
      aria-modal="true"
      aria-label={view === 'options' ? 'Compartir relato' : 'Personalizar imagen para compartir'}
    >
      <div className="modal-head">
        <div>
          <span className="micro-label">
            {view === 'options' ? 'COMPARTIR SIN EXPONER TU IDENTIDAD' : 'IMAGEN PARA COMPARTIR'}
          </span>
          <h2>{view === 'options' ? 'Compartir relato' : 'Personaliza tu imagen'}</h2>
          <p>
            {view === 'options'
              ? 'Compártelo como enlace o como imagen. Tú eliges el formato.'
              : 'Cambia el color, el patrón, el formato y el extracto antes de compartir.'}
          </p>
        </div>
        <button className="close" type="button" onClick={onClose} aria-label="Cerrar">
          <Icon name="x" />
        </button>
      </div>

      {view === 'options' ? (
        <>
          <div className="share-story-context">
            <Avatar initials={story.initials} size="sm" alt={`Avatar de ${story.author}`} />
            <div className="share-story-meta">
              <small>
                {story.category ?? 'Relato'} · {story.format ?? 'Relato escrito'}
              </small>
              <b>{story.title}</b>
              <span>por {story.author}</span>
            </div>
          </div>

          <div className="share-privacy-note">
            <Icon name="shield" />
            <span>
              <b>Revisa el contenido antes de compartir.</b> Un enlace o una imagen pueden circular fuera de
              Withyouly. Nunca añadimos tu correo ni tu nombre real.
            </span>
          </div>

          {story.externalShare === false ? (
            <div className="privacy-share-block">
              <Icon name="lock" />
              Este relato está disponible en la comunidad, pero su autor desactivó la distribución externa.
            </div>
          ) : (
          <div className="share-choice-list">
            <button
              type="button"
              onClick={() => void shareLink()}
              disabled={busy !== null}
              aria-label="Compartir como enlace"
            >
              <Icon name="share" />
              <span>
                <b>{busy === 'link' ? 'Abriendo opciones…' : 'Compartir enlace'}</b>
                <small>Abre WhatsApp, mensajes u otra aplicación compatible.</small>
              </span>
              <Icon name="chevron" />
            </button>

            <button
              className="image-choice"
              type="button"
              onClick={() => void exportCard(true)}
              disabled={busy !== null}
              aria-label="Compartir como imagen"
            >
              <Icon name="image" />
              <span>
                <b>{busy === 'share' ? 'Preparando imagen…' : 'Compartir imagen'}</b>
                <small>Envía directamente la tarjeta visual desde tu dispositivo.</small>
              </span>
              <Icon name="chevron" />
            </button>

            <button
              type="button"
              onClick={() => void exportCard(false)}
              disabled={busy !== null}
              aria-label="Descargar imagen"
            >
              <Icon name="download" />
              <span>
                <b>{busy === 'download' ? 'Generando imagen…' : 'Descargar imagen'}</b>
                <small>Guarda la tarjeta en formato PNG para usarla cuando quieras.</small>
              </span>
              <Icon name="chevron" />
            </button>

            <button
              type="button"
              onClick={() => void copyLink()}
              disabled={busy !== null}
              aria-label="Copiar enlace"
            >
              <Icon name="link" />
              <span>
                <b>{busy === 'copy' ? 'Copiando enlace…' : 'Copiar enlace'}</b>
                <small>Copia el acceso al relato completo.</small>
              </span>
              <Icon name="chevron" />
            </button>

            <button
              className="card-choice"
              type="button"
              onClick={() => setView('customize')}
              disabled={busy !== null}
              aria-label="Personalizar imagen"
            >
              <Icon name="sparkle" />
              <span>
                <b>Personalizar imagen</b>
                <small>Cambia el color, el patrón, el formato y el extracto.</small>
              </span>
              <Icon name="chevron" />
            </button>
          </div>
          )}
        </>
      ) : (
        <>
          <div className="share-story-context">
            <Avatar initials={story.initials} size="sm" alt={`Avatar de ${story.author}`} />
            <div className="share-story-meta">
              <small>
                {story.category ?? 'Relato'} · {story.format ?? 'Relato escrito'}
              </small>
              <b>{story.title}</b>
              <span>por {story.author}</span>
            </div>
          </div>

          <div className="share-builder-layout">
            <section className="share-builder-controls">
              <div className="share-builder-section">
                <h3>1. Elige el fondo</h3>
                <div className="share-template-grid">
                  {(Object.entries(TEMPLATES) as [CardTemplate, (typeof TEMPLATES)[CardTemplate]][]).map(([key, item]) => (
                    <button
                      key={key}
                      className={template === key ? 'selected' : undefined}
                      type="button"
                      aria-pressed={template === key}
                      onClick={() => setTemplate(key)}
                    >
                      <i
                        style={{
                          background:
                            key === 'custom'
                              ? `linear-gradient(135deg, ${customFrom}, ${customTo})`
                              : `linear-gradient(135deg, ${item.from}, ${item.to})`,
                        }}
                      />
                      <span>{item.label}</span>
                    </button>
                  ))}
                </div>
                {template === 'custom' ? (
                  <div className="share-custom-colors">
                    <label>
                      <input type="color" value={customFrom} onChange={(event) => setCustomFrom(event.target.value)} />
                      <span>Color inicial</span>
                    </label>
                    <label>
                      <input type="color" value={customTo} onChange={(event) => setCustomTo(event.target.value)} />
                      <span>Color final</span>
                    </label>
                    <small className="share-builder-hint">El color del texto y del logo se ajusta solo para que se lea bien.</small>
                  </div>
                ) : null}
              </div>

              <div className="share-builder-section">
                <h3>2. Añade un patrón</h3>
                <div className="share-pattern-grid">
                  {PATTERNS.map((item) => (
                    <button
                      key={item.id}
                      className={pattern === item.id ? 'selected' : undefined}
                      type="button"
                      aria-pressed={pattern === item.id}
                      onClick={() => setPattern(item.id)}
                    >
                      <PatternSwatch pattern={item.id} colors={colors} />
                      <span>{item.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="share-builder-section">
                <h3>3. Elige el formato</h3>
                <div className="share-format-grid">
                  {(Object.entries(FORMATS) as [CardFormat, (typeof FORMATS)[CardFormat]][]).map(([key, item]) => (
                    <button
                      key={key}
                      className={format === key ? 'selected' : undefined}
                      type="button"
                      aria-pressed={format === key}
                      onClick={() => setFormat(key)}
                    >
                      <b>{item.label}</b>
                      <small>{item.size}</small>
                    </button>
                  ))}
                </div>
              </div>

              <div className="share-builder-section">
                <label htmlFor="shareExcerpt">
                  <h3>4. Revisa el extracto</h3>
                </label>
                <textarea
                  id="shareExcerpt"
                  value={excerpt}
                  maxLength={500}
                  onChange={(event) => setExcerpt(event.target.value)}
                />
                <small className="share-builder-hint">
                  Evita nombres, lugares o datos que puedan identificarte. Máximo 500 caracteres.
                </small>
              </div>

              <div className="share-toggles">
                <label>
                  <span>
                    <b>Mostrar seudónimo</b>
                    <small>Nunca se muestra el nombre real.</small>
                  </span>
                  <input type="checkbox" checked={alias} onChange={(event) => setAlias(event.target.checked)} />
                </label>
                <label>
                  <span>
                    <b>Invitar a leer el relato completo</b>
                    <small>Incluye el enlace en la tarjeta.</small>
                  </span>
                  <input
                    type="checkbox"
                    checked={includeLink}
                    onChange={(event) => setIncludeLink(event.target.checked)}
                  />
                </label>
              </div>
            </section>

            <section className="share-preview-pane">
              <div className="share-preview-label">
                <span>Vista previa</span>
                <small>{size.size}px</small>
              </div>
              <canvas
                ref={previewRef}
                className="share-card-canvas"
                style={{ aspectRatio: size.ratio }}
                role="img"
                aria-label={`Vista previa de la imagen: ${story.title}`}
              />
            </section>
          </div>

          <div className="share-export-note">
            <Icon name="lock" />
            La imagen contiene solo el logo, el extracto, la categoría y el seudónimo que ves arriba. Mi diario, las
            cápsulas y los borradores no se comparten desde aquí.
          </div>

          <div className="modal-actions share-builder-actions">
            <button className="ghost" type="button" onClick={() => setView('options')} disabled={busy !== null}>
              <Icon name="chevron" /> Volver
            </button>
            <button className="secondary" type="button" onClick={() => void exportCard(false)} disabled={busy !== null}>
              <Icon name="download" /> {busy === 'download' ? 'Generando…' : 'Descargar imagen'}
            </button>
            <button className="primary" type="button" onClick={() => void exportCard(true)} disabled={busy !== null}>
              <Icon name="image" /> {busy === 'share' ? 'Preparando…' : 'Compartir imagen'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
