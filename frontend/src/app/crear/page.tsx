'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { API_URL } from '@/lib/api';
import { authFetch, tokenStorage } from '@/lib/auth';
import CreateStoryV58 from '@/components/wy/CreateStoryV58';
import ProfileShell from '@/components/wy/ProfileShell';

export default function CreateStoryPage() {
  const router = useRouter();
  const [character, setCharacter] = useState<{ name: string; avatarUrl: string | null }>({
    name: '',
    avatarUrl: null,
  });

  useEffect(() => {
    if (!tokenStorage.getAccess()) {
      router.replace('/login');
      return;
    }

    void (async () => {
      try {
        const res = await authFetch(`${API_URL}/characters/me`);
        if (res.ok) {
          const data = (await res.json()) as { name?: string; avatarUrl?: string | null };
          setCharacter({ name: data.name ?? '', avatarUrl: data.avatarUrl ?? null });
        }
      } catch {
        /* el compositor funciona sin el nombre */
      }
    })();
  }, [router]);

  return (
    <ProfileShell className="compose-mode">
      <CreateStoryV58
        characterName={character.name}
        avatarUrl={character.avatarUrl}
        onCreated={(_story, published) => {
          router.push(published ? '/feed' : '/mis-relatos');
          router.refresh();
        }}
      />
    </ProfileShell>
  );
}
