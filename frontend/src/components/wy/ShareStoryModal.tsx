'use client';

import { useEffect, useMemo, useState } from 'react';
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
}

interface Props {
  story: ShareStoryData;
  onClose: () => void;
  onNotify: (message: string) => void;
}

type CardTemplate = 'violet' | 'hope' | 'calm' | 'dawn';
type CardFormat = 'post' | 'story' | 'square';

const TEMPLATES: Record<CardTemplate, { label: string; from: string; to: string; ink: string; soft: string }> = {
  violet: { label: 'Violeta', from: '#6246f5', to: '#7942cc', ink: '#ffffff', soft: 'rgba(255,255,255,.17)' },
  hope: { label: 'Esperanza', from: '#23704f', to: '#2d7d56', ink: '#ffffff', soft: 'rgba(255,255,255,.18)' },
  calm: { label: 'Calma', from: '#146b78', to: '#187a7b', ink: '#ffffff', soft: 'rgba(255,255,255,.18)' },
  dawn: { label: 'Amanecer', from: '#fff0de', to: '#efb2c4', ink: '#38283f', soft: 'rgba(255,255,255,.4)' },
};

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
  template: CardTemplate,
  format: CardFormat,
  excerpt: string,
  alias: boolean,
  includeLink: boolean,
  host: string,
): HTMLCanvasElement {
  const colors = TEMPLATES[template];
  const size = FORMATS[format];
  const canvas = document.createElement('canvas');
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
  ctx.fillStyle = colors.ink;
  ctx.textBaseline = 'top';

  ctx.font = `800 ${Math.round(size.w * 0.035)}px system-ui, sans-serif`;
  ctx.fillText('Withyouly', pad, pad);

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

export default function ShareStoryModal({ story, onClose, onNotify }: Props) {
  const [template, setTemplate] = useState<CardTemplate>('violet');
  const [format, setFormat] = useState<CardFormat>('post');
  const [alias, setAlias] = useState(true);
  const [includeLink, setIncludeLink] = useState(true);
  const [excerpt, setExcerpt] = useState(() => defaultExcerpt(story.text));
  const [link, setLink] = useState('');
  const [busy, setBusy] = useState<'link' | 'copy' | 'download' | 'share' | null>(null);
  const [view, setView] = useState<'options' | 'customize'>('options');

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

  const colors = TEMPLATES[template];
  const size = FORMATS[format];

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
    const canvas = buildCardCanvas(story, template, format, excerpt, alias, includeLink, host);
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
              : 'Cambia el color, formato y extracto antes de compartir.'}
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
                <small>Cambia el color, formato y extracto antes de compartir.</small>
              </span>
              <Icon name="chevron" />
            </button>
          </div>
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
                <h3>1. Elige un estilo</h3>
                <div className="share-template-grid">
                  {(Object.entries(TEMPLATES) as [CardTemplate, (typeof TEMPLATES)[CardTemplate]][]).map(([key, item]) => (
                    <button
                      key={key}
                      className={template === key ? 'selected' : undefined}
                      type="button"
                      aria-pressed={template === key}
                      onClick={() => setTemplate(key)}
                    >
                      <i style={{ background: `linear-gradient(135deg, ${item.from}, ${item.to})` }} />
                      <span>{item.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="share-builder-section">
                <h3>2. Elige el formato</h3>
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
                  <h3>3. Revisa el extracto</h3>
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
              <article
                className="share-card-preview"
                style={{
                  background: `linear-gradient(135deg, ${colors.from}, ${colors.to})`,
                  color: colors.ink,
                  aspectRatio: size.ratio,
                }}
              >
                <div className="share-card-top">
                  <b>Withyouly</b>
                  {story.category ? <span style={{ background: colors.soft }}>{story.category}</span> : null}
                </div>
                <div className="share-card-body">
                  <h3>{story.title}</h3>
                  <p>{excerpt}</p>
                </div>
                <div className="share-card-footer">
                  <b>{alias ? story.author : 'Compartido de forma anónima'}</b>
                  {includeLink ? (
                    <small>
                      Lee el relato completo
                      <br />
                      {host}
                    </small>
                  ) : null}
                </div>
              </article>
            </section>
          </div>

          <div className="share-export-note">
            <Icon name="lock" />
            La imagen contiene solo el extracto, la categoría y el seudónimo que ves arriba. Mi diario, las
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
