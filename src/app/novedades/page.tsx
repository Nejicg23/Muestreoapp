import { redirect } from 'next/navigation';

export default function NovedadesPage() {
  redirect('/inventario-rapido?mode=novedades');
}
