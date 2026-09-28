'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function DashboardPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [character, setCharacter] = useState<any>(null);

  useEffect(() => {
    const verifySession = async () => {
      const token = localStorage.getItem('accessToken');

      // Si no hay token guardado, ni siquiera intentamos, lo echamos al login
      if (!token) {
        router.push('/login');
        return;
      }

      try {
        // Hacemos una petición a una ruta protegida del backend usando el JWT
        const res = await fetch('http://localhost:3000/characters/me', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (res.status === 401) {
          // El token expiró o es inválido
          localStorage.removeItem('accessToken');
          localStorage.removeItem('refreshToken');
          router.push('/login');
          return;
        }

        if (res.ok) {
          const data = await res.json();
          // Si data no está vacío, significa que ya tiene un personaje creado
          if (data) {
            setCharacter(data);
          }
        }
      } catch (error) {
        console.error('Error verificando sesión', error);
      } finally {
        setLoading(false);
      }
    };

    verifySession();
  }, [router]);

  const logout = () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    router.push('/login');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface">
        <div className="flex flex-col items-center gap-2">
          <span className="material-symbols-outlined animate-spin text-primary text-4xl">progress_activity</span>
          <p className="text-on-surface-variant font-medium">Verificando acceso seguro...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-container-lowest p-8 md:p-16">
      <div className="max-w-4xl mx-auto">
        <header className="flex items-center justify-between mb-12">
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="Whityouly Logo" className="h-8 w-auto" />
          </div>
          <button
            onClick={logout}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-error hover:bg-error-container rounded-full transition-colors"
          >
            <span className="material-symbols-outlined text-sm">logout</span>
            Salir
          </button>
        </header>

        <div className="bg-surface-container-low rounded-3xl p-8 border border-outline-variant/30">
          <h2 className="text-xl font-bold text-on-surface mb-2">¡Autenticación verificada con JWT! 🛡️</h2>
          <p className="text-on-surface-variant mb-6">
            Tu sesión es completamente segura. El servidor validó tu Access Token satisfactoriamente.
          </p>

          {!character ? (
            <div className="bg-white p-6 rounded-2xl border border-dashed border-outline-variant text-center">
              <span className="material-symbols-outlined text-4xl text-primary mb-3">person_add</span>
              <h3 className="font-semibold text-lg text-on-surface">Aún no tienes un Seudónimo</h3>
              <p className="text-sm text-on-surface-variant mt-1 mb-4">
                El siguiente paso es crear tu personaje público (anónimo) para poder interactuar en la comunidad.
              </p>
              <button className="px-6 py-2 bg-primary text-on-primary rounded-full font-medium hover:shadow-lg transition-all">
                Crear mi Seudónimo
              </button>
            </div>
          ) : (
            <div className="bg-white p-6 rounded-2xl border border-outline-variant flex items-center gap-4">
               <div className="w-16 h-16 rounded-full bg-tertiary-container text-on-tertiary-container flex items-center justify-center font-bold text-2xl">
                 {character.name.charAt(0).toUpperCase()}
               </div>
               <div>
                 <h3 className="font-bold text-lg text-on-surface">{character.name}</h3>
                 <p className="text-sm text-on-surface-variant">Tu personaje está activo y listo.</p>
               </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
