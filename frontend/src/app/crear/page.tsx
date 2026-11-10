'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { API_URL } from '@/lib/api';
import { authFetch, tokenStorage } from '@/lib/auth';
import StoryForm from '@/components/wy/StoryForm';
import ProfileShell from '@/components/wy/ProfileShell';

export default function CreateStoryPage() {
  const router = useRouter();
  const [characterName, setCharacterName] = useState('');

  useEffect(() => {
    if (!tokenStorage.getAccess()) {
      router.replace('/login');
      return;
    }

    void (async () => {
      try {
        const res = await authFetch(`${API_URL}/characters/me`);
        if (res.ok) {
          const data = (await res.json()) as { name?: string };
          if (data.name) setCharacterName(data.name);
        }
      } catch {
        /* el compositor funciona sin el nombre */
      }
    })();
  }, [router]);

  return (
    <ProfileShell>
      <section className="screen create-story-screen">
        <div className="screen-heading">
          <div>
            <h1>Comparte tu relato</h1>
            <p>Tus alegrías, tus días difíciles y lo cotidiano tienen un lugar aquí.</p>
          </div>
        </div>
        <StoryForm
          characterName={characterName}
          onCreated={(_story, published) => {
            router.push(published ? '/feed' : '/mis-relatos');
            router.refresh();
          }}
          onCancel={() => router.push('/feed')}
        />
      </section>
    </ProfileShell>
  );
}
