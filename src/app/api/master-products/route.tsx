import { NextResponse } from 'next/server';
import { db } from '@/db';
import { masterProducts } from '@/db/schema';
import { eq } from 'drizzle-orm';

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
