'use client';

import { useEffect } from 'react';
import { fetchAccount, type ReadingSize } from '@/lib/account';
import { tokenStorage } from '@/lib/auth';

const STORAGE_KEY = 'withyouly-reading-size';
const VALID: ReadingSize[] = ['NORMAL', 'LARGE', 'LARGER'];

function isReadingSize(value: unknown): value is ReadingSize {
  return typeof value === 'string' && VALID.includes(value as ReadingSize);
}

function applyReadingSize(size: ReadingSize) {
  document.documentElement.dataset.readingSize = size;
  try {
    localStorage.setItem(STORAGE_KEY, size);
  } catch {
    /* almacenamiento bloqueado: el atributo sigue aplicándose */
  }
}

/**
 * Aplica el tamaño de lectura elegido en toda la app. Primero usa la copia
 * local (sin parpadeo) y luego confirma con el servidor para mantener la
 * preferencia entre dispositivos.
 */
export default function ReadingSizeSync() {
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (isReadingSize(stored)) {
        document.documentElement.dataset.readingSize = stored;
      }
    } catch {
      /* almacenamiento bloqueado */
    }

    const onReadingSize = (event: Event) => {
      const detail = (event as CustomEvent<unknown>).detail;
      if (isReadingSize(detail)) applyReadingSize(detail);
    };

    const syncFromServer = () => {
      if (!tokenStorage.getAccess()) return;
      void fetchAccount().then((result) => {
        if (result.status === 'ok') {
          const size = result.data.preferences.readingSize;
          if (isReadingSize(size)) applyReadingSize(size);
        }
      });
    };

    const onSessionChanged = () => syncFromServer();

    window.addEventListener('withyouly:reading-size', onReadingSize);
    window.addEventListener('withyouly:session-changed', onSessionChanged);
    syncFromServer();

    return () => {
      window.removeEventListener('withyouly:reading-size', onReadingSize);
      window.removeEventListener('withyouly:session-changed', onSessionChanged);
    };
  }, []);

  return null;
}
