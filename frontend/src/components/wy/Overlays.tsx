'use client';

import { useEffect, useRef } from 'react';
import Icon from './Icon';
import type { IconName } from './icons';

export interface SheetRow {
  label: string;
  icon?: IconName;
  danger?: boolean;
  onClick: () => void;
}

interface SheetProps {
  title: string;
  rows: SheetRow[];
  onClose: () => void;
}

export function Sheet({ title, rows, onClose }: SheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const layer = sheetRef.current?.parentElement;
    if (!layer) return;

    // En móvil el fondo del bottom sheet ocupa toda la pantalla. Pulsar fuera
    // de la hoja (sobre la capa) debe cerrarla, igual que Escape en escritorio.
    const onLayerClick = (event: MouseEvent) => {
      if (event.target === layer) onClose();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };

    layer.addEventListener('click', onLayerClick);
    document.addEventListener('keydown', onKeyDown);

    return () => {
      layer.removeEventListener('click', onLayerClick);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [onClose]);

  return (
    <div
      ref={sheetRef}
      className="sheet"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div className="sheet-handle" />
      <h2>{title}</h2>
      {rows.map((row) => (
        <button
          key={row.label}
          className={`action-row ${row.danger ? 'danger' : ''}`}
          type="button"
          onClick={() => {
            onClose();
            row.onClick();
          }}
        >
          <Icon name={row.icon ?? 'chevron'} />
          <span>{row.label}</span>
        </button>
      ))}
      <button className="action-row" type="button" onClick={onClose}>
        <Icon name="x" />
        <span>Cancelar</span>
      </button>
    </div>
  );
}
