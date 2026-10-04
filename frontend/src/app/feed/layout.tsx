import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Feed · Whityouly',
};

export default function FeedLayout({ children }: { children: React.ReactNode }) {
  return children;
}