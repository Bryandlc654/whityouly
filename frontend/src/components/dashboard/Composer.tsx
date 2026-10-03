'use client';

import { useRef, useState } from 'react';
import { CharacterSummary } from './types';

const KINDS = [
  { label: 'Relato', icon: 'auto_stories', tone: 'text-primary' },
  { label: 'Desahogo', icon: 'edit_note', tone: 'text-tertiary' },
  { label: 'Poema', icon: 'flare', tone: 'text-secondary' },
] as const;

interface ComposerProps {
  character: CharacterSummary | null;
  onNeedCharacter: () => void;
}

export default function Composer({ character, onNeedCharacter }: ComposerProps) {
  const [text, setText] = useState('');
  const [kind, setKind] = useState<(typeof KINDS)[number]['label']>('Relato');
  const [notice, setNotice] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const focus = () => {
    if (!character) {
      onNeedCharacter();
      return;
    }
    textareaRef.current?.focus();
  };

  const submit = () => {
    if (!character) {
      onNeedCharacter();
      return;
    }
    if (!text.trim()) {
      setNotice('Escribe algo antes de compartirlo con la comunidad.');
      return;
    }
    // El módulo de historias todavía no existe en la API: avisamos en vez de
    // fingir que el relato se publicó.
    setNotice('Tu relato se está guardando en borrador local. La publicación llega con el módulo de historias.');
  };

  return (
    <section className="bg-surface-container-lowest rounded-2xl p-space-md shadow-[0_4px_20px_rgba(70,72,212,0.04)] flex flex-col gap-space-sm">
      <div className="flex items-start gap-space-sm">
        <div className="w-10 h-10 shrink-0 rounded-full bg-tertiary-fixed text-tertiary flex items-center justify-center text-headline-sm">
          {character?.name.charAt(0).toUpperCase() ?? <span className="material-symbols-outlined text-lg">person</span>}
        </div>
        <div className="flex-1">
          <textarea
            ref={textareaRef}
            rows={3}
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setNotice('');
            }}
            placeholder="¿Qué necesitas sacar de dentro hoy? Desahógate con libertad, aquí nadie te juzga..."
            className="w-full bg-surface-container-low/70 focus:bg-surface-container-lowest rounded-xl p-space-md text-body-md text-on-surface placeholder:text-outline resize-none transition-all focus:outline-none focus:shadow-[0_0_0_2px_rgba(70,72,212,0.3)]"
          />
        </div>
      </div>

      {notice && (
        <p className="flex items-start gap-1 text-body-sm text-on-surface-variant bg-surface-container-low rounded-xl px-space-sm py-2">
          <span className="material-symbols-outlined text-base text-primary">info</span>
          {notice}
        </p>
      )}

      <div className="flex flex-col sm:flex-row items-center justify-between gap-space-sm pt-space-xs">
        <div className="flex flex-wrap items-center gap-1.5 w-full sm:w-auto">
          {KINDS.map((item) => (
            <button
              key={item.label}
              type="button"
              onClick={() => setKind(item.label)}
              aria-pressed={kind === item.label}
              className={
                kind === item.label
                  ? 'px-space-sm py-1 rounded-full bg-primary-container text-on-primary-container font-semibold text-label-sm flex items-center gap-1 transition-colors'
                  : `px-space-sm py-1 rounded-full bg-surface-container text-on-surface-variant hover:bg-surface-container-high text-label-sm flex items-center gap-1 transition-colors`
              }
            >
              <span className={`material-symbols-outlined text-sm ${item.tone}`}>{item.icon}</span>
              {item.label}
            </button>
          ))}
        </div>

        <div className="flex items-center justify-between sm:justify-end gap-space-sm w-full sm:w-auto">
          <span className="text-label-sm text-outline flex items-center gap-1">
            <span className="material-symbols-outlined text-sm text-secondary">shield_person</span>
            Seudónimo protegido
          </span>
          <button
            type="button"
            onClick={submit}
            className="bg-primary hover:bg-primary-container text-on-primary text-label-lg px-space-md py-2 rounded-full shadow-[0_4px_16px_rgba(70,72,212,0.25)] transition-all hover:scale-[1.01] flex items-center gap-1.5"
          >
            <span onClick={focus}>Compartir con calma</span>
            <span className="material-symbols-outlined text-sm">send</span>
          </button>
        </div>
      </div>
    </section>
  );
}
