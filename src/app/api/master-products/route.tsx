import { NextResponse } from 'next/server';
import { db } from '@/db';
import { masterProducts } from '@/db/schema';
import { eq, ilike, or } from 'drizzle-orm';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q') || '';
    
    let products;
    
    if (query) {
      // Search by SKU or barcode
      products = await db.select().from(masterProducts).where(
        or(
          ilike(masterProducts.sku, `%${query}%`),
          ilike(masterProducts.barcode, `%${query}%`)
        )
      );
    } else {
      // Get all products
      products = await db.select().from(masterProducts);
    }
    
    return NextResponse.json({
      success: true,
      products,
      total: products.length
    });
  } catch (error: any) {
    console.error('Error fetching master products:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Error desconocido' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    
    const [created] = await db.insert(masterProducts).values({
      sku: body.sku,
      description: body.description,
      barcode: body.barcode,
      boxCost: body.boxCost,
      packQuantity: body.packQuantity,
      unitCostCalculated: body.unitCostCalculated,
      location: body.location,
      isActive: body.isActive ?? true,
      createdAt: new Date(),
      updatedAt: new Date(),
    }).returning();

    return NextResponse.json({
      success: true,
      product: {
        ...created,
        boxCost: Number(created.boxCost),
        unitCostCalculated: created.unitCostCalculated ? Number(created.unitCostCalculated) : undefined,
      }
    });
  } catch (error: any) {
    console.error('Error creating master product:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Error desconocido' },
      { status: 500 }
    );
  }
}
