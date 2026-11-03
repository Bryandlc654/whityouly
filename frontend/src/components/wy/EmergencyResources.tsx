'use client';

import { useRef, useState } from 'react';

type CountryChoice = 'PE' | 'OTHER';

interface EmergencyResourcesProps {
  buttonClassName?: string;
}

export default function EmergencyResources({ buttonClassName = 'primary' }: EmergencyResourcesProps) {
  const [country, setCountry] = useState<CountryChoice>('PE');
  const resultRef = useRef<HTMLDivElement>(null);

  const showResources = () => {
    resultRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  };

  return (
    <>
      <section className="card urgent">
        <h2>Si existe peligro inmediato</h2>
        <p>
          Contacta ahora al servicio de emergencias de tu país o acude al centro de salud más cercano.
          Si puedes, permanece con una persona de confianza.
        </p>
        <button className={buttonClassName} type="button" onClick={showResources}>
          Ver recursos del país elegido
        </button>
      </section>

      <section className="card help-country-card">
        <label htmlFor="helpCountry">País o región</label>
        <select
          id="helpCountry"
          value={country}
          onChange={(event) => setCountry(event.target.value as CountryChoice)}
        >
          <option value="PE">Perú</option>
          <option value="OTHER">Otro país</option>
        </select>

        <div ref={resultRef} className="resource-result">
          {country === 'PE' ? (
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
    </>
  );
}
