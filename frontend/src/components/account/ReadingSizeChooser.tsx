'use client';

import { useState } from 'react';
import { savePreferences, type Account, type AccountPreferences } from '@/lib/account';

const READING_SIZES: { value: AccountPreferences['readingSize']; label: string }[] = [
  { value: 'NORMAL', label: 'Normal' },
  { value: 'LARGE', label: 'Grande' },
  { value: 'LARGER', label: 'Muy grande' },
];

export default function ReadingSizeChooser({
  account,
  onSaved,
}: {
  account: Account;
  onSaved: (account: Account) => void;
}) {
  const [current, setCurrent] = useState<AccountPreferences['readingSize']>(
    account.preferences.readingSize,
  );
  const [saving, setSaving] = useState<AccountPreferences['readingSize'] | null>(null);

  const choose = async (value: AccountPreferences['readingSize']) => {
    if (value === current || saving) return;
    const previous = current;
    setCurrent(value);
    setSaving(value);

    const result = await savePreferences({ readingSize: value });
    setSaving(null);

    if (result.status !== 'ok') {
      setCurrent(previous);
      return;
    }

    onSaved({ ...account, preferences: { ...account.preferences, readingSize: value } });
    window.dispatchEvent(new CustomEvent('withyouly:reading-size', { detail: value }));
  };

  return (
    <>
      <div className="reading-choices" role="group" aria-label="Tamaño de lectura">
        {READING_SIZES.map((option) => (
          <button
            key={option.value}
            type="button"
            className={`secondary${current === option.value ? ' selected' : ''}`.trim()}
            aria-pressed={current === option.value}
            onClick={() => void choose(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>

      <article className="reading-example">
        <h2>Un momento para leer con calma</h2>
        <p className="post-text">
          Aquí, tus palabras tienen espacio. Elige el tamaño con el que te resulte más cómodo leer
          relatos, etapas y comentarios.
        </p>
        <p className="reading-comment-example">
          También se ajusta el texto de los comentarios.
        </p>
      </article>
    </>
  );
}
