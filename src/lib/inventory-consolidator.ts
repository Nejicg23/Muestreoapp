export interface QuantityBreakdown {
  countedPacks: number;
  countedLoose: number;
  countedQuantity: number;
}

/**
 * Convierte una cantidad base de fracciones a su representación en Unidades/Cajas (u) y Fracciones (f)
 * Ejemplos:
 * formatStockBreakdown(218, 30) -> { packs: 7, loose: 8, formatted: "7 u 8 f" }
 * formatStockBreakdown(60, 30) -> { packs: 2, loose: 0, formatted: "2 u" }
 * formatStockBreakdown(7, 20) -> { packs: 0, loose: 7, formatted: "7 f" }
 * formatStockBreakdown(0, 30) -> { packs: 0, loose: 0, formatted: "0 u" }
 */
export function formatStockBreakdown(
  totalBaseUnits: number,
  packQuantity: number
): { packs: number; loose: number; formatted: string; fullFormatted: string } {
  const safeFactor = Math.max(1, packQuantity || 1);
  const total = Math.max(0, totalBaseUnits || 0);

  if (safeFactor === 1) {
    return {
      packs: total,
      loose: 0,
      formatted: `${total} u`,
      fullFormatted: `${total} u`,
    };
  }

  const packs = Math.floor(total / safeFactor);
  const loose = Math.round(total % safeFactor);

  let formatted = '';
  if (packs > 0 && loose > 0) {
    formatted = `${packs} u ${loose} f`;
  } else if (packs > 0) {
    formatted = `${packs} u`;
  } else if (loose > 0) {
    formatted = `${loose} f`;
  } else {
    formatted = '0 u';
  }

  const fullFormatted = `${packs} u ${loose} f (${total} fracc.)`;

  return { packs, loose, formatted, fullFormatted };
}

export function calculateBreakdown(
  inputQuantity: number,
  inputUnit: 'unit' | 'pack',
  packQuantity: number
): QuantityBreakdown {
  const safePackQty = Math.max(1, packQuantity || 1);

  if (inputUnit === 'pack') {
    const totalUnits = inputQuantity * safePackQty;
    const packs = Math.floor(inputQuantity);
    const fractionalPart = inputQuantity - packs;
    const loose = Math.round(fractionalPart * safePackQty);

    return {
      countedPacks: packs,
      countedLoose: loose,
      countedQuantity: totalUnits,
    };
  } else {
    // inputUnit === 'unit'
    const packs = Math.floor(inputQuantity / safePackQty);
    const loose = inputQuantity % safePackQty;

    return {
      countedPacks: packs,
      countedLoose: Number(loose.toFixed(2)),
      countedQuantity: inputQuantity,
    };
  }
}

export interface ConsolidatedItem {
  id: string;
  sku: string;
  barcode: string | null;
  description: string;
  location: string | null;
  packQuantity: number;
  systemStock: number;
  unitCostCalculated: number;
  requiresRecount: boolean;
  totalCounted: number;
  countedPacks: number;
  countedLoose: number;
  difference: number;
  differencePercentage: number;
  costImpact: number;
  countsCount: number;
  status: 'uncounted' | 'matched' | 'surplus' | 'shortage';
  hasNovelties: boolean;
  noveltiesCount: number;
  batchNumber?: string | null;
  expirationDate?: Date | string | null;
  imageUrl?: string | null;
}

export interface InventorySummary {
  totalItems: number;
  countedItems: number;
  uncountedItems: number;
  progressPercentage: number;
  matchedItems: number;
  discrepantItems: number;
  requiresRecountCount: number;
  noveltiesTotal: number;
  netCostImpact: number;
  totalSurplusCost: number;
  totalShortageCost: number;
}

