'use client';

import Icon from './Icon';
import StoryForm from './StoryForm';
import type { MyStory } from '@/lib/stories';

interface Props {
  onClose: () => void;
  onCreated: (story: MyStory, published: boolean) => void;
}

/**
 * Envoltorio en modal del formulario de publicación, para las pantallas que lo
 * abren encima del contenido (por ejemplo «Mis relatos»). El feed publica en
 * línea con `StoryForm`, sin modal.
 */
export default function StoryComposer({ onClose, onCreated }: Props) {
  return (
    <div className="modal" role="dialog" aria-modal="true" aria-label="Compartir relato">
      <div className="modal-head">
        <div>
          <h2>Compartir un relato</h2>
          <p>Escribes bajo tu seudónimo. Puedes guardarlo como borrador y publicarlo cuando quieras.</p>
        </div>
        <button className="close" type="button" onClick={onClose} aria-label="Cerrar">
          <Icon name="x" />
        </button>
      </div>
      <StoryForm onCreated={onCreated} onCancel={onClose} />
    </div>
  );
}
