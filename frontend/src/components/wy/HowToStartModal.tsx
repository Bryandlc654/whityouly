'use client';

import Icon from './Icon';

interface Props {
  onClose: () => void;
  onRead: () => void;
  onWrite: () => void;
  onMood: () => void;
  onShowGuide: () => void;
}

const CHOICES = [
  {
    id: 'read',
    icon: 'book' as const,
    title: 'Leer y acompañar',
    copy: 'Descubre experiencias y responde a tu ritmo.',
  },
  {
    id: 'write',
    icon: 'edit' as const,
    title: 'Compartir un relato',
    copy: 'Una alegría, una experiencia o algo de tu día.',
  },
  {
    id: 'mood',
    icon: 'pulse' as const,
    title: 'Un momento para mí',
    copy: 'Registra cómo estás, en privado.',
  },
];

export default function HowToStartModal({
  onClose,
  onRead,
  onWrite,
  onMood,
  onShowGuide,
}: Props) {
  const actions = { read: onRead, write: onWrite, mood: onMood };

  return (
    <div className="modal welcome-guide how-to-start-modal" role="dialog" aria-modal="true" aria-labelledby="welcomeGuideTitle">
      <div className="modal-head">
        <div>
          <h2 id="welcomeGuideTitle">¿Qué necesitas hoy?</h2>
          <p>Aquí caben alegrías, días difíciles y momentos cotidianos. Elige por dónde empezar.</p>
        </div>
        <button className="close" type="button" onClick={onClose} aria-label="Cerrar bienvenida">
          <Icon name="x" />
        </button>
      </div>

      <div className="welcome-choices">
        {CHOICES.map((choice) => (
          <button
            key={choice.id}
            type="button"
            onClick={actions[choice.id as keyof typeof actions]}
          >
            <Icon name={choice.icon} />
            <span>
              <b>{choice.title}</b>
              <small>{choice.copy}</small>
            </span>
            <Icon name="chevron" />
          </button>
        ))}
      </div>

      <button className="intro-optional54" type="button" onClick={onShowGuide}>
        <Icon name="book" /> Ver cómo publicar un relato
      </button>

      <div className="how-to-start-footer">
        <button className="text-link" type="button" onClick={onClose}>
          Omitir y explorar
        </button>
      </div>
    </div>
  );
}
