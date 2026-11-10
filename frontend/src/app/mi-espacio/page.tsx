import { redirect } from 'next/navigation';

/**
 * En v58, «Mi espacio» abre directamente Mi diario (ruta `mood`), con las
 * pestañas Mi diario · Mis emociones · Cuidarme · Mi árbol · Cápsulas.
 * Esta ruta se conserva solo para que los enlaces antiguos sigan funcionando.
 */
export default function MiEspacioPage() {
  redirect('/mi-diario');
}
