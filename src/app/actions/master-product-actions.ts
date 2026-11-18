'use server';

import { db } from '@/db';
import { masterProducts } from '@/db/schema';
import { getCurrentUser } from '@/lib/auth';
import { eq, and } from 'drizzle-orm';

// 1. Listar productos de la base madre (solo activos por defecto)
export async function listMasterProducts(activeOnly: boolean = true) {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error('No autorizado');
  }

  const query = activeOnly
    ? db.select().from(masterProducts).where(eq(masterProducts.isActive, true))
    : db.select().from(masterProducts);

  const data = await query;
  
  return data.map((p) => ({
    id: p.id,
    sku: p.sku,
    description: p.description,
    barcode: p.barcode,
    boxCost: Number(p.boxCost),
    packQuantity: p.packQuantity,
    unitCostCalculated: p.unitCostCalculated ? Number(p.unitCostCalculated) : undefined,
    location: p.location,
    isActive: p.isActive,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  }));
}

// 2. Crear nuevo producto en la base madre
export async function createMasterProduct(data: {
  sku: string;
  description: string;
  barcode?: string;
  boxCost: number;
  packQuantity: number;
  unitCostCalculated?: number;
  location?: string;
  isActive?: boolean;
}) {
  const user = await getCurrentUser();
  if (!user || user.role !== 'admin') {
    throw new Error('Acceso no autorizado. Se requieren permisos de administrador.');
  }

  const sku = data.sku.trim();
  const description = data.description.trim();
  const boxCost = Number(data.boxCost);
  const packQuantity = parseInt(String(data.packQuantity || '1'), 10);

  if (!sku || !description || isNaN(boxCost) || boxCost < 0 || isNaN(packQuantity) || packQuantity <= 0) {
    throw new Error('Datos inválidos para creación de producto maestro.');
  }

  const unitCostCalculated = boxCost > 0 && packQuantity > 0 ? (boxCost / packQuantity).toFixed(4) : undefined;

  const [created] = await db.insert(masterProducts).values({
    sku,
    description,
    barcode: data.barcode?.trim() || undefined,
    boxCost: boxCost.toString(),
    packQuantity,
    unitCostCalculated: data.unitCostCalculated ? data.unitCostCalculated.toString() : unitCostCalculated,
    location: data.location?.trim() || undefined,
    isActive: data.isActive ?? true,
    createdAt: new Date(),
    updatedAt: new Date(),
  }).returning();
  
  return {
    ...created,
    boxCost: Number(created.boxCost),
    unitCostCalculated: created.unitCostCalculated ? Number(created.unitCostCalculated) : undefined,
  };
}

// 3. Comparar items importados contra la base madre
export async function compareImportedItemsWithMaster(
  importedItems: Array<{
    sku: string;
    description: string;
    boxCost: number;
    packQuantity: number;
  }>
) {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error('No autorizado');
  }

  const results: any[] = [];

  for (const item of importedItems) {
    // Buscar coincidencia exacta por SKU con operador de Drizzle correcto
    const exactMatch = await db
      .select()
      .from(masterProducts)
      .where(and(eq(masterProducts.sku, item.sku), eq(masterProducts.isActive, true)))
      .limit(1);
    
    if (exactMatch && exactMatch.length > 0) {
      results.push({
        masterProduct: {
          ...exactMatch[0],
          boxCost: Number(exactMatch[0].boxCost),
          unitCostCalculated: exactMatch[0].unitCostCalculated ? Number(exactMatch[0].unitCostCalculated) : undefined,
        },
        importedItem: item,
        matchType: 'exact_sku',
      });
      continue;
    }

    // Búsqueda difusa por descripción
    const allMatches = await db
      .select()
      .from(masterProducts)
      .where(eq(masterProducts.isActive, true));

    const fuzzyMatches = allMatches.filter((mp) =>
      mp.description.toLowerCase().includes(item.description.toLowerCase())
    );

    if (fuzzyMatches.length > 0) {
      results.push({
        masterProduct: {
          ...fuzzyMatches[0],
          boxCost: Number(fuzzyMatches[0].boxCost),
          unitCostCalculated: fuzzyMatches[0].unitCostCalculated ? Number(fuzzyMatches[0].unitCostCalculated) : undefined,
        },
        importedItem: item,
        matchType: 'fuzzy_description',
      });
      continue;
    }

    // No hay coincidencia
    results.push({
      masterProduct: null,
      importedItem: item,
      matchType: 'no_match',
    });
  }

  return results;
}
