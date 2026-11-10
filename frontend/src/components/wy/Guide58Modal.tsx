'use client';

import { useState } from 'react';
import Icon from './Icon';
import { GUIDES58, type Guide58Key } from '@/lib/guide58';

interface Props {
  type: Guide58Key;
  onClose: () => void;
}

/** Guía paso a paso con el mismo marcado que showGuide() de v58. */
export default function Guide58Modal({ type, onClose }: Props) {
  const guide = GUIDES58[type] ?? GUIDES58.emotion;
  const [index, setIndex] = useState(0);
  const step = guide.steps[index];
  const last = index === guide.steps.length - 1;

  return (
    <div className="modal guide-modal" role="dialog" aria-modal="true">
      <div className="modal-head">
        <div>
          <span className="micro-label">
            GUÍA {index + 1} DE {guide.steps.length}
          </span>
          <h2>{guide.title}</h2>
        </div>
        <button className="close" type="button" onClick={onClose} aria-label="Cerrar">
          <Icon name="x" />
        </button>
      </div>
      <div className={`guide-illustration guide-${type}`}>
        <span>{step.icon}</span>
      </div>
      <h3>{step.title}</h3>
      <p>{step.text}</p>
      <div className="guide-dots">
        {guide.steps.map((item, dot) => (
          <i key={item.title} className={dot === index ? 'active' : ''} />
        ))}
      </div>
      <div className="guide-actions">
        <button className="ghost" type="button" disabled={index === 0} onClick={() => setIndex((value) => value - 1)}>
          Anterior
        </button>
        {last ? (
          <button className="primary" type="button" onClick={onClose}>
            Entendido
          </button>
        ) : (
          <button className="primary" type="button" onClick={() => setIndex((value) => value + 1)}>
            Siguiente
          </button>
        )}
      </div>
    </div>
  );
}
