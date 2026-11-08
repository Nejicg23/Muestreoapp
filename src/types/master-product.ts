export interface MasterProduct {
  id: string;
  sku: string;
  barcode: string | null;
  description: string;
  packQuantity: number;
  boxCost: number;
  unitCostCalculated?: number;
  location?: string;
  isActive: boolean;
}

export interface ImportedItem {
  sku: string;
  barcode: string | null;
  description: string;
  packQuantity: number;
  boxCost: number;
}

export interface MasterProductMatch {
  importedItem: ImportedItem;
  masterProductId: string | null;
  matchType: 'exact_sku' | 'fuzzy_description' | 'none';
  matchedDescription: string;
}