import * as XLSX from 'xlsx';

export interface ParsedStock {
  packs: number;
  loose: number;
  rawString: string;
}

export interface FactorDetection {
  factor: number | null;
  confidence: 'high' | 'medium' | 'none';
  matchedText?: string;
}

export interface ImportIncidence {
  type: 'no_factor' | 'loose_exceeds_factor' | 'zero_stock' | 'invalid_id' | 'zero_cost';
  message: string;
  severity: 'warning' | 'error' | 'info';
}

export interface ParsedInventoryItem {
  rowId: number;
  sku: string;
  description: string;
  rawStock: string;
  packs: number;
  loose: number;
  factor: number;
  calculatedStock: number;
  boxCost: number; // Valor monetario en dólares del total de la caja
  unitCostCalculated: number; // Costo por fracción calculado automáticamente (boxCost / factor)
  rawValor?: string;
  location?: string;
  incidences: ImportIncidence[];
  isValid: boolean;
}

/**
 * Interpreta formatos de stock como:
 * - "2 u 5 f" o "2u5f" -> 2 unidades (enteras), 5 fracciones
 * - "2 u" -> 2 unidades, 0 fracciones
 * - "7 f" -> 0 unidades, 7 fracciones
 * - "-" o vacío -> 0 unidades, 0 fracciones
 * - "15" -> 0 unidades, 15 fracciones
 */
export function parseStockUnits(stockStr: string | null | undefined): ParsedStock {
  if (!stockStr) return { packs: 0, loose: 0, rawString: '' };

  const raw = String(stockStr).trim();
  const cleaned = raw.toLowerCase();

  if (cleaned === '-' || cleaned === '') {
    return { packs: 0, loose: 0, rawString: raw };
  }

  let packs = 0;
  let loose = 0;

  const uMatch = cleaned.match(/(\d+)\s*u/);
  const fMatch = cleaned.match(/(\d+)\s*f/);

  if (uMatch) packs = parseInt(uMatch[1], 10);
  if (fMatch) loose = parseInt(fMatch[1], 10);

  // Si solo viene un número directo sin sufijo u ni f
  if (!uMatch && !fMatch) {
    const num = parseFloat(cleaned);
    if (!isNaN(num)) {
      loose = num;
    }
  }

  return { packs, loose, rawString: raw };
}

/**
 * Interpreta el valor monetario en dólares (limpia $, USD, comas y espacios)
 */
export function parseValor(val: any): number {
  if (typeof val === 'number') return Math.max(0, val);
  if (!val) return 0;
  const str = String(val).replace(/[$€USD\s]/gi, '').replace(',', '.');
  const num = parseFloat(str);
  return isNaN(num) ? 0 : Math.max(0, num);
}

/**
 * Interpreta el factor de empaque a partir del nombre del producto.
 * Ejemplos:
 * - "Exforge Hct Comx5/160/12.5Mgx28" -> 28
 * - "Daflon Comx500Mgx30" -> 30
 * - "Dalivium Sol-Orx25Mg/10Mlx10 Sticks" -> 10
 * - "Diclofenaco Tabx50Mgx20 Mk" -> 20
 * - "Deblax Cap-Blax100.000Uix1" -> 1
 * - "Enema Fleet Adulto Fcox133Ml" -> null (No tiene factor de conteo, sólo volumen)
 */
export function extractPackagingFactor(productName: string | null | undefined): FactorDetection {
  if (!productName) return { factor: null, confidence: 'none' };

  const trimmed = String(productName).trim();

  // Separar los segmentos delimitados por 'x' o 'X'
  const parts = trimmed.split(/[xX]/);
  // Buscamos de atrás hacia adelante (el factor de unidades de conteo va al final)
  for (let i = parts.length - 1; i >= 1; i--) {
    const part = parts[i].trim();
    if (!part) continue;

    // Verificar si es una unidad de peso/volumen/concentración (mg, gr, ml, etc.)
    const isWeightVolume = /^\d+(?:\.\d+)?\s*(?:mg|g|gr|grs|gramos|mcg|ml|mls|l|lt|lts|litros|ui|cm|oz|kg|mm)\b/i.test(part);
    if (isWeightVolume) continue;

    // Extraer el número entero inicial del bloque
    const numMatch = part.match(/^(\d+)/);
    if (numMatch) {
      const factor = parseInt(numMatch[1], 10);
      if (factor > 0 && factor <= 5000) {
        return { factor, confidence: 'high', matchedText: `x${factor}` };
      }
    }
  }

  return { factor: null, confidence: 'none' };
}

/**
 * Procesa una fila de datos detectando en orden:
 * 1. id (código o SKU)
 * 2. stk-sis (stock desplegado por el sistema)
 * 3. producto (descripción del producto)
 * 4. valor (valor monetario total de la caja en dólares)
 */
