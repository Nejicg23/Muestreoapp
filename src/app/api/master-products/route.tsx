import { NextResponse } from 'next/server';
import { db } from '@/db';
import { masterProducts } from '@/db/schema';
import { getCurrentUser } from '@/lib/auth';
import { ilike, or } from 'drizzle-orm';

export async function GET(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Acceso no autorizado. Debe iniciar sesión.' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q')?.trim() || '';
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '100', 10), 1), 200);
    
    let products;
    
    if (query) {
      // Búsqueda por SKU, código de barras o descripción con límite seguro
      products = await db
        .select()
        .from(masterProducts)
        .where(
          or(
            ilike(masterProducts.sku, `%${query}%`),
            ilike(masterProducts.barcode, `%${query}%`),
            ilike(masterProducts.description, `%${query}%`)
          )
        )
        .limit(limit);
    } else {
      // Listar productos con paginación/límite por defecto para evitar sobrecarga
      products = await db.select().from(masterProducts).limit(limit);
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
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Acceso no autorizado.' },
        { status: 401 }
      );
    }

    if (user.role !== 'admin') {
      return NextResponse.json(
        { success: false, error: 'Acceso denegado. Se requiere rol de Administrador para crear productos maestros.' },
        { status: 403 }
      );
    }

    const body = await request.json();

    // Validación rigurosa de inputs
    const sku = typeof body.sku === 'string' ? body.sku.trim() : '';
    const description = typeof body.description === 'string' ? body.description.trim() : '';
    const boxCost = Number(body.boxCost);
    const packQuantity = parseInt(String(body.packQuantity || '1'), 10);

    if (!sku) {
      return NextResponse.json(
        { success: false, error: 'El SKU es obligatorio.' },
        { status: 400 }
      );
    }
    if (!description) {
      return NextResponse.json(
        { success: false, error: 'La descripción del producto es obligatoria.' },
        { status: 400 }
      );
    }
    if (isNaN(boxCost) || boxCost < 0) {
      return NextResponse.json(
        { success: false, error: 'El costo por caja debe ser un número mayor o igual a 0.' },
        { status: 400 }
      );
    }
    if (isNaN(packQuantity) || packQuantity <= 0) {
      return NextResponse.json(
        { success: false, error: 'El factor de empaque debe ser un entero mayor a 0.' },
        { status: 400 }
      );
    }

    const unitCostCalculated = boxCost > 0 && packQuantity > 0 ? (boxCost / packQuantity).toFixed(4) : undefined;
    
    const [created] = await db.insert(masterProducts).values({
      sku,
      description,
      barcode: typeof body.barcode === 'string' ? body.barcode.trim() || undefined : undefined,
      boxCost: boxCost.toString(),
      packQuantity,
      unitCostCalculated,
      location: typeof body.location === 'string' ? body.location.trim() || undefined : undefined,
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
