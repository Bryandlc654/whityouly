'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { deleteFile, formatBytes, listFiles, uploadFile, type MediaFile } from '@/lib/files';
import Icon from '@/components/wy/Icon';

type Status = { kind: 'ok' | 'error'; text: string } | null;

export default function FilesSection({ usage }: { usage: { characters: number; media: number } }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<MediaFile[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [status, setStatus] = useState<Status>(null);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const result = await listFiles();

    if (result.status === 'ok') {
      setItems(result.data.items);
      setCursor(result.data.nextCursor);
      setStatus(null);
    } else {
      setStatus({ kind: 'error', text: result.message });
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function loadMore() {
    if (!cursor) return;
    setLoadingMore(true);
    const result = await listFiles(cursor);

    if (result.status === 'ok') {
      setItems((prev) => [...prev, ...result.data.items]);
      setCursor(result.data.nextCursor);
    } else {
      setStatus({ kind: 'error', text: result.message });
    }

    setLoadingMore(false);
  }

  async function upload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    // Se limpia el input para poder volver a elegir el mismo archivo después.
    event.target.value = '';
    if (!file) return;

    setUploading(true);
    setStatus(null);

    const result = await uploadFile(file);
    setUploading(false);

    if (result.status === 'ok') {
      setItems((prev) => [result.data, ...prev]);
      setStatus({ kind: 'ok', text: 'Archivo subido.' });
      return;
    }

    setStatus({ kind: 'error', text: result.message });
  }

  async function remove(id: string) {
    setPendingDelete(id);
    setStatus(null);

    const result = await deleteFile(id);
    setPendingDelete(null);

    if (result.status === 'ok') {
      setItems((prev) => prev.filter((item) => item.id !== id));
      setStatus({ kind: 'ok', text: 'Archivo borrado.' });
      return;
    }

    setStatus({ kind: 'error', text: result.message });
  }

  return (
    <section aria-labelledby="archivos-title" className="card pad stack">
      <div className="row-between">
        <h2 id="archivos-title" className="h-section" style={{ margin: 0 }}>
          Archivos
        </h2>
        <button
          type="button"
          className="primary"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
        >
          {uploading ? 'Subiendo…' : 'Subir imagen'}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={(event) => void upload(event)}
          className="hidden"
          aria-label="Subir imagen"
        />
      </div>

      <p className="hint" style={{ margin: 0 }}>
        Tienes {items.length} {items.length === 1 ? 'archivo' : 'archivos'} en la biblioteca ({' '}
        {usage.media} en total). Imágenes JPEG, PNG o WebP; se guardan como WebP.
      </p>

      {status ? (
        <p
          role="status"
          className={status.kind === 'ok' ? 'auth-success' : 'auth-error'}
          style={{ margin: 0 }}
        >
          {status.text}
        </p>
      ) : null}

      {loading ? <p className="hint">Cargando tu biblioteca…</p> : null}

      {!loading && items.length === 0 && !status ? (
        <div className="empty card">
          <div className="empty-icon">
            <Icon name="book" />
          </div>
          <h2>Todavía no has subido nada</h2>
          <p>Tu biblioteca guarda las imágenes que uses en tus relatos.</p>
        </div>
      ) : null}

      <ul className="file-grid" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
        {items.map((file) => (
          <li key={file.id} className="file-tile">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={file.fileUrl}
              alt={file.originalName ?? 'Archivo de la biblioteca'}
              loading="lazy"
            />
            <div className="file-meta">
              <span className="name" title={file.originalName ?? undefined}>
                {file.originalName ?? 'Sin nombre'}
              </span>
              <span className="sz">
                {formatBytes(file.sizeBytes)}
                {file.width && file.height ? ` · ${file.width}×${file.height}` : ''}
              </span>
              {file.entityType !== 'NONE' ? <span className="badge-use">En uso</span> : null}
              <button
                type="button"
                className="link-danger"
                onClick={() => void remove(file.id)}
                disabled={pendingDelete === file.id}
              >
                {pendingDelete === file.id ? 'Borrando…' : 'Borrar'}
              </button>
            </div>
          </li>
        ))}
      </ul>

      {cursor ? (
        <div>
          <button
            type="button"
            className="btn-outline"
            onClick={() => void loadMore()}
            disabled={loadingMore}
          >
            {loadingMore ? 'Cargando…' : 'Ver más'}
          </button>
        </div>
      ) : null}
    </section>
  );
}