export function processRawRow(
  rowId: number,
  idVal: string | number | undefined,
  stockVal: string | number | undefined,
  productVal: string | undefined,
  valorVal?: string | number | undefined
): ParsedInventoryItem {
  const sku = String(idVal || '').trim();
  const description = String(productVal || '').trim();
  const parsedStock = parseStockUnits(String(stockVal || ''));
  const factorInfo = extractPackagingFactor(description);

  const factor = factorInfo.factor !== null ? factorInfo.factor : 1;
  const incidences: ImportIncidence[] = [];

  // 4. Valor total por caja y cálculo de costo estimado por fracción
  const boxCost = parseValor(valorVal);
  const unitCostCalculated =
    factor > 0 && boxCost > 0
      ? Number((boxCost / factor).toFixed(4))
      : boxCost > 0
      ? boxCost
      : 1.0;

  if (!sku) {
    incidences.push({
      type: 'invalid_id',
      message: 'Fila sin ID / SKU de producto.',
      severity: 'error',
    });
  }

  if (factorInfo.factor === null) {
    incidences.push({
      type: 'no_factor',
      message: 'Factor de fracciones por unidad no detectado en el nombre. Se asumió 1 por defecto.',
      severity: 'warning',
    });
  } else if (parsedStock.loose >= factor && factor > 1) {
    incidences.push({
      type: 'loose_exceeds_factor',
      message: `Fracciones (${parsedStock.loose} f) iguales o mayores al factor por unidad (${factor}).`,
      severity: 'info',
    });
  }

  if (parsedStock.packs === 0 && parsedStock.loose === 0) {
    incidences.push({
      type: 'zero_stock',
      message: 'Stock inicial reportado en 0.',
      severity: 'info',
    });
  }

  const calculatedStock = parsedStock.packs * factor + parsedStock.loose;
  const isValid = sku.length > 0 && factor > 0;

  return {
    rowId,
    sku,
    description: description || 'Sin Descripción',
    rawStock: parsedStock.rawString || '-',
    packs: parsedStock.packs,
    loose: parsedStock.loose,
    factor,
    calculatedStock,
    boxCost,
    unitCostCalculated,
    rawValor: valorVal !== undefined ? String(valorVal).trim() : undefined,
    incidences,
    isValid,
  };
}

/**
 * Parsea un archivo Excel binario o ArrayBuffer
 */
export function parseExcelBuffer(buffer: ArrayBuffer): ParsedInventoryItem[] {
  const workbook = XLSX.read(buffer, { type: 'array' });
  const firstSheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[firstSheetName];

  // Convertir a matriz de filas
  const rawRows: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
  return parseRowsMatrix(rawRows);
}

/**
 * Parsea texto plano CSV / TSV
 */
export function parseCSVText(csvText: string): ParsedInventoryItem[] {
  const lines = csvText.trim().split(/\r?\n/);
  if (lines.length === 0) return [];

  // Detectar delimitador (coma, punto y coma o tabulación)
  const firstLine = lines[0];
  let delimiter = ',';
  if (firstLine.includes('\t')) delimiter = '\t';
  else if (firstLine.includes(';') && !firstLine.includes(',')) delimiter = ';';

  const rawRows: string[][] = lines.map((l) => {
    // Si contiene comillas dobles, separar respetando comillas
    if (l.includes('"')) {
      const result: string[] = [];
      let cur = '';
      let inQuotes = false;
      for (let i = 0; i < l.length; i++) {
        const c = l[i];
        if (c === '"') {
          inQuotes = !inQuotes;
        } else if (c === delimiter && !inQuotes) {
          result.push(cur.trim());
          cur = '';
        } else {
          cur += c;
        }
      }
      result.push(cur.trim());
      return result;
    }
    return l.split(delimiter).map((c) => c.trim());
  });

  return parseRowsMatrix(rawRows);
}

/**
 * Procesa una matriz de filas genéricas detectando en estricto orden de prioridad:
 * 1. id: código o sku
 * 2. stk-sis: stock desplegado por el sistema
 * 3. producto: descripción del producto
 * 4. valor: valor monetario en dólares del total de la caja
 */
