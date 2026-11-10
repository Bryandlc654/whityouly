/**
 * Recuerda a qué página volver tras iniciar sesión o crear una cuenta, por
 * ejemplo el relato compartido que una persona invitada quería acompañar.
 *
 * Se guarda en localStorage (no en sessionStorage) porque el registro pasa por
 * la verificación del correo, que suele abrirse en otra pestaña. Caduca en un día.
 */
const KEY = 'withyouly-return-to';
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

/** Solo rutas internas: evita redirecciones abiertas a otros dominios. */
function isSafePath(path: string): boolean {
  return path.startsWith('/') && !path.startsWith('//') && !path.startsWith('/\\');
}

export function rememberReturnTo(path: string): void {
  if (!isSafePath(path)) return;
  try {
    localStorage.setItem(KEY, JSON.stringify({ path, at: Date.now() }));
  } catch {
    /* almacenamiento bloqueado: se vuelve al destino por defecto */
  }
}

/** Devuelve la ruta guardada (y la borra) o `fallback` si no hay ninguna válida. */
export function consumeReturnTo(fallback: string): string {
  try {
    const raw = localStorage.getItem(KEY);
    localStorage.removeItem(KEY);
    if (!raw) return fallback;
    const saved = JSON.parse(raw) as { path?: unknown; at?: unknown };
    if (typeof saved.path !== 'string' || !isSafePath(saved.path)) return fallback;
    if (typeof saved.at !== 'number' || Date.now() - saved.at > MAX_AGE_MS) return fallback;
    return saved.path;
  } catch {
    return fallback;
  }
}
