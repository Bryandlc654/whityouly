'use client';

import { useState } from 'react';
import Icon from './Icon';
import type { IconName } from './icons';

interface StartGuideModalProps {
  onClose: () => void;
  onShowChoices: () => void;
  onLocate: (index: number) => void;
}

const STEPS: {
  title: string;
  image: string;
  alt: string;
  copy: string;
  context: string;
  contextIcon: IconName;
  locate: string;
}[] = [
  {
    title: 'Empieza con tu relato',
    image: '/assets/onboarding/write.svg',
    alt: 'Ejemplo del feed con el botón Comparte tu relato señalado.',
    copy: 'Pulsa Comparte tu relato. Puedes contar una alegría, una experiencia o algo de tu día con tu seudónimo.',
    context: 'Tu identidad real no aparece en tus publicaciones.',
    contextIcon: 'shield',
    locate: 'Ver dónde publicar',
  },
  {
    title: 'Dale tu forma',
    image: '/assets/onboarding/format.svg',
    alt: 'Ejemplo del editor con las opciones Texto, Tarjeta y Audio y el botón Publicar.',
    copy: 'Escribe, crea una tarjeta o comparte un audio. Si quieres, añade un tema, una emoción o cómo prefieres que te acompañen. Revisa tu relato antes de publicar.',
    context: 'El tema, la emoción y tu preferencia de acompañamiento son opcionales.',
    contextIcon: 'edit',
    locate: 'Ver dónde elegir el formato',
  },
  {
    title: 'Publica y conversa',
    image: '/assets/onboarding/published.svg',
    alt: 'Ejemplo de un relato publicado con Estoy contigo y Comentar.',
    copy: 'Al publicar, vuelves al feed y encuentras tu nuevo relato. Otras personas pueden acompañarte con Estoy contigo o con un comentario. Tú también puedes acompañarlas.',
    context: 'Mi diario y tus registros emocionales son privados: no se publican en el feed.',
    contextIcon: 'lock',
    locate: 'Ver cómo acompañar',
  },
];

export default function StartGuideModal({
  onClose,
  onShowChoices,
  onLocate,
}: StartGuideModalProps) {
  const [current, setCurrent] = useState(0);
  const step = STEPS[current];
  const last = current === STEPS.length - 1;

  return (
    <section
      className="modal welcome-guide onboarding53"
      role="dialog"
      aria-modal="true"
      aria-labelledby="welcomeGuideTitle"
    >
      <div className="modal-head">
        <div>
          <span className="intro-kicker53">CÓMO PUBLICAR · {current + 1} DE 3</span>
          <h2 id="welcomeGuideTitle" tabIndex={-1}>
            {step.title}
          </h2>
        </div>
        <button className="close" type="button" onClick={onClose} aria-label="Cerrar bienvenida">
          <Icon name="x" />
        </button>
      </div>

      <div className="intro-art53 intro-art54">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={step.image} alt={step.alt} width={440} height={224} />
      </div>

      <p className="intro-copy53">{step.copy}</p>

      <p className="intro-context53">
        <Icon name={step.contextIcon} />
        <span>{step.context}</span>
      </p>

      <button className="intro-locate53" type="button" onClick={() => onLocate(current)}>
        {step.locate} <Icon name="chevron" />
      </button>

      <nav className="intro-progress53" aria-label="Pasos para publicar">
        {STEPS.map((item, index) => (
          <button
            key={item.title}
            type="button"
            onClick={() => setCurrent(index)}
            aria-label={`Paso ${index + 1}: ${item.title}`}
            aria-current={index === current ? 'step' : undefined}
          />
        ))}
      </nav>

      <div className="intro-actions53">
        <button
          className="ghost"
          type="button"
          onClick={() => setCurrent((value) => Math.max(0, value - 1))}
          disabled={current === 0}
        >
          Anterior
        </button>
        <button
          className="primary"
          type="button"
          onClick={() => {
            if (last) onClose();
            else setCurrent((value) => value + 1);
          }}
        >
          {last ? 'Listo, quiero empezar' : 'Siguiente'}
        </button>
      </div>

      <button className="intro-start54" type="button" onClick={onShowChoices}>
        Ver opciones para empezar
      </button>

      <button className="intro-skip53" type="button" onClick={onClose}>
        Omitir guía
      </button>
    </section>
  );
}
