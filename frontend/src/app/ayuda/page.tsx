'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Icon from '@/components/wy/Icon';
import ProfileShell from '@/components/wy/ProfileShell';

interface HelpInfo {
  title: string;
  intro: string;
  points: string[];
}

const HELP_INFO: Record<string, HelpInfo> = {
  emergency: {
    title: 'Buscar ayuda urgente',
    intro:
      'Si tú o alguien está en peligro inmediato, no esperes una respuesta de la comunidad. Contacta ahora a los servicios de emergencia de tu país o a una línea de crisis local.',
    points: [
      'Llama al número de emergencias de tu región.',
      'Si puedes, avisa a una persona de confianza que esté cerca.',
      'No compartas datos personales en espacios públicos mientras buscas ayuda.',
      'Withyouly acompaña, pero no reemplaza atención psicológica, médica ni servicios de emergencia.',
    ],
  },
  report: {
    title: 'Cómo reportar contenido',
    intro:
      'Puedes reportar acoso, datos personales, amenazas, autolesión, violencia o cualquier contenido que incumpla las normas.',
    points: [
      'Abre el menú “Más opciones” del relato o comentario.',
      'Elige “Reportar” y selecciona el motivo que mejor describa la situación.',
      'El equipo de seguridad revisará el contexto antes de tomar una decisión.',
      'Tu identidad no se comparte con la persona reportada.',
    ],
  },
  safety: {
    title: 'Cómo cuidamos la comunidad',
    intro:
      'La seguridad combina filtros automáticos, reportes y revisión humana. Un reporte no elimina automáticamente una publicación.',
    points: [
      'Los reportes llegan a una revisión de seguridad.',
      'Las situaciones delicadas pueden requerir contexto adicional.',
      'La moderación no diagnostica ni sustituye atención profesional.',
      'Puedes consultar el estado de tus reportes desde tu cuenta.',
    ],
  },
  identity: {
    title: 'Publica sin revelar tu identidad',
    intro:
      'Tu correo y tu nombre real nunca se muestran en la comunidad. Estos consejos reducen el riesgo de identificarte por detalles del relato.',
    points: [
      'Cambia nombres, lugares y fechas que puedan identificarte.',
      'Evita combinaciones de detalles únicos, aunque parezcan pequeños.',
      'Escucha el audio antes de publicarlo: la voz y el fondo también informan.',
      'No incluyas teléfonos, direcciones, centros de estudio ni lugares de trabajo.',
    ],
  },
  rules: {
    title: 'Normas de la comunidad',
    intro: 'Reglas simples para compartir y acompañar sin hacer daño.',
    points: [
      'Acompaña, no diagnostiques ni indiques tratamientos.',
      'Protege la identidad propia y la de otras personas.',
      'No se permite acoso, humillación, amenazas ni discriminación.',
      'Reporta situaciones de riesgo o exposición de datos.',
      'Comenta desde tu experiencia y evita juzgar.',
    ],
  },
};

export default function HelpPage() {
  const router = useRouter();
  const [info, setInfo] = useState<HelpInfo | null>(null);

  return (
    <ProfileShell>
      <section className="screen help-v58">
        <section className="card help-hero">
          <h1>Ayuda y seguridad</h1>
          <p>
            Withyouly acompaña; no reemplaza atención psicológica, médica ni servicios de emergencia.
          </p>
        </section>

        <section className="card urgent">
          <h2>¿Tú o alguien está en peligro inmediato?</h2>
          <p>
            Contacta ahora a los servicios de emergencia de tu país o a una línea de crisis local. No dependas
            de una respuesta de la comunidad.
          </p>
          <button className="secondary" type="button" onClick={() => setInfo(HELP_INFO.emergency)}>
            Encontrar recursos de mi región
          </button>
        </section>

        <div className="help-grid">
          <article className="card help-card">
            <span><Icon name="flag" /></span>
            <h3>Reportar contenido</h3>
            <p>Acoso, datos personales, autolesión, violencia o contenido que incumpla las normas.</p>
            <button className="text-link" type="button" onClick={() => setInfo(HELP_INFO.report)}>
              Abrir reporte
            </button>
          </article>

          <article className="card help-card">
            <span><Icon name="shield" /></span>
            <h3>Centro de seguridad</h3>
            <p>Cómo cuidamos la comunidad y qué conducta se espera.</p>
            <button className="text-link" type="button" onClick={() => setInfo(HELP_INFO.safety)}>
              Conocer el proceso
            </button>
          </article>

          <article className="card help-card">
            <span><Icon name="lock" /></span>
            <h3>Protege tu identidad</h3>
            <p>Consejos para publicar sin revelar información personal.</p>
            <button className="text-link" type="button" onClick={() => setInfo(HELP_INFO.identity)}>
              Ver recomendaciones
            </button>
          </article>

          <article className="card help-card">
            <span><Icon name="mail" /></span>
            <h3>Contactar soporte</h3>
            <p>Ayuda con tu cuenta, seudónimo o una decisión de moderación.</p>
            <button className="text-link" type="button" onClick={() => router.push('/soporte')}>
              Escribir a soporte
            </button>
          </article>
        </div>

        <div className="help-list card">
          <button className="settings-row" type="button" onClick={() => setInfo(HELP_INFO.rules)}>
            <span><Icon name="book" /></span>
            <span>
              <b>Normas de la comunidad</b>
              <small>Empatía, límites y contenido permitido</small>
            </span>
            <span><Icon name="chevron" /></span>
          </button>
          <button className="settings-row" type="button" onClick={() => router.push('/cuenta/configuracion')}>
            <span><Icon name="lock" /></span>
            <span>
              <b>Privacidad y datos</b>
              <small>Qué guardamos y cómo eliminar tu cuenta</small>
            </span>
            <span><Icon name="chevron" /></span>
          </button>
        </div>

        {info ? (
          <div className="modal-layer" role="presentation" onClick={() => setInfo(null)}>
            <div
              className="modal help-info-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="helpInfoTitle"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="modal-head">
                <div>
                  <span className="micro-label">AYUDA Y SEGURIDAD</span>
                  <h2 id="helpInfoTitle">{info.title}</h2>
                </div>
                <button className="close" type="button" onClick={() => setInfo(null)} aria-label="Cerrar">
                  <Icon name="x" />
                </button>
              </div>
              <p>{info.intro}</p>
              <ul className="help-info-list">
                {info.points.map((point) => (
                  <li key={point}>{point}</li>
                ))}
              </ul>
              <div className="modal-actions">
                <button className="primary" type="button" onClick={() => setInfo(null)}>
                  Entendido
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </section>
    </ProfileShell>
  );
}
