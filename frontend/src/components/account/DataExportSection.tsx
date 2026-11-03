'use client';

import { useState } from 'react';
import { exportAccountData } from '@/lib/account';
import Icon from '@/components/wy/Icon';

export default function DataExportSection() {
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const download = async () => {
    if (exporting) return;

    setExporting(true);
    setError('');
    setNotice('');

    const result = await exportAccountData();
    setExporting(false);

    if (result.status !== 'ok') {
      setError(result.message);
      return;
    }

    const url = URL.createObjectURL(result.data.blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = result.data.filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    setNotice('Copia de tus datos descargada.');
  };

  return (
    <section className="control-card card">
      <div className="control-card-head">
        <span>
          <Icon name="book" />
        </span>
        <div>
          <h2>Descargar mis datos</h2>
          <p>Prepara una copia de tus relatos, comentarios, registros y cápsulas.</p>
        </div>
      </div>

      {error ? (
        <p className="auth-error" role="alert" style={{ marginBottom: 0 }}>
          {error}
        </p>
      ) : null}

      {notice ? (
        <p className="auth-success" role="status" style={{ marginBottom: 0 }}>
          {notice}
        </p>
      ) : null}

      <button className="secondary" type="button" onClick={() => void download()} disabled={exporting}>
        <Icon name="book" /> {exporting ? 'Preparando…' : 'Solicitar archivo privado'}
      </button>
    </section>
  );
}
