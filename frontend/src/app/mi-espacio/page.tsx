'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { API_URL } from '@/lib/api';
import { authFetch, logout as endSession, tokenStorage } from '@/lib/auth';
import type { CharacterSummary } from '@/components/feed/types';
import Icon from '@/components/wy/Icon';
import MiEspacioNav from '@/components/wy/MiEspacioNav';
import RightRail from '@/components/wy/RightRail';
import WyFrame, { type WyRoute } from '@/components/wy/Shell';
import { Sheet, type SheetRow } from '@/components/wy/Overlays';

const MODULES = [
  {
    href: '/mi-diario',
    title: 'Mi diario',
    eyebrow: 'Recuerdos y notas',
    copy: 'Guarda lo que quieres recordar, escribir o revisar más tarde. Sin emoción obligatoria.',
    icon: 'book' as const,
    tone: 'violet',
  },
  {
    href: '/mi-estado',
    title: 'Mis emociones',
    eyebrow: 'Mapa privado',
    copy: 'Registra cómo te sientes y observa tus cambios con el tiempo. No es un diagnóstico.',
    icon: 'pulse' as const,
    tone: 'blue',
  },
  {
    href: '/cuidarme',
    title: 'Cuidarme',
    eyebrow: 'Un paso posible',
    copy: 'Respira, desenreda una idea, elige una acción pequeña o pide compañía.',
    icon: 'heart' as const,
    tone: 'rose',
  },
  {
    href: '/mi-arbol',
    title: 'Mi árbol',
    eyebrow: 'Tu crecimiento',
    copy: 'Cada gesto de cuidado deja una gota. Mira tu árbol, tu jardín y tus logros.',
    icon: 'trend' as const,
    tone: 'green',
  },
  {
    href: '/mis-capsulas',
    title: 'Cápsulas',
    eyebrow: 'Mensajes al futuro',
    copy: 'Escribe algo que quieras volver a leer cuando pase el tiempo.',
    icon: 'calendar' as const,
    tone: 'amber',
  },
] as const;

const STEPS = ['Registrar', 'Elegir', 'Practicar', 'Observar', 'Crecer'] as const;

function initialsOf(name?: string | null) {
  if (!name) return '?';
  return name.trim().slice(0, 2).toUpperCase();
}

export default function MiEspacioPage() {
  const router = useRouter();
  const [character, setCharacter] = useState<CharacterSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [summaryHidden, setSummaryHidden] = useState(false);
  const [sheet, setSheet] = useState<{ title: string; rows: SheetRow[] } | null>(null);
  const [toast, setToast] = useState('');
  const toastTimer = useRef<ReturnType<typeof setTimeout>>();

  const notify = useCallback((message: string) => {
    setToast(message);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 2400);
  }, []);

  useEffect(() => () => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
  }, []);

  useEffect(() => {
    let active = true;

    const verify = async () => {
      if (!tokenStorage.getAccess()) {
        router.replace('/login');
        return;
      }

      try {
        const response = await authFetch(`${API_URL}/characters/me`);
        if (!active) return;

        if (response.status === 401) {
          tokenStorage.clear();
          router.replace('/login');
          return;
        }
        if (response.status === 404) {
          router.replace('/onboarding');
          return;
        }
        if (response.ok) setCharacter(await response.json());
      } catch {
        if (active) notify('No se pudo comprobar tu espacio. Inténtalo de nuevo.');
      } finally {
        if (active) setLoading(false);
      }
    };

    void verify();
    return () => {
      active = false;
    };
  }, [router, notify]);

  const logout = useCallback(async () => {
    await endSession();
    router.push('/login');
  }, [router]);

  const navigate = (route: WyRoute) => {
    switch (route) {
      case 'home':
        router.push('/feed');
        break;
      case 'explore':
        router.push('/explorar');
        break;
      case 'my-stories':
        router.push('/mis-relatos');
        break;
      case 'following':
        router.push('/siguiendo');
        break;
      case 'profile':
        router.push('/cuenta');
        break;
      case 'mood':
        router.push('/mi-espacio');
        break;
      case 'tree':
        router.push('/mi-arbol');
        break;
      case 'notifications':
        router.push('/notificaciones');
        break;
      case 'help':
        router.push('/soporte');
        break;
      default:
        break;
    }
  };

  const openAccount = () => {
    setSheet({
      title: 'Tu cuenta',
      rows: [
        { label: 'Ir al feed', icon: 'home', onClick: () => router.push('/feed') },
        { label: 'Mis relatos', icon: 'book', onClick: () => router.push('/mis-relatos') },
        { label: 'Editar perfil', icon: 'edit', onClick: () => router.push('/perfil/editar') },
        { label: 'Mi espacio', icon: 'pulse', onClick: () => router.push('/mi-espacio') },
        { label: 'Configuración de la cuenta', icon: 'settings', onClick: () => router.push('/cuenta/configuracion') },
        { label: 'Cerrar sesión', icon: 'user', danger: true, onClick: () => void logout() },
      ],
    });
  };

  return (
    <WyFrame
      characterInitials={initialsOf(character?.name)}
      avatarUrl={character?.avatarUrl}
      activeRoute="mood"
      className="feed-reference"
      onNavigate={navigate}
      onOpenAccount={openAccount}
      toast={toast}
      sheet={sheet ? <Sheet title={sheet.title} rows={sheet.rows} onClose={() => setSheet(null)} /> : null}
      rightRail={
        <RightRail
          summaryHidden={summaryHidden}
          onToggleSummary={() => setSummaryHidden((value) => !value)}
          onMood={() => router.push('/mi-estado')}
        />
      }
    >
      <section className="screen mi-space-page">
        <MiEspacioNav />

        <section className="card mi-space-hero">
          <div>
            <span className="privacy-badge">
              <Icon name="lock" /> Tu espacio privado
            </span>
            <h1>Mi espacio</h1>
            <p>
              Cinco lugares para escucharte sin publicar nada. Puedes entrar y salir cuando quieras:
              nada de aquí se comparte con la comunidad.
            </p>
          </div>
          <div className="mi-space-hero-note">
            <Icon name="shield" />
            <span>Solo tú puedes ver lo que guardas aquí.</span>
          </div>
        </section>

        <section className="card mi-space-cycle" aria-label="Recorrido de Mi espacio">
          {STEPS.map((step, index) => (
            <div key={step} className="mi-space-step">
              <b>{index + 1}</b>
              <span>{step}</span>
            </div>
          ))}
        </section>

        <div className="mi-space-grid">
          {MODULES.map((module) => (
            <button
              key={module.href}
              type="button"
              className={`card mi-space-module tone-${module.tone}`}
              onClick={() => router.push(module.href)}
              disabled={loading}
            >
              <span className="mi-space-module-icon">
                <Icon name={module.icon} />
              </span>
              <span className="mi-space-module-copy">
                <small>{module.eyebrow}</small>
                <b>{module.title}</b>
                <span>{module.copy}</span>
              </span>
              <Icon name="chevron" />
            </button>
          ))}
        </div>

        <div className="tip mi-space-tip">
          <b>Sin exigencias.</b> No hay una forma correcta de usar Mi espacio. Puedes empezar por
          escribir, registrar una emoción o simplemente respirar un minuto.
        </div>
      </section>
    </WyFrame>
  );
}
