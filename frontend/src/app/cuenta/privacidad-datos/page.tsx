'use client';

import { useRouter } from 'next/navigation';
import ProfileShell from '@/components/wy/ProfileShell';
import Icon from '@/components/wy/Icon';

export default function PrivacyDataPage() {
  const router = useRouter();

  return (
    <ProfileShell>
      <section className="screen">
        <div className="screen-back">
          <button className="ghost" type="button" onClick={() => router.push('/cuenta/configuracion')}>
            ← Configuración
          </button>
          <div>
            <h1>Privacidad y mis datos</h1>
            <p>Decide qué conservar, descargar o eliminar.</p>
          </div>
        </div>

        <section className="control-card card">
          <div className="control-card-head">
            <span>
              <Icon name="lock" />
            </span>
            <div>
              <h2>Actividad privada</h2>
              <p>
                El diario emocional, las cápsulas y los borradores nunca aparecen en tu perfil.
              </p>
            </div>
          </div>
          <label className="control-toggle">
            <span>
              <b>Mostrar relatos que sigo</b>
              <small>Desactivado para otras personas</small>
            </span>
            <input type="checkbox" />
          </label>
          <label className="control-toggle">
            <span>
              <b>Mostrar guardados</b>
              <small>Siempre privados</small>
            </span>
            <input type="checkbox" disabled />
          </label>
        </section>

        <section className="control-card card">
          <div className="control-card-head">
            <span>
              <Icon name="book" />
            </span>
            <div>
              <h2>Descargar mis datos</h2>
              <p>Prepara una copia de tus relatos, comentarios, registros y cápsulas.</p>
            </div>
          </div>
          <button className="secondary" type="button">
            Solicitar archivo privado
          </button>
        </section>

        <section className="control-card card danger-zone">
          <h2>Eliminar cuenta y datos</h2>
          <p>
            En la web real, esta acción iniciará una eliminación reversible durante 30 días. Aquí
            puedes revisar y cancelar una solicitud de prueba.
          </p>
          <button className="secondary danger-button" type="button">
            Probar solicitud de eliminación
          </button>
        </section>
      </section>
    </ProfileShell>
  );
}
