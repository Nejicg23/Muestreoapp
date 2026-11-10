const fs = require('fs');
const XLSX = require('xlsx');

const excelPath = '/var/minis/attachments/uploads/COSTO.xlsx';
const sqlPath = '/var/minis/workspace/Muestreoapp/scripts/master-products-insert.sql';

try {
    const workbook = XLSX.readFile(excelPath);
    const sheet = workbook.Sheets['Sheet1'];
    // Get rows as arrays with headers
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });
    
    const headers = rows[0];  // ['Cód.Id', 'Descripción', 'PVP', 'Costo Prom.', 'Cto.Ult.Com.', 'Cod. Barra']
    const dataRows = rows.slice(1);  // All rows except headers
    
    console.log('Headers:', headers);
    console.log('Data rows:', dataRows.length);
    console.log('');
    
    let inserts = [];
    let skipped = 0;
    
    for (let i = 0; i < dataRows.length; i++) {
        const row = dataRows[i];
        
        // Saltar filas vacías (solo si no hay datos significativos)
        if (!row || row.length < 3) {
            skipped++;
            continue;
        }
        
        // Extraer datos por posición
        const skuRaw = row[0];       // Cód.Id - número entero
        const description = row[1];  // Descripción - texto
        const pvp = row[2];          // PVP - número
        const costoProm = row[3];    // Costo Prom. - número
        const barcode = row[5];      // Cod. Barra - texto/código
        
        // Validar que tenga datos mínimos
        if (!skuRaw && !description) {
            skipped++;
            continue;
        }
        
        // Formatear SKU: número entero a string padded a 6 dígitos
        let sku = null;
        if (skuRaw !== null && skuRaw !== undefined) {
            try {
                sku = String(Math.round(skuRaw)).padStart(6, '0');
                // Validar que tenga 6 dígitos o menos
                if (sku.length > 6) sku = sku.substring(sku.length - 6);
            } catch (e) {
                sku = null;
            }
        }
        
        // Formatear descripción
        let desc = null;
        if (description !== null && description !== undefined) {
            desc = String(description).trim();
            if (desc.length === 0) desc = null;
        }
        
        // Formatear PVP a boxCost (2 decimales)
        let boxCost = null;
        if (pvp !== null && pvp !== undefined) {
            try {
                boxCost = Number(pvp).toFixed(2);
            } catch (e) {
                boxCost = null;
            }
        }
        
        // Formatear Costo Prom a unitCostCalculated (4 decimales)
        let unitCostCalculated = null;
        if (costoProm !== null && costoProm !== undefined) {
            try {
                unitCostCalculated = Number(costoProm).toFixed(4);
            } catch (e) {
                unitCostCalculated = null;
            }
        }
        
        // Formatear código de barras
        let barCode = null;
        if (barcode !== null && barcode !== undefined) {
            barCode = String(barcode).trim();
            if (barCode.length === 0) barCode = null;
        }
        
        // Generar statement SQL INSERT
        const skuSql = sku !== null ? `'${sku}'` : 'NULL';
        const descSql = desc !== null ? `'${desc.replace(/'/g, "''")}'` : 'NULL';
        const barcodeSql = barCode !== null ? `'${barCode}'` : 'NULL';
        const costSql = unitCostCalculated !== null ? unitCostCalculated : 'NULL';
        const pvpSql = boxCost !== null ? boxCost : 'NULL';
        
        const sql = `INSERT INTO master_products (sku, description, barcode, boxCost, packQuantity, unitCostCalculated, location, isActive, createdAt, updatedAt) VALUES (${skuSql}, ${descSql}, ${barcodeSql}, ${pvpSql}, 1, ${costSql}, NULL, true, NOW(), NOW());`;
        inserts.push(sql);
    }
    
    // Escribir archivo SQL
    const sqlContent = `-- Generated from COSTO.xlsx import\n-- Total rows: ${dataRows.length}\n-- Skipped rows: ${skipped}\n-- Field mapping:\n--   Cód.Id     → sku (varchar, padded 6 digits)\n--   Descripción→ description (text)\n--   PVP        → boxCost (numeric, precio venta al público)\n--   Costo Prom.→ unitCostCalculated (numeric, costo inventario interno)\n--   Cod. Barra → barcode (varchar, EAN-13)\n--   packQuantity → 1 (por defecto, entero)\n--   location   → NULL (por defecto, completar después)\n--   isActive   → true (por defecto)\n--   Timestamps → NOW() por defecto\n\n`;
    fs.writeFileSync(sqlPath, sqlContent + inserts.join('\n'));
    
    console.log(`\n✅ Archivo SQL generado: ${sqlPath}`);
    console.log(`   Statements INSERT: ${inserts.length}`);
    console.log(`   Filas saltadas: ${skipped}`);
    console.log(`   Rows procesadas: ${dataRows.length}`);
    
    // Mostrar primeras 3 insert statements
    console.log('\n--- Primeros 3 statements ---');
    console.log(inserts.slice(0, 3).join('\n'));
    
    // Mostrar últimas 3 insert statements
    console.log('\n--- Últimos 3 statements ---');
    console.log(inserts.slice(-3).join('\n'));
    
} catch (err) {
    console.error('Error:', err.message);
    console.error(err.stack);
}
