import { SUGGESTED_CHARACTERS } from '@/lib/feed-data';

const BIO_TONE: Record<(typeof SUGGESTED_CHARACTERS)[number]['bioTone'], string> = {
  primary: 'text-primary',
  secondary: 'text-secondary',
  tertiary: 'text-tertiary',
};

const AVATAR_TONE: Record<(typeof SUGGESTED_CHARACTERS)[number]['avatarTone'], string> = {
  'primary-fixed': 'bg-primary-fixed text-primary',
  'secondary-fixed': 'bg-secondary-fixed text-secondary',
  'tertiary-fixed': 'bg-tertiary-fixed text-tertiary',
};

interface RightColumnProps {
  onFollow: (name: string) => void;
}

export default function RightColumn({ onFollow }: RightColumnProps) {
  return (
    <div className="lg:col-span-4 flex flex-col gap-space-md">
      {/* Personajes que inspiran */}
      <section className="bg-surface-container-lowest rounded-2xl p-space-md shadow-[0_4px_20px_rgba(70,72,212,0.04)] flex flex-col gap-space-md">
        <div className="flex items-center justify-between gap-space-sm">
          <div className="flex items-center gap-space-xs">
            <span className="material-symbols-outlined text-primary text-lg">supervised_user_circle</span>
            <h2 className="text-headline-sm text-on-surface">Personajes que inspiran</h2>
          </div>
          <a href="#" className="text-label-sm text-primary hover:underline shrink-0">
            Ver todos
          </a>
        </div>

        <p className="text-body-sm text-on-surface-variant -mt-2">
          Voces anónimas que comparten serenidad, fortaleza y desahogos sinceros.
        </p>

        <ul className="flex flex-col gap-space-sm">
          {SUGGESTED_CHARACTERS.map((person) => (
            <li
              key={person.id}
              className="p-space-sm rounded-xl bg-surface-container-low/60 flex items-center justify-between gap-space-sm"
            >
              <div className="flex items-center gap-space-sm min-w-0">
                <div
                  className={`w-10 h-10 shrink-0 rounded-full flex items-center justify-center font-bold text-sm ${AVATAR_TONE[person.avatarTone]}`}
                >
                  {person.name.charAt(0)}
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="text-label-lg text-on-surface truncate">{person.name}</span>
                  <span className="text-label-sm text-on-surface-variant truncate">{person.handle}</span>
                  <span className={`text-body-sm text-[11px] truncate ${BIO_TONE[person.bioTone]}`}>
                    {person.bio}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => onFollow(person.name)}
                className={
                  person.following
                    ? 'shrink-0 text-label-md bg-surface-container-highest hover:bg-primary hover:text-on-primary text-on-surface px-3 py-1 rounded-full transition-colors'
                    : 'shrink-0 text-label-md bg-primary-fixed text-on-primary-fixed hover:bg-primary hover:text-on-primary px-3 py-1 rounded-full transition-colors'
                }
              >
                {person.following ? 'Siguiendo' : 'Acompañar'}
              </button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
