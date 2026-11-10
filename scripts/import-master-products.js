const { createClient } = require('@supabase/supabase-js');
const XLSX = require('xlsx');

// Configuración Supabase
const supabase = createClient(
  'https://nefidcjxqlpvbdykpfpv.supabase.cloud',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjI1MTY5OTgwMDAsImF0aSI6IjExZmU3ZTBkLTQ5NGItNDA5YS1hZWQxLWMwZDBiM2UxZjBhMyJ9'
);

async function importMasterProducts() {
  console.log('=== Importador de Productos Maestros desde Excel ===\n');
  
  // Leer archivo Excel
  const workbook = XLSX.readFile('/var/minis/attachments/uploads/COSTO.xlsx');
  const sheet = workbook.Sheets['Sheet1'];
  const rows = XLSX.utils.sheet_to_json(sheet);
  
  console.log(`Total de filas en Excel: ${rows.length}`);
  console.log('Columnas:', Object.keys(rows[0]));
  console.log('');
  
  // Mostrar muestra de datos
  console.log('=== Muestra de datos ===');
  rows.slice(0, 3).forEach((row, i) => {
    console.log(`Fila ${i}:`, JSON.stringify(row));
  });
  console.log('');
  
  // Preparar datos para importación
  const productsToImport = rows.map(row => ({
    // Cód.Id (número entero) -> sku (varchar único)
    sku: String(row['Cód.Id']).padStart(6, '0'),
    
    // Descripción -> description (texto)
    description: String(row['Descripción']) || null,
    
    // Cod. Barra -> barcode (varchar)
    barcode: String(row['Cod. Barra']) || null,
    
    // Costo Prom. -> unitCostCalculated (costo de inventario interno)
    // El usuario especificó: "dejando el costo promedio como costo de inventario"
    unitCostCalculated: typeof row['Costo Prom.'] === 'number' ? Number(row['Costo Prom.'].toFixed(4)) : null,
    
    // PVP -> boxCost (precio por caja completa)
    // Si no tenemos packQuantity, establecemos boxCost = unitCostCalculated * 1 (unidad por caja)
    // O dejamos null para que se complete después
    boxCost: typeof row['PVP'] === 'number' ? Number(row['PVP'].toFixed(2)) : null,
    
    // packQuantity -> factor de empaque (por defecto 1)
    // Los datos Excel no traen esta información, usamos 1 por defecto
    packQuantity: 1,
    
    // Estado activo por defecto
    isActive: true,
    
    // Timestamps
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }));
  
  console.log('=== Datos preparados para importar ===');
  console.log('Muestra primer producto:', JSON.stringify(productsToImport[0], null, 2));
  console.log('');
  
  // Importar a Supabase
  console.log('=== Iniciando importación a Supabase ===');
  
  const batchSize = 100;
  let successCount = 0;
  let errorCount = 0;
  let skippedCount = 0;
  
  for (let i = 0; i < productsToImport.length; i += batchSize) {
    const batch = productsToImport.slice(i, i + batchSize);
    
    try {
      const { error, data } = await supabase
        .from('master_products')
        .upsert(batch, { onConflict: 'sku' });
      
      if (error) {
        errorCount++;
        console.error(`Lote ${i/batchSize + 1} ERROR:`, error.message);
      } else {
        successCount += batch.length;
        console.log(`Lote ${i/batchSize + 1}: ${batch.length} productos importados exitosamente (total: ${successCount})`);
      }
    } catch (err) {
      errorCount++;
      console.error(`Lote ${i/batchSize + 1} EXCEPCIÓN:`, err.message);
    }
  }
  
  console.log('\n=== RESUMEN FINAL ===');
  console.log(`Total productos Excel: ${rows.length}`);
  console.log(`Importados/Actualizados: ${successCount}`);
  console.log(`Errores: ${errorCount}`);
  console.log('');
  console.log('✅ Importación completada');
  console.log('');
  console.log('Mapeo de campos:');
  console.log('  - Cód.Id     → sku');
  console.log('  - Descripción→ description');
  console.log('  - Cod. Barra → barcode');
  console.log('  - Costo Prom.→ unitCostCalculated (costo de inventario)');
  console.log('  - PVP        → boxCost (precio por caja)');
  console.log('  - packQuantity → 1 (por defecto, puede actualizarse después)');
}

importMasterProducts().catch(err => {
  console.error('Error fatal en la importación:', err);
  process.exit(1);
});