export function parseRowsMatrix(rawRows: any[][]): ParsedInventoryItem[] {
  if (rawRows.length === 0) return [];

  let headerRowIndex = -1;
  let idColIndex = -1;
  let stockColIndex = -1;
  let productColIndex = -1;
  let valorColIndex = -1;

  // Buscar encabezados típicos en las primeras 5 filas
  for (let r = 0; r < Math.min(5, rawRows.length); r++) {
    const row = rawRows[r].map((cell) => String(cell || '').toLowerCase().trim());

    // 1. ID: código o sku del producto (buscar coincidencias exactas o parciales como "id nep", "id_producto", etc.)
    const idIdx = row.findIndex(
      (c) =>
        c === 'id' ||
        c.startsWith('id ') ||
        c.startsWith('id_') ||
        c.startsWith('id-') ||
        c.endsWith(' id') ||
        c === 'id nep' ||
        c.includes('sku') ||
        c.includes('codigo') ||
        c.includes('código') ||
        c.includes('cod') ||
        c.includes('ref') ||
        c.includes('referencia') ||
        c.includes('item')
    );

    // 2. STK-SIS: stock desplegado por el sistema (priorizar 'sis' / 'sistema' / 'teor' y EXCLUIR 'fis' / 'físico')
    let stockIdx = row.findIndex(
      (c) =>
        (c.includes('stk - sis') ||
          c.includes('stk-sis') ||
          c.includes('stksis') ||
          c.includes('sis') ||
          c.includes('teor')) &&
        !c.includes('fis')
    );

    if (stockIdx === -1) {
      stockIdx = row.findIndex(
        (c) => (c.includes('stock') || c.includes('stk')) && !c.includes('fis')
      );
    }

    // 3. PRODUCTO: descripción del producto
    const prodIdx = row.findIndex(
      (c) =>
        c.includes('producto') ||
        c.includes('descripcion') ||
        c.includes('descripción') ||
        c.includes('articulo') ||
        c.includes('artículo') ||
        c.includes('nombre') ||
        c.includes('detalle') ||
        c.includes('medicamento')
    );

    // 4. VALOR: valor monetario en dólares del total de la caja
    const valorIdx = row.findIndex(
      (c) =>
        c.includes('valor') ||
        c.includes('costo') ||
        c.includes('cost') ||
        c.includes('precio') ||
        c.includes('dolar') ||
        c.includes('dólar') ||
        c.includes('usd') ||
        c.includes('total caja') ||
        c.includes('caja')
    );

    // Si encontramos al menos (id y producto) o (id y stock) o (producto y stock)
    if (
      (idIdx !== -1 && prodIdx !== -1) ||
      (idIdx !== -1 && stockIdx !== -1) ||
      (prodIdx !== -1 && (stockIdx !== -1 || valorIdx !== -1))
    ) {
      headerRowIndex = r;
      idColIndex = idIdx !== -1 ? idIdx : (prodIdx === 0 ? 1 : 0);
      productColIndex = prodIdx !== -1 ? prodIdx : (idColIndex === 0 ? 1 : 0);
      stockColIndex = stockIdx;
      valorColIndex = valorIdx;
      break;
    }
  }

  // Detección automática inteligente cuando no hay encabezados explícitos o archivo de 2 columnas
  if (headerRowIndex === -1 && rawRows.length > 0) {
    const firstRow = rawRows[0];
    if (firstRow.length === 2) {
      const len0 = String(firstRow[0] || '').length;
      const len1 = String(firstRow[1] || '').length;
      if (len0 > len1) {
        productColIndex = 0;
        idColIndex = 1;
      } else {
        idColIndex = 0;
        productColIndex = 1;
      }
      stockColIndex = -1;
      valorColIndex = -1;
    } else {
      idColIndex = 0;
      stockColIndex = -1;
      productColIndex = -1;
      valorColIndex = -1;

      // Detectar columna de stock (coincide con patrón 2u5f o similar)
      for (let c = 0; c < firstRow.length; c++) {
        const val = String(firstRow[c] || '').toLowerCase().trim();
        if (val.match(/\d+\s*[uf]/)) {
          stockColIndex = c;
          break;
        }
      }

      // Detectar columna de valor ($ o número flotante)
      for (let c = 0; c < firstRow.length; c++) {
        if (c === stockColIndex || c === idColIndex) continue;
        const val = String(firstRow[c] || '').trim();
        if (val.includes('$') || val.match(/^\d+([.,]\d{1,4})?$/)) {
          const num = parseValor(val);
          if (num > 0) {
            valorColIndex = c;
            break;
          }
        }
      }

      // Detectar columna de descripción (texto más largo que no sea id, stock o valor)
      let maxLen = 0;
      for (let c = 0; c < firstRow.length; c++) {
        if (c === stockColIndex || c === idColIndex || c === valorColIndex) continue;
        const val = String(firstRow[c] || '').trim();
        if (val.length > maxLen) {
          maxLen = val.length;
          productColIndex = c;
        }
      }
      if (productColIndex === -1) {
        productColIndex = firstRow.length > 1 ? 1 : 0;
      }
    }
  }

  const startIndex = headerRowIndex >= 0 ? headerRowIndex + 1 : 0;
  const parsedItems: ParsedInventoryItem[] = [];

  for (let i = startIndex; i < rawRows.length; i++) {
    const row = rawRows[i];
    if (!row || row.length === 0 || row.every((cell) => !cell || String(cell).trim() === '')) {
      continue;
    }

    const idVal = idColIndex !== -1 ? row[idColIndex] : undefined;
    const stockVal = stockColIndex !== -1 ? row[stockColIndex] : undefined;
    const prodVal = productColIndex !== -1 ? row[productColIndex] : undefined;
    const valorVal = valorColIndex !== -1 ? row[valorColIndex] : undefined;

    const item = processRawRow(i + 1, idVal, stockVal, prodVal, valorVal);
    parsedItems.push(item);
  }

  return parsedItems;
}
