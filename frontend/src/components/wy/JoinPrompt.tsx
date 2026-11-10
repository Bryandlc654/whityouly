'use client';

import { useRouter } from 'next/navigation';
import Icon from './Icon';
import { rememberReturnTo } from '@/lib/returnTo';

/**
 * Invitación a unirse para quien lee un relato compartido sin cuenta. Leer es
 * público; acompañar, comentar o seguir requiere iniciar sesión o registrarse.
 * Tras entrar, la persona vuelve a `returnTo` (el relato que estaba leyendo).
 */

interface Props {
  returnTo: string;
  /** Qué quería hacer la persona: ajusta el título. */
  reason?: string;
  onClose?: () => void;
  /** `card` se incrusta en la página; `modal` se abre al pulsar una acción. */
  variant?: 'card' | 'modal';
}

export default function JoinPrompt({ returnTo, reason, onClose, variant = 'modal' }: Props) {
  const router = useRouter();

  const go = (path: '/login' | '/register') => {
    rememberReturnTo(returnTo);
    router.push(path);
  };

  const body = (
    <>
      <span className="join-prompt-icon" aria-hidden>
        <Icon name="heart" />
      </span>
      <h2 id="joinPromptTitle">{reason ?? 'Únete a Withyouly para acompañar este relato'}</h2>
      <p>
        Puedes leer relatos compartidos sin cuenta. Para decir «Estoy contigo», comentar o seguir una historia,
        inicia sesión o crea tu cuenta con un seudónimo: nunca mostramos tu nombre real ni tu correo.
      </p>
      <div className="join-prompt-actions">
        <button className="primary" type="button" onClick={() => go('/register')}>
          Crear cuenta
        </button>
        <button className="secondary" type="button" onClick={() => go('/login')}>
          Iniciar sesión
        </button>
      </div>
    </>
  );

  if (variant === 'card') {
    return <section className="join-prompt card">{body}</section>;
  }

  return (
    <div className="modal join-prompt join-prompt-modal" role="dialog" aria-modal="true" aria-labelledby="joinPromptTitle">
      <button className="close" type="button" onClick={onClose} aria-label="Cerrar">
        <Icon name="x" />
      </button>
      {body}
    </div>
  );
}
