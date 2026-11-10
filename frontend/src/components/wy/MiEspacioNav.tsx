'use client';

import { useRouter } from 'next/navigation';
import Icon from './Icon';

type MiEspacioSection = 'diary' | 'mood' | 'care' | 'tree' | 'capsules';

interface Props {
  active?: MiEspacioSection | null;
}

const ITEMS: {
  id: MiEspacioSection;
  label: string;
  icon: 'book' | 'pulse' | 'heart' | 'bonsai' | 'clock';
  href: string;
}[] = [
  { id: 'diary', label: 'Mi diario', icon: 'book', href: '/mi-diario' },
  { id: 'mood', label: 'Mis emociones', icon: 'pulse', href: '/mi-estado' },
  { id: 'care', label: 'Cuidarme', icon: 'heart', href: '/cuidarme' },
  { id: 'tree', label: 'Mi árbol', icon: 'bonsai', href: '/mi-arbol' },
  { id: 'capsules', label: 'Cápsulas', icon: 'clock', href: '/mis-capsulas' },
];

export default function MiEspacioNav({ active }: Props) {
  const router = useRouter();

  return (
    <nav className="emotion-nav diary-nav mi-space-nav" aria-label="Mi espacio personal">
      {ITEMS.map((item) => {
        const current = active === item.id;
        return (
          <button
            key={item.id}
            className={current ? 'active' : undefined}
            type="button"
            aria-current={current ? 'page' : undefined}
            onClick={() => router.push(item.href)}
          >
            <Icon name={item.icon} />
            <span>{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
