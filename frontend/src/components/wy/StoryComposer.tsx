'use client';

import Icon from './Icon';
import StoryForm, { type StoryDraftSeed } from './StoryForm';
import type { MyStory } from '@/lib/stories';

interface Props {
  onClose: () => void;
  onCreated: (story: MyStory, published: boolean) => void;
  initialDraft?: StoryDraftSeed;
}

/**
 * Envoltorio en modal del formulario de publicación. El feed y Mis relatos
 * abren el mismo flujo de publicación encima del contenido.
 */
export default function StoryComposer({ onClose, onCreated, initialDraft }: Props) {
  return (
    <div
      className="modal compose-studio-modal"
      role="dialog"
      aria-modal="true"
      aria-label="Compartir relato"
    >
      <div className="modal-head">
        <div>
          <h2>Comparte tu relato</h2>
          <p>Elige texto, tarjeta visual o audio. Escribes bajo tu seudónimo y puedes guardarlo como borrador.</p>
        </div>
        <button className="close" type="button" onClick={onClose} aria-label="Cerrar">
          <Icon name="x" />
        </button>
      </div>
      <StoryForm onCreated={onCreated} onCancel={onClose} initialDraft={initialDraft} />
    </div>
  );
}
