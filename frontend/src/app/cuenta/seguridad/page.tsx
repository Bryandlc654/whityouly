'use client';

import { useRouter } from 'next/navigation';
import ProfileShell from '@/components/wy/ProfileShell';
import Icon from '@/components/wy/Icon';

export default function SecurityPage() {
  const router = useRouter();

  return (
    <ProfileShell>
      <section className="screen">
        <p className="demo-auth-note">
          Controles de demostración: no hay sesiones, correos ni contraseñas de servidor
          conectados. Usa datos de prueba.
        </p>

        <div className="screen-back">
          <button className="ghost" type="button" onClick={() => router.push('/cuenta/configuracion')}>
            ← Configuración
          </button>
          <div>
            <h1>Cuenta y seguridad</h1>
            <p>Administra el acceso sin exponer tu identidad pública.</p>
          </div>
        </div>

        <section className="control-card card">
          <div className="control-card-head">
            <span>
              <Icon name="mail" />
            </span>
            <div>
              <h2>Correo de acceso</h2>
              <p>Se utiliza únicamente para iniciar sesión y recuperar la cuenta.</p>
            </div>
          </div>
          <div className="account-value">
            <span>a•••••••z@gmail.com</span>
            <button className="secondary" type="button">
              Cambiar correo
            </button>
          </div>
        </section>

        <section className="control-card card">
          <div className="control-card-head">
            <span>
              <Icon name="lock" />
            </span>
            <div>
              <h2>Contraseña</h2>
              <p>Último cambio: hace 2 meses.</p>
            </div>
          </div>
          <button className="secondary" type="button">
            Cambiar contraseña
          </button>
        </section>

        <div className="section-heading">
          <div>
            <h2>Dispositivos con acceso</h2>
            <p>Cierra cualquier sesión que no reconozcas.</p>
          </div>
          <button className="text-link" type="button">
            Cerrar las demás
          </button>
        </div>

        <section className="device-card card">
          <span>
            <Icon name="check" />
          </span>
          <div>
            <b>Chrome · Windows</b>
            <small>Lima, Perú · Sesión actual</small>
          </div>
          <span className="status-pill safe">Este dispositivo</span>
        </section>

        <section className="device-card card">
          <span>
            <Icon name="user" />
          </span>
          <div>
            <b>Chrome · Android</b>
            <small>Lima, Perú · Último acceso ayer</small>
          </div>
          <button className="secondary" type="button">
            Cerrar sesión
          </button>
        </section>
      </section>
    </ProfileShell>
  );
}
