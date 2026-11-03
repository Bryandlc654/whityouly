'use client';

import { useEffect, useState } from 'react';
import Icon from '@/components/wy/Icon';

const STORAGE_KEY = 'withyouly-content-controls';

interface Controls {
  sensitive: boolean;
  hope: boolean;
  wellness: boolean;
}

const DEFAULTS: Controls = {
  sensitive: true,
  hope: true,
  wellness: true,
};

function readControls(): Controls {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULTS;
    const parsed = JSON.parse(raw) as Partial<Controls>;
    return {
      sensitive: typeof parsed.sensitive === 'boolean' ? parsed.sensitive : DEFAULTS.sensitive,
      hope: typeof parsed.hope === 'boolean' ? parsed.hope : DEFAULTS.hope,
      wellness: typeof parsed.wellness === 'boolean' ? parsed.wellness : DEFAULTS.wellness,
    };
  } catch {
    return DEFAULTS;
  }
}

export default function ContentControlsSection() {
  const [controls, setControls] = useState<Controls>(DEFAULTS);

  useEffect(() => {
    setControls(readControls());
  }, []);

  const update = (key: keyof Controls, value: boolean) => {
    const next = { ...controls, [key]: value };
    setControls(next);

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* almacenamiento bloqueado: la elección se mantiene en esta sesión */
    }
  };

  return (
    <>
      <section className="control-card card">
        <div className="control-card-head">
          <span>
            <Icon name="eye" />
          </span>
          <div>
            <h2>Visualización segura</h2>
            <p>Puedes reducir contenido que no deseas ver en este momento.</p>
          </div>
        </div>

        <label className="control-toggle">
          <span>
            <b>Advertir antes de contenido sensible</b>
            <small>Oculta el texto hasta que decidas verlo</small>
          </span>
          <input
            type="checkbox"
            checked={controls.sensitive}
            onChange={(event) => update('sensitive', event.target.checked)}
          />
        </label>

        <label className="control-toggle">
          <span>
            <b>Priorizar relatos de esperanza</b>
            <small>Equilibra el feed sin ocultar otras emociones</small>
          </span>
          <input
            type="checkbox"
            checked={controls.hope}
            onChange={(event) => update('hope', event.target.checked)}
          />
        </label>

        <label className="control-toggle">
          <span>
            <b>Pausa de bienestar</b>
            <small>Sugerir un descanso tras 20 minutos de lectura</small>
          </span>
          <input
            type="checkbox"
            checked={controls.wellness}
            onChange={(event) => update('wellness', event.target.checked)}
          />
        </label>
      </section>

      <section className="control-card card">
        <div className="control-card-head">
          <span>
            <Icon name="settings" />
          </span>
          <div>
            <h2>Temas que quieres ver menos</h2>
            <p>Se aprende de tus elecciones “Ver menos de este tema”.</p>
          </div>
        </div>
        <div className="chip-list">
          <span>Sin preferencias todavía</span>
        </div>
      </section>
    </>
  );
}
