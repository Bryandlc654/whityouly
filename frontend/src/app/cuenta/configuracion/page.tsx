'use client';

import { useRouter } from 'next/navigation';
import Icon from '@/components/wy/Icon';
import SettingsPage from '@/components/account/SettingsPage';
import NotificationToggle from '@/components/account/NotificationToggle';
import { logout as endSession } from '@/lib/auth';

export default function AccountSettingsPage() {
  const router = useRouter();

  const logout = async () => {
    await endSession();
    router.push('/login');
  };

  return (
    <SettingsPage
      showBack={false}
      title="Privacidad y configuración"
      copy="Controla tu cuenta, tus datos y lo que deseas ver en Withyouly."
    >
      {(account, character, reload) => (
        <>
          <section className="settings-hero card">
            <span>
              <Icon name="shield" />
            </span>
            <div>
              <b>Tu identidad pública sigue separada de tu cuenta</b>
              <p>
                La comunidad solo ve {character?.name ?? 'tu seudónimo'}. Tu correo y tus registros
                emocionales permanecen privados.
              </p>
            </div>
          </section>

          <h2 className="settings-section-title">Cuenta</h2>
          <section className="settings-list card">
            <button
              className="settings-row"
              type="button"
              onClick={() => router.push('/perfil/editar')}
            >
              <span>
                <Icon name="user" />
              </span>
              <span>
                <b>Perfil seudónimo</b>
                <small>Biografía, miniatura y temas de interés</small>
              </span>
              <span>
                <Icon name="chevron" />
              </span>
            </button>
            <button
              className="settings-row"
              type="button"
              onClick={() => router.push('/cuenta/seguridad')}
            >
              <span>
                <Icon name="lock" />
              </span>
              <span>
                <b>Cuenta y seguridad</b>
                <small>Correo, contraseña y dispositivos con sesión iniciada</small>
              </span>
              <span>
                <Icon name="chevron" />
              </span>
            </button>
            <NotificationToggle account={account} onSaved={() => void reload()} />
            <button
              className="settings-row"
              type="button"
              onClick={() => router.push('/cuenta/preferencias')}
            >
              <span>
                <Icon name="settings" />
              </span>
              <span>
                <b>Preferencias de la app</b>
                <small>Apariencia, idioma, lectura y avisos</small>
              </span>
              <span>
                <Icon name="chevron" />
              </span>
            </button>
          </section>

          <h2 className="settings-section-title">Privacidad y comunidad</h2>
          <section className="settings-list card">
            <button
              className="settings-row"
              type="button"
              onClick={() => router.push('/cuenta/privacidad-datos')}
            >
              <span>
                <Icon name="shield" />
              </span>
              <span>
                <b>Privacidad y mis datos</b>
                <small>Descarga, visibilidad y eliminación de la cuenta</small>
              </span>
              <span>
                <Icon name="chevron" />
              </span>
            </button>
            <button
              className="settings-row"
              type="button"
              onClick={() => router.push('/cuenta/contenido')}
            >
              <span>
                <Icon name="eye" />
              </span>
              <span>
                <b>Control del contenido</b>
                <small>Temas sensibles y preferencias del feed</small>
              </span>
              <span>
                <Icon name="chevron" />
              </span>
            </button>
            <button
              className="settings-row"
              type="button"
              onClick={() => router.push('/cuenta/bloqueados')}
            >
              <span>
                <Icon name="users" />
              </span>
              <span>
                <b>Silenciados y bloqueados</b>
                <small>Administra los perfiles que ocultaste</small>
              </span>
              <span>
                <Icon name="chevron" />
              </span>
            </button>
            <button
              className="settings-row"
              type="button"
              onClick={() => router.push('/mis-reportes')}
            >
              <span>
                <Icon name="flag" />
              </span>
              <span>
                <b>Estado de mis reportes</b>
                <small>Consulta el seguimiento de tus reportes</small>
              </span>
              <span>
                <Icon name="chevron" />
              </span>
            </button>
          </section>

          <section className="settings-list card">
            <button
              className="settings-row logout-row"
              type="button"
              onClick={() => void logout()}
            >
              <span>
                <Icon name="user" />
              </span>
              <span>
                <b>Cerrar sesión</b>
                <small>Volver a la pantalla de acceso</small>
              </span>
              <span>
                <Icon name="chevron" />
              </span>
            </button>
          </section>
        </>
      )}
    </SettingsPage>
  );
}
