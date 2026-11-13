import React from 'react';

export default function ProductosNovedadesClient({
  sessionId,
  consolidated,
  onClose,
  onExport,
}: {
  sessionId: string;
  consolidated: any[];
  onClose: () => void;
  onExport: (data: any) => void;
}) {
  // Filtrar ítems con novedad (físico solo, sin comparación sistema)
  const novedades = consolidated.filter(
    (item) => item.hasPhysicalCount && item.noveltyType
  );

  // Ítems sin novedad (solo conteo físico)
  const sinNovedad = consolidated.filter(
    (item) => item.hasPhysicalCount && !item.noveltyType
  );

  const handleRegistrarFisico = (itemId: string, data: {
    noveltyType: string;
    batchNumber: string;
    expirationDate: string;
    notes?: string;
  }) => {
    // Lógica para registrar ítem con novedad
    console.log('Registrando físico para ítem:', itemId, data);
    onExport(data);
  };

  return (
    <div className="min-h-screen bg-slate-950 p-6">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 mb-6">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-black text-white">
            📋 Reporte de Productos con Novedades
          </h1>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-sm transition-colors"
          >
            ← Cerrar
          </button>
        </div>
      </div>

      {/* Resumen */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-slate-800 rounded-xl p-4">
          <p className="text-[11px] text-slate-400 font-medium">Total Ítems</p>
          <p className="text-2xl font-bold text-white mt-1">{consolidated.length}</p>
        </div>
        <div className="bg-slate-800 rounded-xl p-4">
          <p className="text-[11px] text-cyan-400 font-medium">Con Novedad</p>
          <p className="text-2xl font-bold text-cyan-300 mt-1">{novedades.length}</p>
        </div>
        <div className="bg-slate-800 rounded-xl p-4">
          <p className="text-[11px] text-yellow-400 font-medium">Sin Novedad</p>
          <p className="text-2xl font-bold text-yellow-300 mt-1">{sinNovedad.length}</p>
        </div>
        <div className="bg-slate-800 rounded-xl p-4">
          <p className="text-[11px] text-green-400 font-medium">% Cobertura</p>
          <p className="text-2xl font-bold text-green-300 mt-1">
            {consolidated.length > 0 ? `${((novedades.length / consolidated.length) * 100).toFixed(1)}%` : '0%'}
          </p>
        </div>
      </div>

      {/* Tabla de Ítems con Novedad */}
      <div className="bg-slate-900 rounded-2xl overflow-hidden mb-6">
        <div className="p-4 border-b border-slate-700/50">
          <h2 className="text-[11px] font-bold text-cyan-300 uppercase tracking-wider">
            Ítems con Novedad (Físico Solo)
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead>
              <tr className="border-b border-slate-700/50">
                <th className="text-[10px] text-slate-400 p-2 w-24">SKU</th>
                <th className="text-[10px] text-slate-400 p-2 w-48">Descripción</th>
                <th className="text-[10px] text-slate-400 p-2">Novedad</th>
                <th className="text-[10px] text-slate-400 p-2 w-32">Lote</th>
                <th className="text-[10px] text-slate-400 p-2 w-40">Vence</th>
                <th className="text-[10px] text-slate-400 p-2">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {novedades.map((item) => {
                const physicalItem = item.physicalData;
                return (
                  <tr key={item.id} className="border-b border-slate-700/30">
                    <td className="text-[10px] p-2">{physicalItem?.sku || 'N/A'}</td>
                    <td className="text-[10px] p-2">
                      {physicalItem?.description?.substring(0, 25) ||
                        'N/A'}{' '}{physicalItem?.description?.length > 25 ? '...' : ''}
                    </td>
                    <td className="text-[10px] p-2">
                      <span
                        className={`px-2 py-1 rounded text-[10px] font-medium ${
                          item.noveltyType === 'mermade'
                            ? 'bg-red-500/20 text-red-300'
                            : item.noveltyType === 'extra'
                            ? 'bg-cyan-500/20 text-cyan-300'
                            : 'bg-slate-700/50 text-slate-300'
                        }`}
                      >
                        {item.noveltyType}
                      </span>
                    </td>
                    <td className="text-[10px] p-2">{physicalItem?.batchNumber || 'N/A'}</td>
                    <td className="text-[10px] p-2">
                      {physicalItem?.expirationDate
                        ? new Date(physicalItem.expirationDate).toLocaleDateString('es-ES')
                        : 'N/A'}
                    </td>
                    <td className="text-[10px] p-2">
                      <button
                        className="px-2 py-1 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-[10px] text-white transition-colors"
                        onClick={() => handleRegistrarFisico(item.id, {
                          noveltyType: item.noveltyType,
                          batchNumber: physicalItem?.batchNumber || '',
                          expirationDate: physicalItem?.expirationDate || '',
                          notes: physicalItem?.notes || '',
                        })}
                      >
                        Actualizar
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Ítems sin novedad - conteo físico solo */}
      <div className="bg-slate-900 rounded-2xl overflow-hidden">
        <div className="p-4 border-b border-slate-700/50">
          <h2 className="text-[11px] font-bold text-yellow-300 uppercase tracking-wider">
            Ítems sin Novedad (Conteo Físico)
          </h2>
        </div>
        <div className="p-4">
          <p className="text-[10px] text-slate-400">
            Estos ítems tienen solo registro físico, sin etiqueta de novedad asignada.
          </p>
          <div className="mt-3">
            <button
              className="px-3 py-2 rounded-xl bg-slate-700 hover:bg-slate-600 text-[10px] text-white transition-colors"
              onClick={onClose}
            >
              ← Volver al inventario
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}