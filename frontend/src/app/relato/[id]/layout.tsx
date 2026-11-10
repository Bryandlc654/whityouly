import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { API_URL } from '@/lib/api';

/**
 * Vista previa del enlace compartido (Open Graph y Twitter), como una
 * publicación pública de Facebook: título, extracto y autor del relato.
 * Solo usa la lectura pública del backend; si el relato no es público, la
 * vista previa es genérica y no revela nada.
 */

type Params = { id: string };

const SITE_NAME = 'Withyouly';
const FALLBACK: Metadata = {
  title: `Un relato en ${SITE_NAME}`,
  description: 'Lee relatos compartidos con seudónimo y acompaña a otras personas en Withyouly.',
};

function excerpt(text: string, max = 180): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  return clean.length > max ? `${clean.slice(0, max - 1).trim()}…` : clean;
}

export async function generateMetadata({ params }: { params: Promise<Params> | Params }): Promise<Metadata> {
  const { id } = await params;
  try {
    const response = await fetch(`${API_URL}/stories/${encodeURIComponent(id)}`, {
      headers: { Accept: 'application/json' },
      next: { revalidate: 300 },
      signal: AbortSignal.timeout(4000),
    });
    if (!response.ok) return FALLBACK;
    const story = (await response.json()) as {
      title?: string;
      author?: { name?: string } | null;
      updates?: { content?: string }[];
      withdrawn?: boolean;
    };
    if (!story.title || story.withdrawn) return FALLBACK;

    const author = story.author?.name ? ` · ${story.author.name}` : '';
    const title = `${story.title}${author}`;
    const description = excerpt(story.updates?.[0]?.content ?? '') || FALLBACK.description!;

    return {
      title: `${title} | ${SITE_NAME}`,
      description,
      openGraph: {
        type: 'article',
        siteName: SITE_NAME,
        title,
        description,
        images: [{ url: '/withyouly-community.jpeg', alt: SITE_NAME }],
      },
      twitter: { card: 'summary_large_image', title, description, images: ['/withyouly-community.jpeg'] },
    };
  } catch {
    return FALLBACK;
  }
}

export default function StoryLayout({ children }: { children: ReactNode }) {
  return children;
}
