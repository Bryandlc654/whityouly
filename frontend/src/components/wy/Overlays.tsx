'use client';

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
  return (
    <div className="sheet" role="dialog" aria-modal="true" aria-label={title}>
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