export function consolidateSessionData(
  items: Array<{
    id: string;
    sku: string;
    barcode: string | null;
    description: string;
    systemStock: string | number;
    packQuantity: number;
    unitCostCalculated: string | number;
    location: string | null;
    requiresRecount: boolean;
  }>,
  counts: Array<{
    itemId: string;
    countedQuantity: string | number;
    countedPacks: number;
    countedLoose: string | number;
  }>,
  novelties: Array<{
    itemId: string | null;
  }> = []
): { consolidated: ConsolidatedItem[]; summary: InventorySummary } {
  // Map counts by item
  const countsByItem = new Map<
    string,
    { total: number; packs: number; loose: number; count: number }
  >();

  for (const c of counts) {
    const existing = countsByItem.get(c.itemId) || {
      total: 0,
      packs: 0,
      loose: 0,
      count: 0,
    };
    const qty = Number(c.countedQuantity) || 0;
    const pks = Number(c.countedPacks) || 0;
    const lse = Number(c.countedLoose) || 0;

    countsByItem.set(c.itemId, {
      total: existing.total + qty,
      packs: existing.packs + pks,
      loose: existing.loose + lse,
      count: existing.count + 1,
    });
  }

  // Count novelties per item
  const noveltiesCountByItem = new Map<string, number>();
  for (const n of novelties) {
    if (n.itemId) {
      noveltiesCountByItem.set(
        n.itemId,
        (noveltiesCountByItem.get(n.itemId) || 0) + 1
      );
    }
  }

  let totalSurplusCost = 0;
  let totalShortageCost = 0;
  let matchedItems = 0;
  let countedCount = 0;
  let recountCount = 0;

  const consolidated: ConsolidatedItem[] = items.map((item) => {
    const stock = Number(item.systemStock) || 0;
    const unitCost = Number(item.unitCostCalculated) || 0;
    const countInfo = countsByItem.get(item.id);
    const hasCounts = !!countInfo && countInfo.count > 0;
    const totalCounted = hasCounts ? countInfo.total : 0;
    const countedPacks = hasCounts ? countInfo.packs : 0;
    const countedLoose = hasCounts ? countInfo.loose : 0;

    let difference = 0;
    let diffPct = 0;
    let status: ConsolidatedItem['status'] = 'uncounted';

    if (hasCounts) {
      countedCount++;
      difference = totalCounted - stock;
      if (stock > 0) {
        diffPct = (difference / stock) * 100;
      } else {
        diffPct = totalCounted > 0 ? 100 : 0;
      }

      if (Math.abs(difference) < 0.0001) {
        status = 'matched';
        matchedItems++;
      } else if (difference > 0) {
        status = 'surplus';
      } else {
        status = 'shortage';
      }
    }

    const costImpact = difference * unitCost;
    if (status === 'surplus') {
      totalSurplusCost += costImpact;
    } else if (status === 'shortage') {
      totalShortageCost += Math.abs(costImpact);
    }

    if (item.requiresRecount) {
      recountCount++;
    }

    const novCount = noveltiesCountByItem.get(item.id) || 0;

    return {
      id: item.id,
      sku: item.sku,
      barcode: item.barcode,
      description: item.description,
      location: item.location,
      packQuantity: item.packQuantity,
      systemStock: stock,
      unitCostCalculated: unitCost,
      requiresRecount: item.requiresRecount,
      totalCounted,
      countedPacks,
      countedLoose,
      difference,
      differencePercentage: Number(diffPct.toFixed(2)),
      costImpact: Number(costImpact.toFixed(2)),
      countsCount: countInfo?.count || 0,
      status,
      hasNovelties: novCount > 0,
      noveltiesCount: novCount,
      batchNumber: (item as any).batchNumber || null,
      expirationDate: (item as any).expirationDate || null,
      imageUrl: (item as any).imageUrl || null,
    };
  });

  const totalItems = items.length;
  const uncountedItems = totalItems - countedCount;
  const progressPercentage =
    totalItems > 0 ? Math.round((countedCount / totalItems) * 100) : 0;
  const discrepantItems = countedCount - matchedItems;
  const netCostImpact = totalSurplusCost - totalShortageCost;

  return {
    consolidated,
    summary: {
      totalItems,
      countedItems: countedCount,
      uncountedItems,
      progressPercentage,
      matchedItems,
      discrepantItems,
      requiresRecountCount: recountCount,
      noveltiesTotal: novelties.length,
      netCostImpact: Number(netCostImpact.toFixed(2)),
      totalSurplusCost: Number(totalSurplusCost.toFixed(2)),
      totalShortageCost: Number(totalShortageCost.toFixed(2)),
    },
  };
}
