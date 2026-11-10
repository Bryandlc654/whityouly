'use client';

import { useRouter } from 'next/navigation';
import Icon from '@/components/wy/Icon';
import ProfileShell from '@/components/wy/ProfileShell';

const TIPS = [
  {
    title: 'Cambia nombres y lugares',
    body: 'Usa referencias generales como “una persona cercana” o “mi ciudad”.',
  },
  {
    title: 'Revisa fechas y detalles únicos',
    body: 'Una combinación de datos pequeños también puede identificarte.',
  },
  {
    title: 'Escucha tu audio antes de publicarlo',
    body: 'Tu voz y lo que se oye de fondo pueden revelar información.',
  },
  {
    title: 'Usa el aviso de contenido',
    body: 'Permite que otras personas decidan si desean abrir un tema difícil.',
  },
];

export default function PrivacyGuidePage() {
  const router = useRouter();

  return (
    <ProfileShell>
      <section className="screen help-v58 help-subpage">
        <div className="screen-back">
          <button className="ghost" type="button" onClick={() => router.push('/ayuda')}>
            ← Ayuda y seguridad
          </button>
          <div>
            <h1>Publica sin revelar tu identidad</h1>
            <p>Una guía rápida antes de compartir texto o audio.</p>
          </div>
        </div>

        <section className="card privacy-guide-card">
          <div className="privacy-checklist">
            {TIPS.map((tip) => (
              <div key={tip.title}>
                <Icon name="check" />
                <span>
                  <b>{tip.title}</b>
                  <small>{tip.body}</small>
                </span>
              </div>
            ))}
          </div>
          <button className="primary" type="button" onClick={() => router.push('/crear')}>
            Compartir con cuidado
          </button>
        </section>
      </section>
    </ProfileShell>
  );
}
