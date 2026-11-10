#!/usr/bin/env python3
"""
Generador de statements SQL INSERT para importar productos maestros
desde el archivo Excel COSTO.xlsx a la tabla master_products de Supabase.
"""

import openpyxl
import json
from pathlib import Path

def main():
    excel_path = Path('/var/minis/attachments/uploads/COSTO.xlsx')
    sql_path = Path('/var/minis/workspace/Muestreoapp/scripts/master-products-insert.sql')
    
    # Leer Excel
    wb = openpyxl.load_workbook(excel_path, data_only=True)
    ws = wb.active
    
    # Obtener encabezados
    headers = []
    for cell in ws[1]:
        headers.append(cell.value)
    
    print(f"Encabezados encontrados: {headers}")
    print(f"Total filas: {ws.max_row - 1}\n")
    
    # Generar statements INSERT
    inserts = []
    skipped = 0
    
    for row_idx in range(2, ws.max_row + 1):  # Empezar en 2 para saltar encabezados
        row_data = {}
        for col_idx, header in enumerate(headers, 1):
            cell_value = ws.cell(row=row_idx, column=col_idx).value
            if cell_value is not None:
                row_data[header] = cell_value
            else:
                row_data[header] = None
        
        # Saltar filas vacías
        if not row_data.get('Cód.Id') and not row_data.get('Descripción'):
            skipped += 1
            continue
        
        # Formatear datos
        try:
            sku_raw = row_data.get('Cód.Id')
            sku = str(sku_raw).zfill(6) if sku_raw and str(sku_raw).strip() else None
            
            description = str(row_data.get('Descripción')).strip() if row_data.get('Descripción') else None
            barcode = str(row_data.get('Cod. Barra')).strip() if row_data.get('Cod. Barra') else None
            
            # Costo Prom -> unitCostCalculated (costo de inventario)
            costo_prom = row_data.get('Costo Prom.')
            unit_cost_calculated = None
            if costo_prom is not None:
                try:
                    unit_cost_calculated = round(float(costo_prom), 4)
                except (ValueError, TypeError):
                    unit_cost_calculated = None
            
            # PVP -> boxCost (precio por caja)
            pvp = row_data.get('PVP')
            box_cost = None
            if pvp is not None:
                try:
                    box_cost = round(float(pvp), 2)
                except (ValueError, TypeError):
                    box_cost = None
            
            # Formatear SQL values
            sku_sql = f"'{sku}'" if sku else 'NULL'
            desc_sql = f"'{description}'" if description else 'NULL'
            barcode_sql = f"'{barcode}'" if barcode else 'NULL'
            cost_sql = f"{unit_cost_calculated}" if unit_cost_calculated is not None else 'NULL'
            pvp_sql = f"{box_cost}" if box_cost is not None else 'NULL'
            
            # Statement INSERT
            sql = f"INSERT INTO master_products (sku, description, barcode, boxCost, packQuantity, unitCostCalculated, location, isActive, createdAt, updatedAt) VALUES ({sku_sql}, {desc_sql}, {barcode_sql}, {pvp_sql}, 1, {cost_sql}, NULL, true, NOW(), NOW());"
            inserts.append(sql)
            
            if row_idx <= 5:  # Mostrar primeras 5
                print(f"Fila {row_idx}: SKU={sku}, Desc={description[:30] if description else 'N/A'}, Costo={unit_cost_calculated}, PVP={box_cost}")
                
        except Exception as e:
            print(f"Error en fila {row_idx}: {e}")
            skipped += 1
            continue
    
    # Escribir archivo SQL
    with open(sql_path, 'w', encoding='utf-8') as f:
        f.write("-- Generated from COSTO.xlsx import\n")
        f.write(f"-- Total rows: {ws.max_row - 1 - skipped}\n")
        f.write(f"-- Skipped rows: {skipped}\n")
        f.write("\n")
        for sql in inserts:
            f.write(sql + "\n")
    
    print(f"\n✅ Archivo SQL generado: {sql_path}")
    print(f"   Statements INSERT: {len(inserts)}")
    print(f"   Filas saltadas: {skipped}")
    
    # Mostrar estadísticas
    print(f"\n--- Estadísticas ---")
    print(f"First SKU: {inserts[0] if inserts else 'N/A'}")
    print(f"Last SKU: {inserts[-1] if inserts else 'N/A'}")

if __name__ == '__main__':
    main()
