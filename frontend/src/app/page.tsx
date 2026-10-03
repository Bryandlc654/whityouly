import Image from 'next/image';
import Link from 'next/link';

const FEATURES = [
  {
    icon: 'shield_person',
    title: 'Identidad anónima',
    text: 'Tu correo nunca se muestra. Creas un personaje público y escribes bajo ese seudónimo, sin Exposure de quién eres.',
  },
  {
    icon: 'phonelink_lock',
    title: 'Sesiones bajo tu control',
    text: 'Ves cada dispositivo con acceso a tu cuenta y puedes cerrar cualquiera al instante.',
  },
  {
    icon: 'visibility_off',
    title: 'Privacidad granular',
    text: 'Elige si tu perfil es público o privado y qué partes se muestran en la vista de la comunidad.',
  },
  {
    icon: 'image',
    title: 'Avatar protegido',
    text: 'Tu imagen se valida por contenido, se limpia de metadatos y se re-codifica antes de publicarse.',
  },
];

export default function Home() {
  return (
    <div className="min-h-screen bg-surface-container-lowest text-on-surface font-body-md antialiased">
      {/* CABECERA */}
      <header className="absolute inset-x-0 top-0 z-20">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6 lg:px-8">
          <Image src="/logo.png" alt="Whityouly" width={140} height={40} priority className="h-9 w-auto" />
          <nav className="flex items-center gap-2">
            <Link
              href="/login"
              className="rounded-full px-4 py-2 text-sm font-semibold text-white/90 transition-colors hover:bg-white/10"
            >
              Ingresar
            </Link>
            <Link
              href="/register"
              className="rounded-full bg-white px-5 py-2 text-sm font-bold text-[#0d1c2e] transition-colors hover:bg-white/90"
            >
              Crear cuenta
            </Link>
          </nav>
        </div>
      </header>

      {/* HERO */}
      <section className="relative isolate overflow-hidden bg-black">
        <Image
          src="/auth-bg.jpg"
          alt="Personas compartiendo un momento cálido de serenidad"
          fill
          priority
          sizes="100vw"
          className="object-cover opacity-90"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0d1c2e]/95 via-[#0d1c2e]/60 to-[#0d1c2e]/40" />

        <div className="relative mx-auto flex max-w-6xl flex-col items-start gap-6 px-6 pb-20 pt-40 lg:px-8 lg:pb-28 lg:pt-48">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-widest text-white/90">
            <span className="material-symbols-outlined text-base">auto_awesome</span>
            Refugio anónimo
          </span>

          <h1 className="max-w-3xl text-4xl font-extrabold leading-[1.1] tracking-tight text-white lg:text-6xl">
            Tu santuario personal de empatía.
          </h1>

          <p className="max-w-2xl text-lg font-medium leading-relaxed text-white/85 lg:text-xl">
            Escribe y comparte lo que sientes con una identidad que te protege. Sin juicios, sin
            algoritmos, solo personas.
          </p>

          <div className="flex flex-col gap-3 pt-2 sm:flex-row">
            <Link
              href="/register"
              className="inline-flex items-center justify-center gap-2 rounded-full bg-primary px-7 py-3.5 font-bold text-on-primary transition-all hover:shadow-lg"
            >
              Crear mi personaje
              <span className="material-symbols-outlined text-xl">arrow_forward</span>
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center justify-center gap-2 rounded-full border border-white/40 px-7 py-3.5 font-bold text-white transition-colors hover:bg-white/10"
            >
              <span className="material-symbols-outlined text-xl">login</span>
              Ya tengo cuenta
            </Link>
          </div>
        </div>
      </section>

      {/* CARACTERÍSTICAS */}
      <section className="mx-auto max-w-6xl px-6 py-20 lg:px-8">
        <div className="mb-12 max-w-2xl">
          <h2 className="text-3xl font-extrabold tracking-tight lg:text-4xl">
            Seguridad y privacidad, no como promesa
          </h2>
          <p className="mt-3 text-on-surface-variant">
            Cada parte de tu refugio está pensada para que tu identidad real quede fuera de la vista
            pública.
          </p>
        </div>

        <ul className="grid gap-6 sm:grid-cols-2">
          {FEATURES.map((feature) => (
            <li
              key={feature.title}
              className="flex flex-col gap-3 rounded-3xl border border-outline-variant/30 bg-surface-container-low p-7"
            >
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-tertiary-container text-on-tertiary-container">
                <span className="material-symbols-outlined text-2xl">{feature.icon}</span>
              </span>
              <h3 className="text-lg font-bold">{feature.title}</h3>
              <p className="text-sm leading-relaxed text-on-surface-variant">{feature.text}</p>
            </li>
          ))}
        </ul>
      </section>

      {/* CIERRE */}
      <section className="bg-surface-container-low">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-6 px-6 py-16 text-center lg:px-8">
          <h2 className="max-w-2xl text-3xl font-extrabold tracking-tight lg:text-4xl">
            Tu voz merece un lugar sin rostro.
          </h2>
          <Link
            href="/register"
            className="inline-flex items-center gap-2 rounded-full bg-primary px-7 py-3.5 font-bold text-on-primary transition-all hover:shadow-lg"
          >
            Empezar ahora
            <span className="material-symbols-outlined text-xl">arrow_forward</span>
          </Link>
        </div>
      </section>

      <footer className="bg-surface-container-lowest">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 py-8 text-sm text-on-surface-variant sm:flex-row lg:px-8">
          <Image src="/isotipo.png" alt="Whityouly" width={96} height={32} className="h-8 w-auto" />
          <nav className="flex items-center gap-6 font-medium">
            <Link href="/login" className="transition-colors hover:text-primary">
              Ingresar
            </Link>
            <Link href="/register" className="transition-colors hover:text-primary">
              Crear cuenta
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
