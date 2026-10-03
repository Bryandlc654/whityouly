import { API_URL } from './api';

const ACCESS_TOKEN_KEY = 'accessToken';

/**
 * El access token (de vida corta) se guarda en el navegador para adjuntarlo a
 * las peticiones. El refresh token (de vida larga) vive en una cookie httpOnly
 * emitida por el backend, por lo que no es accesible desde JavaScript.
 */
export const tokenStorage = {
  getAccess(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(ACCESS_TOKEN_KEY);
  },
  setAccess(accessToken: string): void {
    localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
  },
  clear(): void {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
  },
};

let refreshInFlight: Promise<boolean> | null = null;

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

  const response = await fetch(input, buildInit(tokenStorage.getAccess()));

  if (response.status !== 401) {
    return response;
  }

  const refreshed = await refreshAccessToken();
  if (!refreshed) {
    tokenStorage.clear();
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
