import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { fetchPublicProfile, formatJoinDate } from '@/lib/characters';
import Avatar from '@/components/wy/Avatar';
import Icon from '@/components/wy/Icon';

interface PageProps {
  params: { name: string };
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const result = await fetchPublicProfile(params.name);

  if (result.status === 'found') {
    const { profile } = result;

    return {
      title: `${profile.name} · Whityouly`,
      description:
        profile.tagline ?? (profile.bio ? profile.bio.slice(0, 160) : `El perfil público de ${profile.name}.`),
    };
  }

  // Un fallo de la API no se indexa como "no existe": un título neutro evita
  // que un 429 puntual deje un perfil inexistente en los buscadores.
  return {
    title: result.status === 'missing' ? 'Perfil no encontrado · Whityouly' : 'Perfil · Whityouly',
  };
}

export default async function PublicProfilePage({ params }: PageProps) {
  const result = await fetchPublicProfile(params.name);

  // Un perfil privado responde igual que uno inexistente: el mensaje no revela
  // si ese seudónimo está registrado.
  if (result.status === 'missing') {
    notFound();
  }

  // Aquí sí se distinguen: la API no pudo responder, así que no se afirma nada
  // sobre el perfil. Se ofrece reintentar en lugar de un 404 que no es cierto.
  if (result.status === 'unavailable') {
    return (
      <div className="wy">
        <section className="auth-screen">
          <div className="auth-card card center">
            <div className="status-icon err">
              <Icon name="x" />
            </div>
            <h1>No se pudo cargar el perfil</h1>
            <p className="auth-note">
              Whityouly no respondió a tiempo. El perfil puede seguir existiendo: inténtalo de nuevo
              en un momento.
            </p>
            <a
              href={`/personaje/${encodeURIComponent(params.name)}`}
              className="primary"
              style={{ display: 'grid', placeItems: 'center', textDecoration: 'none' }}
            >
              Reintentar
            </a>
          </div>
        </section>
      </div>
    );
  }

  const profile = result.profile;
  const joinDate = formatJoinDate(profile.createdAt);

  return (
    <div className="wy">
      <div style={{ maxWidth: 820, margin: '0 auto', padding: '22px 16px' }}>
        <div className="landing-top" style={{ marginBottom: 16 }}>
          <Link href="/feed" className="secondary" style={{ textDecoration: 'none' }}>
            <Icon name="home" /> Volver al inicio
          </Link>
          <span className="brand" style={{ width: 150, height: 40 }}>
            <span className="brand-crop" role="img" aria-label="Withyouly" />
          </span>
        </div>

        <section className="profile-card card">
          <div className="profile-top">
            <Avatar
              initials={profile.name.trim().charAt(0).toUpperCase()}
              avatarUrl={profile.avatarUrl}
              size="lg"
              alt={`Avatar de ${profile.name}`}
            />
            <div className="profile-copy">
              <span className="privacy-badge">
                <Icon name="shield" /> Perfil seudónimo
              </span>
              <h1>{profile.name}</h1>
              <p>
                {profile.tagline ?? 'Seudónimo público'}
                {joinDate ? ` · En Withyouly desde ${joinDate}` : ''}
              </p>
            </div>
          </div>

          <p className="profile-bio">
            {profile.bio ?? 'Este personaje todavía no ha escrito su biografía.'}
          </p>

          {profile.interests.length > 0 ? (
            <div className="post-tags" style={{ marginTop: 14 }} aria-label="Intereses">
              {profile.interests.map((interest) => (
                <span key={interest} className="tag">
                  {interest}
                </span>
              ))}
            </div>
          ) : null}
        </section>

        {profile.stats ? (
          <div className="profile-stats">
            <div>
              <b>{profile.stats.followers}</b>
              <span>Seguidores</span>
            </div>
            <div>
              <b>{profile.stats.following}</b>
              <span>Siguiendo</span>
            </div>
            <div>
              <b>{profile.stats.companionshipsReceived}</b>
              <span>Estoy contigo</span>
            </div>
            <div>
              <b>{profile.stats.stories}</b>
              <span>Relatos</span>
            </div>
          </div>
        ) : null}

        {profile.featuredStories && profile.featuredStories.length > 0 ? (
          <section className="card pad profile-stories">
            <h2 className="h-section">Historias destacadas</h2>
            {profile.featuredStories.map((story) => (
              <div key={story.id} className="profile-story">
                <h3>{story.title}</h3>
                <p className="muted small">{story.category ?? 'Relato'}</p>
                {story.opening?.content ? <p className="post-text clamp">{story.opening.content}</p> : null}
              </div>
            ))}
          </section>
        ) : null}

        {profile.recentStories && profile.recentStories.length > 0 ? (
          <section className="card pad profile-stories">
            <h2 className="h-section">Relatos recientes</h2>
            {profile.recentStories.map((story) => (
              <div key={story.id} className="profile-story">
                <h3>{story.title}</h3>
                <p className="muted small">{story.category ?? 'Relato'}</p>
                {story.opening?.content ? <p className="post-text clamp">{story.opening.content}</p> : null}
              </div>
            ))}
          </section>
        ) : null}

        <p className="muted" style={{ display: 'flex', gap: 6, marginTop: 14, fontSize: 12, lineHeight: 1.5 }}>
          <Icon name="lock" /> En Withyouly se escribe bajo un seudónimo. Nunca se muestra el correo
          ni ningún dato que vincule este perfil con una identidad real.
        </p>
      </div>
    </div>
  );
}
