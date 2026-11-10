'use client';

import { useRouter } from 'next/navigation';
import ProfileShell from '@/components/wy/ProfileShell';
import EmergencyResources from '@/components/wy/EmergencyResources';

export default function EmergencyResourcesPage() {
  const router = useRouter();

  return (
    <ProfileShell>
      <section className="screen help-v58 urgent-help-page">
        <div className="screen-back">
          <button className="ghost" type="button" onClick={() => router.push('/ayuda')}>
            ← Ayuda y seguridad
          </button>
          <div>
            <h1>Recursos de ayuda inmediata</h1>
            <p>Withyouly no reemplaza una respuesta profesional o de emergencia.</p>
          </div>
        </div>

        <EmergencyResources />

        <div className="tip">
          No publiques información privada ni esperes una respuesta del feed si tú o alguien está en
          peligro.
        </div>
      </section>
    </ProfileShell>
  );
}
