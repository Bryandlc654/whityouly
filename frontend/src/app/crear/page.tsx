'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { tokenStorage } from '@/lib/auth';
import StoryForm from '@/components/wy/StoryForm';
import ProfileShell from '@/components/wy/ProfileShell';

export default function CreateStoryPage() {
  const router = useRouter();

  useEffect(() => {
    if (!tokenStorage.getAccess()) router.replace('/login');
  }, [router]);

  return (
    <ProfileShell>
      <section className="screen create-story-screen">
        <div className="screen-heading">
          <div>
            <h1>Comparte tu relato</h1>
            <p>Elige texto, tarjeta visual o audio. Puedes guardarlo como borrador.</p>
          </div>
          <button className="ghost" type="button" onClick={() => router.push('/feed')}>
            Volver al feed
          </button>
        </div>
        <section className="card create-story-card">
          <StoryForm
            onCreated={(_story, published) => {
              router.push(published ? '/feed' : '/mis-relatos');
              router.refresh();
            }}
            onCancel={() => router.push('/feed')}
          />
        </section>
      </section>
    </ProfileShell>
  );
}
