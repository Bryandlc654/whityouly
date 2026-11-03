'use client';

import { useState } from 'react';
import Icon from './Icon';
import type { GuideContent } from '@/lib/guideContent';

interface Props {
  guide: GuideContent;
  onClose: () => void;
}

export default function GuideModal({ guide, onClose }: Props) {
  const [index, setIndex] = useState(0);
  const step = guide.steps[index];
  const last = index === guide.steps.length - 1;

  return (
    <div className="modal guide-modal" role="dialog" aria-modal="true" aria-labelledby="guideTitle">
      <div className="modal-head">
        <div>
          <span className="micro-label">GUÍA RÁPIDA</span>
          <h2 id="guideTitle">{guide.title}</h2>
          <p>{guide.intro}</p>
        </div>
        <button className="close" type="button" onClick={onClose} aria-label="Cerrar">
          <Icon name="x" />
        </button>
      </div>

      <div className="guide-modal-step">
        <span className="guide-modal-icon">
          <Icon name={step.icon} />
        </span>
        <div>
          <h3>{step.title}</h3>
          <p>{step.text}</p>
        </div>
      </div>

      <div className="guide-dots" aria-hidden>
        {guide.steps.map((item, dotIndex) => (
          <i key={item.title} className={dotIndex === index ? 'active' : undefined} />
        ))}
      </div>

      <div className="modal-actions guide-modal-actions">
        <button className="ghost" type="button" onClick={onClose}>
          Omitir guía
        </button>
        <div>
          {index > 0 ? (
            <button className="secondary" type="button" onClick={() => setIndex((value) => value - 1)}>
              Anterior
            </button>
          ) : null}
          <button
            className="primary"
            type="button"
            onClick={() => {
              if (last) onClose();
              else setIndex((value) => value + 1);
            }}
          >
            {last ? 'Entendido' : 'Siguiente'}
          </button>
        </div>
      </div>
    </div>
  );
}
