import { db } from '@/db';
import { masterProducts } from '@/db/schema';
import { eq, ilike, desc } from 'drizzle-orm';

export interface MasterProduct {
    id: string;
    sku: string;
    barcode: string | null;
    description: string;
    boxCost: number;
    packQuantity: number;
    unitCostCalculated: number;
    location: string | null;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
}

export interface MasterProductMatch {
    masterProduct: MasterProduct | null;
    importedItem: {
        sku: string;
        description: string;
        boxCost?: number;
        packQuantity?: number;
    };
    matchType: 'exact_sku' | 'barcode' | 'fuzzy_description' | 'no_match';
}

export async function listMasterProducts(activeOnly: boolean = true): Promise<MasterProduct[]> {
    const data = await db.select().from(masterProducts).orderBy(desc(masterProducts.createdAt));
    return data.map(p => ({
        ...p,
        boxCost: Number(p.boxCost),
        unitCostCalculated: Number(p.unitCostCalculated ?? 0),
    })) as MasterProduct[];
}

export async function createMasterProduct(data: {
    sku: string;
    description: string;
    boxCost: number;
    packQuantity?: number;
    barcode?: string;
    location?: string;
}): Promise<MasterProduct> {
    const [result] = await db.insert(masterProducts).values({
        sku: data.sku,
        description: data.description,
        boxCost: String(data.boxCost),
        packQuantity: data.packQuantity ?? 1,
        barcode: data.barcode ?? null,
        location: data.location ?? null,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
    }).returning();
    return {
        ...result,
        boxCost: Number(result.boxCost),
        unitCostCalculated: Number(result.unitCostCalculated ?? 0),
    } as MasterProduct;
}

export async function compareImportedItemsWithMaster(
    items: Array<{ sku?: string; barcode?: string; description: string }>
): Promise<MasterProductMatch[]> {
    const matches: MasterProductMatch[] = [];

    for (const item of items) {
        // Declarar match al inicio para que TypeScript sepa que siempre existe al final
        let match: MasterProductMatch;

        let matchType: 'exact_sku' | 'barcode' | 'fuzzy_description' | 'no_match' = 'no_match';
        let mp: MasterProduct | null = null;
        let skuVal = item.sku || '';
        let descVal = item.description || '';

        // 1. Intentar coincidencia exacta por SKU
        if (item.sku) {
            const product = await db.select().from(masterProducts).where(eq(masterProducts.sku, item.sku)).limit(1);
            if (product.length > 0) {
                const p = product[0];
                mp = {
                    ...p,
                    boxCost: Number(p.boxCost),
                    unitCostCalculated: Number(p.unitCostCalculated ?? 0),
                } as MasterProduct;
                matchType = 'exact_sku';
                skuVal = item.sku;
                descVal = item.description || '';
            }
        }

        // 2. Si no hay coincidencia por SKU, intentar por descripción (búsqueda difusa simple)
        if (matchType !== 'exact_sku' && item.description) {
            const products = await db.select().from(masterProducts).where(ilike(masterProducts.description, `%${item.description}%`)).limit(5);
            if (products.length > 0) {
                const p = products[0];
                mp = {
                    ...p,
                    boxCost: Number(p.boxCost),
                    unitCostCalculated: Number(p.unitCostCalculated ?? 0),
                } as MasterProduct;
                matchType = 'fuzzy_description';
                skuVal = item.sku || '';
                descVal = item.description || '';
            }
        }

        // 3. Construir el objeto match (TypeScript ya sabe que mp y matchType tienen valores)
        match = {
            masterProduct: mp,
            importedItem: {
                sku: skuVal,
                description: descVal,
                boxCost: undefined,
                packQuantity: undefined,
            },
            matchType,
        };

        matches.push(match);
    }

    return matches;
}
