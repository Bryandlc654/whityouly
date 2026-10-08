import Link from 'next/link';
import Icon from '@/components/wy/Icon';
import type { IconName } from '@/components/wy/icons';

const FEATURES: { icon: IconName; title: string; text: string }[] = [
  {
    icon: 'shield',
    title: 'Identidad anónima',
    text: 'Tu correo nunca se muestra. Creas un personaje público y escribes bajo ese seudónimo, sin exponer quién eres.',
  },
  {
    icon: 'lock',
    title: 'Sesiones bajo tu control',
    text: 'Ves cada dispositivo con acceso a tu cuenta y puedes cerrar cualquiera al instante.',
  },
  {
    icon: 'eye',
    title: 'Privacidad granular',
    text: 'Elige si tu perfil es público o privado y qué partes se muestran en la vista de la comunidad.',
  },
  {
    icon: 'user',
    title: 'Avatar protegido',
    text: 'Tu imagen se valida por contenido, se limpia de metadatos y se recodifica antes de publicarse.',
  },
];

const CTA = { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none' };

export default function Home() {
  return (
    <div className="wy">
      <div className="landing">
        <div className="landing-top">
          <span className="brand" style={{ width: 190, height: 44 }}>
            <span className="brand-crop" role="img" aria-label="Withyouly" />
          </span>
          <nav style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <Link href="/login" className="secondary" style={{ textDecoration: 'none' }}>
              Ingresar
            </Link>
            <Link href="/register" className="primary" style={{ ...CTA, padding: '10px 16px' }}>
              Crear cuenta
            </Link>
          </nav>
        </div>

        <section className="landing-hero">
          <h1>Tu santuario personal de empatía.</h1>
          <p>
            Escribe y comparte lo que sientes con una identidad que te protege. Sin juicios, sin
            algoritmos, solo personas.
          </p>
          <div className="landing-actions">
            <Link href="/register" className="primary" style={{ ...CTA, padding: '13px 20px' }}>
              Crear mi personaje
            </Link>
            <Link href="/login" className="secondary" style={{ ...CTA, padding: '13px 20px' }}>
              Ya tengo cuenta
            </Link>
          </div>
        </section>

        <section className="landing-grid">
          {FEATURES.map((feature) => (
            <article key={feature.title} className="feature card">
              <span>
                <Icon name={feature.icon} />
              </span>
              <h3>{feature.title}</h3>
              <p>{feature.text}</p>
            </article>
          ))}
        </section>

        <section className="card" style={{ marginTop: 22, padding: '44px 28px', textAlign: 'center' }}>
          <h2 style={{ margin: '0 0 16px', fontSize: 26 }}>Tu voz merece un lugar sin rostro.</h2>
          <Link href="/register" className="primary" style={{ ...CTA, padding: '13px 22px' }}>
            Empezar ahora
          </Link>
        </section>

        <footer
          style={{
            marginTop: 22,
            padding: '16px 0 4px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 12,
          }}
        >
          <span className="brand" style={{ width: 120, height: 32 }}>
            <span className="brand-crop" role="img" aria-label="Withyouly" />
          </span>
          <nav style={{ display: 'flex', gap: 16 }}>
            <Link href="/login" className="text-link">
              Ingresar
            </Link>
            <Link href="/register" className="text-link">
              Crear cuenta
            </Link>
          </nav>
        </footer>
      </div>
    </div>
  );
}
