import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { fetchPublicProfile, formatJoinDate } from '@/lib/characters';

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
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-surface-container-lowest px-6 text-center font-body-md text-on-surface antialiased">
        <span className="material-symbols-outlined text-4xl text-on-surface-variant">
          cloud_off
        </span>
        <h1 className="text-headline-sm font-bold">No se pudo cargar el perfil</h1>
        <p className="max-w-md text-body-md text-on-surface-variant">
          Whityouly no respondió a tiempo. El perfil puede seguir existiendo: inténtalo de nuevo en un
          momento.
        </p>
        <a
          href={`/personaje/${encodeURIComponent(params.name)}`}
          className="rounded-full bg-primary px-space-lg py-3 text-label-lg font-bold text-on-primary transition-opacity hover:opacity-90"
        >
          Reintentar
        </a>
      </div>
    );
  }

  const profile = result.profile;
  const joinDate = formatJoinDate(profile.createdAt);
  const initial = profile.name.trim().charAt(0).toUpperCase();

  return (
    <div className="min-h-screen bg-surface-container-lowest text-on-surface font-body-md antialiased">
      <header className="border-b border-outline-variant/30">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-5 lg:px-8">
          <Link href="/" className="flex items-center gap-2 text-on-surface-variant transition-colors hover:text-primary">
            <span className="material-symbols-outlined text-xl">arrow_back</span>
            <span className="text-sm font-semibold">Inicio</span>
          </Link>
          <Image src="/logo.png" alt="Whityouly" width={120} height={34} className="h-8 w-auto" />
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-10 lg:px-8 lg:py-14">
        <article className="rounded-3xl border border-outline-variant/30 bg-surface p-7 shadow-sm lg:p-10">
          <div className="flex flex-col items-center gap-5 text-center sm:flex-row sm:items-center sm:text-left">
            {profile.avatarUrl ? (
              <Image
                src={profile.avatarUrl}
                alt={`Avatar de ${profile.name}`}
                width={96}
                height={96}
                unoptimized
                className="h-24 w-24 shrink-0 rounded-full object-cover"
              />
            ) : (
              <span
                aria-hidden="true"
                className="flex h-24 w-24 shrink-0 items-center justify-center rounded-full bg-primary-container text-3xl font-bold text-on-primary-container"
              >
                {initial}
              </span>
            )}

            <div className="min-w-0">
              <h1 className="break-words text-headline-sm font-bold text-on-surface">
                {profile.name}
              </h1>
              {profile.tagline ? (
                <p className="mt-1 break-words text-body-md text-on-surface-variant">
                  {profile.tagline}
                </p>
              ) : null}
              <p className="mt-1 text-body-sm text-on-surface-variant">
                Seudónimo público
                {joinDate ? ` · En Withyouly desde ${joinDate}` : ''}
              </p>
            </div>
          </div>

          {profile.interests.length > 0 ? (
            <section aria-labelledby="interests-heading" className="mt-8">
              <h2
                id="interests-heading"
                className="text-label-lg uppercase tracking-wide text-on-surface-variant"
              >
                Intereses
              </h2>
              <ul className="mt-3 flex flex-wrap gap-2">
                {profile.interests.map((interest) => (
                  <li
                    key={interest}
                    className="rounded-full bg-secondary-container px-3.5 py-1.5 text-body-sm font-semibold text-on-secondary-container"
                  >
                    {interest}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <hr className="my-8 border-outline-variant/30" />

          <section aria-labelledby="bio-heading">
            <h2 id="bio-heading" className="text-label-lg uppercase tracking-wide text-on-surface-variant">
              Biografía
            </h2>
            {profile.bio ? (
              // Se renderiza como texto plano: React escapa el contenido y los
              // saltos de línea solo se respetan como presentación.
              <p className="mt-3 whitespace-pre-wrap break-words text-body-md leading-relaxed text-on-surface">
                {profile.bio}
              </p>
            ) : (
              <p className="mt-3 text-body-md text-on-surface-variant">
                Este personaje todavía no ha escrito su biografía.
              </p>
            )}
          </section>
        </article>

        <p className="mt-6 flex items-start gap-2 text-body-sm text-on-surface-variant">
          <span className="material-symbols-outlined mt-0.5 shrink-0 text-lg">shield_person</span>
          En Withyouly se escribe bajo un seudónimo. Nunca se muestra el correo ni ningún dato que
          vincule este perfil con una identidad real.
        </p>
      </main>
    </div>
  );
}
