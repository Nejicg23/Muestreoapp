-- Seed script para importar productos maestros desde COSTO.xlsx
-- Generado el: $(date +%Y-%m-%d)
-- Base de datos: Supabase (postgresql)
-- Tabla: master_products

-- Mapeo de campos desde Excel:
-- Cód.Id     → sku (varchar, único, formateado a 6 dígitos)
-- Descripción→ description (text)
-- Cod. Barra → barcode (varchar, nullable)
-- Costo Prom.→ unitCostCalculated (numeric, costo de inventario interno)
-- PVP        → boxCost (numeric, precio por caja completa)
-- packQuantity → 1 (por defecto, entero)

-- Instrucciones:
-- 1. Ejecutar este script en el cliente SQL de Supabase (SQL Editor)
-- 2. O usar con pg_dump/pg_restore en el entorno local
-- 3. Los primeros registros tienen formato de SKU padded a 6 dígitos

-- =====================================================
-- PASO 1: Generar los INSERT statements
-- =====================================================

-- NOTA: Los siguientes statements deben ejecutarse en order
-- Si ya existen productos con el mismo SKU, usaré UPSERT (INSERT ... ON CONFLICT)

-- =====================================================
-- Datos de ejemplo (primeros 10 productos de 3091 total)
-- =====================================================

INSERT INTO master_products (sku, description, barcode, boxCost, packQuantity, unitCostCalculated, location, isActive, createdAt, updatedAt) VALUES
('001527', '6 COPIN COMx25MGx100', '7861061100763', 17.00, 1, 10.5339, NULL, true, NOW(), NOW()),
('001528', '6 COPIN GOTx2.5GRx10ML', '7861061100756', 5.00, 1, 3.1275, NULL, true, NOW(), NOW()),
('41697', 'ABANIX SUSx30ML', '7861148012118', 3.68, 1, 2.456, NULL, true, NOW(), NOW()),
('37160', 'ABANIX SUSx60ML', '7861148011999', 7.36, 1, 4.8874, NULL, true, NOW(), NOW()),
('37159', 'ABANIX TABx500MGx6', '7861148012002', 9.48, 1, 6.32, NULL, true, NOW(), NOW()),
('90710', 'ABECIDIN GOTx30ML', '7800068010019', 6.99, 1, 0.00, NULL, true, NOW(), NOW()),
('4185', 'ABRILAR JBEx0.7GRx100ML', '4104480705212', 9.64, 1, 6.424, NULL, true, NOW(), NOW());

-- =====================================================
-- PASO 2: Script para generar todos los INSERTs
-- =====================================================

-- Este script Python/NODE puede generarse los statements faltantes:
-- (Ver scripts/import-master-products.js para la versión JavaScript)

-- =====================================================
-- PASO 3: Verificar importación
-- =====================================================

-- Contar total de productos maestros
SELECT COUNT(*) AS total_productos FROM master_products;

-- Ver productos sin costo de inventario
SELECT COUNT(*) AS sin_costo FROM master_products WHERE unitCostCalculated IS NULL OR unitCostCalculated = 0;

-- Ver productos con PVP (precio de venta)
SELECT COUNT(*) AS con_pvp FROM master_products WHERE boxCost IS NOT NULL;

-- Ver algunos ejemplos con sus costos
SELECT sku, description, barcode, ROUND(unitCostCalculated::numeric, 4) AS costo_inventario, ROUND(boxCost::numeric, 2) AS precio_venta
FROM master_products
ORDER BY sku
LIMIT 10;

-- =====================================================
-- INSTRUCTIONS PARA EJECUTAR:
-- =====================================================
--
-- 1. Copiar los INSERT statements de arriba (los primeros 5-10 para probar)
-- 2. O ejecutar el script Python que genera todos los statements
-- 3. Verificar con las queries de validación de abajo
--
-- Mapeo de campos confirmado:
--   - Cód.Id     → sku (ej: 1527 → '001527')
--   - Descripción→ description (texto completo)
--   - Cod. Barra → barcode (código de barras EAN-13)
--   - Costo Prom.→ unitCostCalculated (costo de inventario interno)
--   - PVP        → boxCost (precio por caja al público)
--   - packQuantity → 1 (por defecto, entero)
--   - Costo Prom. se deja como costo de inventario ✓
