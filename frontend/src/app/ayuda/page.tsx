'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Icon from '@/components/wy/Icon';
import ProfileShell from '@/components/wy/ProfileShell';
import { createGeneralReport } from '@/lib/reports';
import { REPORT_REASONS, REPORT_REASON_LABELS } from '@/lib/moderation';

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
      'En Perú puedes contactar la Línea 113 Salud, opción 1, para orientación en salud mental.',
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
  const [reportOpen, setReportOpen] = useState(false);
  const [reportBusy, setReportBusy] = useState(false);
  const [reportError, setReportError] = useState('');
  const [reportDone, setReportDone] = useState(false);

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
          <button className="secondary" type="button" onClick={() => router.push('/ayuda/recursos')}>
            Encontrar recursos de mi región
          </button>
        </section>

        <div className="help-grid">
          <article className="card help-card">
            <span><Icon name="flag" /></span>
            <h3>Reportar contenido</h3>
            <p>Acoso, datos personales, autolesión, violencia o contenido que incumpla las normas.</p>
            <button className="text-link" type="button" onClick={() => { setReportDone(false); setReportError('' ); setReportOpen(true); }}>
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

        {reportOpen ? (
          <div
            className="modal-layer"
            role="presentation"
            onClick={() => {
              if (!reportBusy) setReportOpen(false);
            }}
          >
            <div
              className="modal report-help-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="reportHelpTitle"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="modal-head">
                <div>
                  <span className="micro-label">REPORTAR CONTENIDO</span>
                  <h2 id="reportHelpTitle">{reportDone ? 'Reporte enviado' : '¿Qué quieres reportar?'}</h2>
                  <p>
                    {reportDone
                      ? 'Tu reporte fue enviado a revisión. Puedes seguir su estado desde Mis reportes.'
                      : 'Elige el motivo que mejor describa la situación. No se comparte tu identidad con la persona reportada.'}
                  </p>
                </div>
                <button
                  className="close"
                  type="button"
                  onClick={() => setReportOpen(false)}
                  aria-label="Cerrar"
                  disabled={reportBusy}
                >
                  <Icon name="x" />
                </button>
              </div>

              {reportError ? (
                <p className="auth-error" role="alert">
                  {reportError}
                </p>
              ) : null}

              {reportDone ? (
                <div className="report-done-block">
                  <span className="pop-check">
                    <Icon name="check" />
                  </span>
                  <div className="modal-actions">
                    <button className="ghost" type="button" onClick={() => setReportOpen(false)}>
                      Cerrar
                    </button>
                    <button
                      className="primary"
                      type="button"
                      onClick={() => router.push('/mis-reportes')}
                    >
                      Ver seguimiento
                    </button>
                  </div>
                </div>
              ) : (
                <div className="report-reason-list">
                  {REPORT_REASONS.map((reason) => (
                    <button
                      key={reason}
                      type="button"
                      disabled={reportBusy}
                      onClick={() => {
                        setReportBusy(true);
                        setReportError('');
                        void createGeneralReport(reason).then((result) => {
                          setReportBusy(false);
                          if (result.status !== 'ok') {
                            setReportError(result.message);
                            return;
                          }
                          setReportDone(true);
                        });
                      }}
                    >
                      <Icon name={reason === 'THREATS' || reason === 'HARASSMENT' ? 'shield' : 'flag'} />
                      <span>
                        <b>{REPORT_REASON_LABELS[reason]}</b>
                        <small>Enviar este motivo a revisión de seguridad.</small>
                      </span>
                      <Icon name="chevron" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : null}

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
