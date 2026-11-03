'use client';

import { useRouter } from 'next/navigation';
import Icon from '@/components/wy/Icon';
import type { IconName } from '@/components/wy/icons';
import ProfileShell from '@/components/wy/ProfileShell';

const GUIDELINES: { icon: IconName; title: string; body: string }[] = [
  {
    icon: 'heart',
    title: 'Acompaña, no diagnostiques',
    body: 'Habla desde tu experiencia. No indiques tratamientos ni afirmes qué condición tiene otra persona.',
  },
  {
    icon: 'shield',
    title: 'Protege la identidad',
    body: 'No publiques nombres reales, direcciones, teléfonos, centros de estudio o lugares de trabajo.',
  },
  {
    icon: 'message',
    title: 'Sin acoso ni humillación',
    body: 'No se permiten amenazas, burlas, presión, contenido discriminatorio ni ataques personales.',
  },
  {
    icon: 'flag',
    title: 'Reporta situaciones de riesgo',
    body: 'Utiliza el reporte cuando veas exposición de datos, violencia, crisis o contenido que pueda dañar.',
  },
];

export default function CommunityGuidelinesPage() {
  const router = useRouter();

  return (
    <ProfileShell>
      <section className="screen help-v58 help-subpage">
        <div className="screen-back">
          <button className="ghost" type="button" onClick={() => router.push('/ayuda')}>
            <Icon name="chevron" /> Ayuda y seguridad
          </button>
          <div>
            <h1>Normas de la comunidad</h1>
            <p>Reglas simples para compartir y acompañar sin hacer daño.</p>
          </div>
        </div>

        <div className="help-grid">
          {GUIDELINES.map((guideline) => (
            <article className="card help-card" key={guideline.title}>
              <span>
                <Icon name={guideline.icon} />
              </span>
              <h3>{guideline.title}</h3>
              <p>{guideline.body}</p>
            </article>
          ))}
        </div>

        <div className="tip">
          <b>La moderación considera el contexto.</b>
          <br />
          Un reporte no elimina automáticamente una publicación: inicia una revisión de seguridad.
        </div>
      </section>
    </ProfileShell>
  );
}
