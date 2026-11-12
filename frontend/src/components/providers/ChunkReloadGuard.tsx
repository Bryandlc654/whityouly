'use client';

import { useEffect } from 'react';

const RELOAD_KEY = 'withyouly-chunk-reload-at';
/** Evita bucles: como mucho una recarga automática por minuto. */
const MIN_INTERVAL_MS = 60_000;

function isChunkError(value: unknown): boolean {
  if (!value) return false;
  const name = (value as { name?: string }).name ?? '';
  const message = (value as { message?: string }).message ?? String(value);
  return name === 'ChunkLoadError' || /Loading (CSS )?chunk [\w-]+ failed/i.test(message);
}

/**
 * Si la página quedó abierta durante un despliegue, puede pedir un archivo de
 * la versión anterior que ya no existe (ChunkLoadError). En ese caso se recarga
 * una vez para traer la versión nueva en lugar de dejar la pantalla rota.
 */
export default function ChunkReloadGuard() {
  useEffect(() => {
    const reload = (reason: unknown) => {
      if (!isChunkError(reason)) return;
      let last = 0;
      try {
        last = Number(window.sessionStorage.getItem(RELOAD_KEY) ?? 0);
        if (Date.now() - last < MIN_INTERVAL_MS) return;
        window.sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
      } catch {
        // Sin sessionStorage se recarga igual; el navegador corta bucles evidentes.
      }
      window.location.reload();
    };
    const onError = (event: ErrorEvent) => reload(event.error ?? event.message);
    const onRejection = (event: PromiseRejectionEvent) => reload(event.reason);
    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', onRejection);
    return () => {
      window.removeEventListener('error', onError);
      window.removeEventListener('unhandledrejection', onRejection);
    };
  }, []);

  return null;
}
