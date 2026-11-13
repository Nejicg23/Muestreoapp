import ProductosNovedadesClient from './ProductosNovedadesClient';

export const dynamic = 'force-dynamic';

export default function ProductosNovedadesPage({
  params,
}: { params: { sessionId?: string } }) {
  // Si no hay sessionId, mostramos la página con datos vacíos o un mensaje
  const sessionId = params.sessionId || 'default-session';

  // Reporte de productos con novedades
  // Recibe sessionId y renderiza el cliente de reporte
  // Los datos se poblarán al integrarse con el sync real

  return <ProductosNovedadesClient sessionId={sessionId} consolidated={[]} onClose={() => {}} onExport={() => {}} />;
}
