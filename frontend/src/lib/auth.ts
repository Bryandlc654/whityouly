import { API_URL } from './api';

/** Evento global para que la app cierre la sesión de forma coordinada. */
export const SESSION_EXPIRED_EVENT = 'withyouly:session-expired';

/** Caché de rol por pestaña: evita repetir /users/me solo para pintar el acceso. */
export const ROLE_CACHE_KEY = 'withyouly-role';
export const SESSION_CHANGED_EVENT = 'withyouly:session-changed';

/**
 * El access token vive solo en memoria. No se persiste en localStorage: un XSS
 * no puede leerlo de forma persistente y, al recargar, se recupera con la
 * cookie httpOnly de refresco. El refresh token sigue siendo inaccesible a JS.
 */
let accessToken: string | null = null;

export const tokenStorage = {
  getAccess(): string | null {
    return accessToken;
  },
  setAccess(next: string): void {
    accessToken = next;
    bootstrapPromise = null;
  },
  clear(): void {
    accessToken = null;
    bootstrapPromise = null;
    try {
      sessionStorage.removeItem(ROLE_CACHE_KEY);
    } catch {
      /* almacenamiento bloqueado */
    }
  },
};

let refreshInFlight: Promise<boolean> | null = null;
/**
 * Recuperación inicial de la sesión. Se comparte entre peticiones y páginas para
 * que una carga privada no envíe peticiones sin token (y provoque 401 en
 * cascada) antes de que termine el primer refresco.
 */
let bootstrapPromise: Promise<boolean> | null = null;

async function refreshAccessToken(): Promise<boolean> {
  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      try {
        const res = await fetch(`${API_URL}/auth/refresh`, {
          method: 'POST',
          credentials: 'include',
        });

        if (!res.ok) return false;

        const data = await res.json();
        tokenStorage.setAccess(data.accessToken);
        return true;
      } catch {
        return false;
      } finally {
        refreshInFlight = null;
      }
    })();
  }

  return refreshInFlight;
}

/**
 * Garantiza que hay un access token en memoria, recuperándolo con la cookie de
 * refresco si la pestaña se acaba de cargar. Devuelve null para invitados.
 */
export async function ensureAccessToken(): Promise<string | null> {
  if (tokenStorage.getAccess()) {
    return tokenStorage.getAccess();
  }
  const refreshed = await bootstrapSession();
  return refreshed ? tokenStorage.getAccess() : null;
}

async function bootstrapSession(): Promise<boolean> {
  if (tokenStorage.getAccess()) return true;
  if (!bootstrapPromise) {
    bootstrapPromise = refreshAccessToken().then((ok) => {
      // Un fallo no se memoriza: si la sesión se abre en otra pestaña, la
      // siguiente petición puede recuperarla.
      if (!ok) bootstrapPromise = null;
      return ok;
    });
  }
  return bootstrapPromise;
}

/**
 * fetch autenticado: adjunta el access token y, ante un 401, intenta
 * renovarlo con la cookie de refresco (rotación) y reintenta una vez.
 */
export async function authFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const buildInit = (token: string | null): RequestInit => ({
    ...init,
    credentials: 'include',
    headers: {
      ...(init.headers ?? {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  // Recupera la sesión antes de la primera petición: evita enviar peticiones
  // sin token al cargar una página privada y el 401 en cascada que generaban.
  await bootstrapSession();

  const response = await fetch(input, buildInit(tokenStorage.getAccess()));

  if (response.status !== 401) {
    return response;
  }

  // Sin token en memoria no hay nada que renovar: la cookie de sesión no era
  // válida (invitado o sesión cerrada).
  if (!tokenStorage.getAccess()) {
    tokenStorage.clear();
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
    }
    return response;
  }

  const refreshed = await refreshAccessToken();
  if (!refreshed) {
    tokenStorage.clear();
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
    }
    return response;
  }

  return fetch(input, buildInit(tokenStorage.getAccess()));
}

export async function logout(allSessions = false): Promise<void> {
  try {
    if (allSessions) {
      await authFetch(`${API_URL}/auth/logout-all`, { method: 'POST' });
    } else {
      await fetch(`${API_URL}/auth/logout`, { method: 'POST', credentials: 'include' });
    }
  } catch {
    // Ignoramos fallos de red al cerrar sesión: igualmente limpiamos el cliente.
  } finally {
    tokenStorage.clear();
  }
}
