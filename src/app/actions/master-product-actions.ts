import { db } from '@/db';
import { masterProducts } from '@/db/schema';

// 1. Listar productos de la base madre (solo activos por defecto)
export async function listMasterProducts(activeOnly: boolean = true) {
  const condition = activeOnly ? { isActive: true } : {};
  // Usamos any en el where para evadir tipos estrictos de Drizzle
  const data: any[] = await db.select().from(masterProducts).where(condition as any);
  
  const result: any[] = [];
  for (const p of data) {
    result.push({
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
    });
  }
  return result;
}

// 2. Crear nuevo producto en la base madre
export async function createMasterProduct(data: any) {
  const [created]: any[] = await db.insert(masterProducts).values({
    sku: data.sku,
    description: data.description,
    barcode: data.barcode,
    boxCost: data.boxCost,
    packQuantity: data.packQuantity,
    unitCostCalculated: data.unitCostCalculated,
    location: data.location,
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
  const results: any[] = [];

  for (const item of importedItems) {
    // Buscar coincidencia exacta por SKU
    const exactMatch: any[] = await db.select().from(masterProducts).where({ sku: item.sku, isActive: true } as any).limit(1);
    
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

    // Búsqueda difusa por descripción - filtrado en JS
    const allMatches: any[] = await db.select().from(masterProducts).where({ isActive: true } as any);
    const fuzzyMatches = allMatches.filter((mp: any) =>
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
