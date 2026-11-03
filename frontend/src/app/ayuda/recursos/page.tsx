'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Icon from '@/components/wy/Icon';
import ProfileShell from '@/components/wy/ProfileShell';

type CountryChoice = 'PE' | 'OTHER';

export default function EmergencyResourcesPage() {
  const router = useRouter();
  const [country, setCountry] = useState<CountryChoice>('PE');
  const [shown, setShown] = useState(false);
  const resultRef = useRef<HTMLDivElement>(null);

  const showResources = () => {
    setShown(true);
    window.setTimeout(() => resultRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' }), 50);
  };

  return (
    <ProfileShell>
      <section className="screen help-v58 urgent-help-page">
        <div className="screen-back">
          <button className="ghost" type="button" onClick={() => router.push('/ayuda')}>
            <Icon name="chevron" /> Ayuda y seguridad
          </button>
          <div>
            <h1>Recursos de ayuda inmediata</h1>
            <p>Withyouly no reemplaza una respuesta profesional o de emergencia.</p>
          </div>
        </div>

        <section className="card urgent">
          <h2>Si existe peligro inmediato</h2>
          <p>
            Contacta ahora al servicio de emergencias de tu país o acude al centro de salud más cercano.
            Si puedes, permanece con una persona de confianza.
          </p>
          <button className="primary" type="button" onClick={showResources}>
            Mostrar opciones de mi región
          </button>
        </section>

        <section className="card help-country-card">
          <label htmlFor="helpCountry">País o región</label>
          <select
            id="helpCountry"
            value={country}
            onChange={(event) => {
              setCountry(event.target.value as CountryChoice);
              setShown(false);
            }}
          >
            <option value="PE">Perú</option>
            <option value="OTHER">Otro país</option>
          </select>

          <div ref={resultRef} className="resource-result">
            {!shown ? (
              <>
                <b>Selecciona tu país y muestra las opciones</b>
                <p>
                  Solo mostraremos recursos oficiales cuando estén disponibles para la región elegida.
                </p>
              </>
            ) : country === 'PE' ? (
              <>
                <b>Perú · Línea 113 Salud</b>
                <p>
                  Servicio de información y orientación en salud del Ministerio de Salud, incluida
                  orientación en salud mental.
                </p>
                <a
                  className="text-link"
                  href="https://www.gob.pe/555"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Consultar información oficial de Línea 113 Salud
                </a>
              </>
            ) : (
              <>
                <b>No hay un directorio internacional verificado</b>
                <p>
                  Contacta el número oficial de emergencias de tu país o acude al centro de salud más
                  cercano. No esperes una respuesta de la comunidad si existe peligro inmediato.
                </p>
              </>
            )}
          </div>
        </section>

        <div className="tip">
          No publiques información privada ni esperes una respuesta del feed si tú o alguien está en
          peligro.
        </div>
      </section>
    </ProfileShell>
  );
}
