'use client';

interface IdentityCardProps {
  onEdit: () => void;
}

/** Solo se monta mientras el usuario no tenga personaje. */
export default function IdentityCard({ onEdit }: IdentityCardProps) {
  return (
    <section className="bg-surface-container-lowest rounded-2xl p-space-md shadow-[0_4px_24px_rgba(70,72,212,0.04)] flex flex-col sm:flex-row sm:items-center justify-between gap-space-md transition-all hover:shadow-[0_8px_30px_rgba(70,72,212,0.07)]">
      <div className="flex items-center gap-space-md min-w-0">
        <div className="w-12 h-12 shrink-0 rounded-full bg-primary-fixed text-primary flex items-center justify-center">
          <span className="material-symbols-outlined text-headline-md">account_circle</span>
        </div>

        <div className="flex flex-col min-w-0">
          <div className="flex flex-wrap items-center gap-space-xs">
            <span className="text-headline-sm text-on-surface">Sin personaje</span>
            <span className="bg-secondary-container/60 text-on-secondary-container text-[11px] font-semibold px-2 py-0.5 rounded-full flex items-center gap-1">
              <span className="material-symbols-outlined text-[13px]">lock</span>
              Anónimo
            </span>
          </div>
          <span className="text-body-sm text-on-surface-variant mt-0.5">
            Crea tu seudónimo para participar
          </span>
        </div>
      </div>

      <button
        type="button"
        onClick={onEdit}
        className="self-start sm:self-auto shrink-0 bg-surface-container-low hover:bg-surface-container-high text-on-surface text-label-lg px-space-md py-2 rounded-full transition-colors flex items-center gap-1.5 shadow-sm"
      >
        <span className="material-symbols-outlined text-base text-primary">edit</span>
        <span>Crear mi personaje</span>
      </button>
    </section>
  );
}
