import Link from 'next/link';

export default function ProfileNotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-5 bg-surface-container-lowest px-6 text-center text-on-surface font-body-md antialiased">
      <span className="flex h-16 w-16 items-center justify-center rounded-full bg-surface-container text-on-surface-variant">
        <span className="material-symbols-outlined text-3xl">person_off</span>
      </span>
      <div className="max-w-md space-y-2">
        <h1 className="text-headline-sm font-bold">No encontramos ese perfil</h1>
        <p className="text-body-sm text-on-surface-variant">
          Puede que el seudónimo no exista o que su propietario haya decidido mantenerlo en
          privado.
        </p>
      </div>
      <Link
        href="/"
        className="rounded-full bg-primary px-6 py-3 text-sm font-bold text-on-primary transition-all hover:shadow-lg"
      >
        Volver al inicio
      </Link>
    </div>
  );
}
