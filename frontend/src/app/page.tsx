import { redirect } from 'next/navigation';

// V58 usa la pantalla de acceso como portada (ruta welcome).
// La landing publica del proyecto queda disponible en /presentacion.
export default function Home() {
  redirect('/login');
}
