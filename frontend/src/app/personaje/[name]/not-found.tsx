import Link from 'next/link';
import Icon from '@/components/wy/Icon';
import ProfileShell from '@/components/wy/ProfileShell';

export default function ProfileNotFound() {
  return (
    <ProfileShell>
      <section className="screen">
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
            href="/feed"
            className="primary"
            style={{ display: 'grid', placeItems: 'center', textDecoration: 'none' }}
          >
            Volver al inicio
          </Link>
        </div>
      </section>
    </ProfileShell>
  );
}
