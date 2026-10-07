import type { Metadata } from 'next';
// Estilos del prototipo Withyouly v7, acotados a .wy para no afectar al resto.
import './withyouly.css';

export const metadata: Metadata = {
  title: 'Feed · Whityouly',
};

export default function FeedLayout({ children }: { children: React.ReactNode }) {
  return children;
}
