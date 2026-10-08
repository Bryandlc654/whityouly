import Link from 'next/link';
import Icon from '@/components/wy/Icon';

export default function ProfileNotFound() {
  return (
    <div className="wy">
      <section className="auth-screen">
        <div className="auth-card card center">
          <div className="status-icon err">
            <Icon name="x" />
          </div>
          <h1>No encontramos ese perfil</h1>
          <p className="auth-note">
            Puede que el seudónimo no exista o que su propietario haya decidido mantenerlo en
            privado.
          </p>
          <Link
            href="/"
            className="primary"
            style={{ display: 'grid', placeItems: 'center', textDecoration: 'none' }}
          >
            Volver al inicio
          </Link>
        </div>
      </section>
    </div>
  );
}
