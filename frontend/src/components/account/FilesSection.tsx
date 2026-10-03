'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { deleteFile, formatBytes, listFiles, uploadFile, type MediaFile } from '@/lib/files';

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
    <section aria-labelledby="archivos-title" className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="archivos-title" className="text-title-lg font-semibold">
          Archivos
        </h2>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="px-space-md py-2 rounded-full bg-primary text-on-primary text-label-md font-medium disabled:opacity-50"
        >
          {uploading ? 'Subiendo…' : 'Subir imagen'}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={(event) => void upload(event)}
          className="sr-only"
          aria-label="Subir imagen"
        />
      </div>

      <p className="text-body-sm text-on-surface-variant">
        Tienes {items.length} {items.length === 1 ? 'archivo' : 'archivos'} en la biblioteca (
        {usage.media} en total). Imágenes JPEG, PNG o WebP; se guardan como WebP.
      </p>

      {status && (
        <p
          role="status"
          className={`text-body-sm ${status.kind === 'ok' ? 'text-on-surface-variant' : 'text-error'}`}
        >
          {status.text}
        </p>
      )}

      {loading && <p className="text-body-md text-on-surface-variant">Cargando tu biblioteca…</p>}

      {!loading && items.length === 0 && !status && (
        <p className="rounded-2xl bg-surface-container-low p-6 text-center text-body-md text-on-surface-variant">
          Todavía no has subido nada.
        </p>
      )}

      <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        {items.map((file) => (
          <li key={file.id} className="rounded-2xl bg-surface-container-low overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={file.fileUrl}
              alt={file.originalName ?? 'Archivo de la biblioteca'}
              loading="lazy"
              className="aspect-square w-full object-cover"
            />
            <div className="p-3 space-y-1">
              <p className="text-body-sm truncate" title={file.originalName ?? undefined}>
                {file.originalName ?? 'Sin nombre'}
              </p>
              <p className="text-body-sm text-on-surface-variant">
                {formatBytes(file.sizeBytes)}
                {file.width && file.height ? ` · ${file.width}×${file.height}` : ''}
              </p>
              {file.entityType !== 'NONE' && (
                <p className="text-[10px] uppercase tracking-wider font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full inline-block">
                  En uso
                </p>
              )}
              <button
                type="button"
                onClick={() => void remove(file.id)}
                disabled={pendingDelete === file.id}
                className="text-label-md font-semibold text-error hover:bg-error-container px-space-md rounded-full transition-colors disabled:opacity-50"
              >
                {pendingDelete === file.id ? 'Borrando…' : 'Borrar'}
              </button>
            </div>
          </li>
        ))}
      </ul>

      {cursor && (
        <button
          type="button"
          onClick={() => void loadMore()}
          disabled={loadingMore}
          className="px-space-md py-2 rounded-full border border-outline-variant text-label-md font-medium hover:bg-surface-container disabled:opacity-50"
        >
          {loadingMore ? 'Cargando…' : 'Ver más'}
        </button>
      )}
    </section>
  );
}
