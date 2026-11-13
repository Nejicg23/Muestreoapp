import ProductosNovedadesClient from './ProductosNovedadesClient';

export const dynamic = 'force-dynamic';

export default function ProductosNovedadesPage({
  params,
}: { params: { sessionId: string } }) {
  // Reporte de productos con novedades
  // Recibe sessionId y renderiza el cliente de reporte
  // Los datos se poblarán al integrarse con el sync real

  return <ProductosNovedadesClient sessionId={params.sessionId} consolidated={[]} onClose={() => {}} onExport={() => {}} />;
}