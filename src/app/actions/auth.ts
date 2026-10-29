'use server';

import {
  loginUser,
  logoutUser,
  getCurrentUser,
  listAllUsers,
  createNewUser,
  toggleUserActive,
  ensureUsersTableInitialized,
  UserSession,
} from '@/lib/auth';
import { db } from '@/db';
import {
  inventorySessions,
  inventoryItems,
  inventoryCounts,
  inventoryNovelties,
  auditSearchLogs,
  appUsers,
} from '@/db/schema';
import { sql, desc, eq } from 'drizzle-orm';
import { redirect } from 'next/navigation';
import { getLegalModifications } from '@/lib/audit';

export type LoginResponse =
  | { success: true; user: UserSession; error?: never }
  | { success: false; error: string; user?: never };

export async function loginAction(
  username: string,
  pass: string
): Promise<LoginResponse> {
  try {
    const res = await loginUser(username, pass);
    if (res.success && res.user) {
      return { success: true, user: res.user };
    }
    return { success: false, error: res.error || 'Credenciales inválidas' };
  } catch (error: any) {
    return { success: false, error: error.message || 'Error en inicio de sesión' };
  }
}

export async function logoutAction() {
  await logoutUser();
  redirect('/login');
}

export async function checkCurrentUser(): Promise<UserSession | null> {
  return await getCurrentUser();
}

export async function createNewUserAction(payload: {
  username: string;
  fullName: string;
  password: string;
  role: 'admin' | 'auditor' | 'operator';
}): Promise<{ success: true; user: { id: string; username: string; fullName: string; role: string } } | { success: false; error: string }> {
  const current = await getCurrentUser();
  if (!current || current.role !== 'admin') {
    return { success: false, error: 'Acceso no autorizado. Se requieren permisos de administrador.' };
  }
  return await createNewUser(payload);
}

export async function toggleUserStatusAction(userId: string): Promise<{ success: true; isActive: boolean } | { success: false; error: string }> {
  const current = await getCurrentUser();
  if (!current || current.role !== 'admin') {
    return { success: false, error: 'Acceso no autorizado. Se requieren permisos de administrador.' };
  }
  return await toggleUserActive(userId);
}

export async function getAdminDashboardData() {
  const current = await getCurrentUser();
  if (!current || current.role !== 'admin') {
    return { success: false, error: 'Acceso no autorizado' };
  }

  await ensureUsersTableInitialized();

  try {
    // 1. Usuarios
    const users = await listAllUsers();

    // 2. Sesiones de inventario
    const sessions = await db
      .select()
      .from(inventorySessions)
      .orderBy(desc(inventorySessions.createdAt));

    // 3. Totales globales
    const [itemsCount] = await db.execute(sql`SELECT count(*) as total FROM inventory_items`);
    const [countsCount] = await db.execute(sql`SELECT count(*) as total FROM inventory_counts`);
    const [noveltiesCount] = await db.execute(sql`SELECT count(*) as total FROM inventory_novelties`);

    // 4. Logs de auditoría recientes (últimos 30)
    const auditLogs = await db
      .select({
        id: auditSearchLogs.id,
        sessionId: auditSearchLogs.sessionId,
        userId: auditSearchLogs.userId,
        searchQuery: auditSearchLogs.searchQuery,
        searchType: auditSearchLogs.searchType,
        resultsCount: auditSearchLogs.resultsCount,
        createdAt: auditSearchLogs.createdAt,
      })
      .from(auditSearchLogs)
      .orderBy(desc(auditSearchLogs.createdAt))
      .limit(30);

    // 5. Registro Legal de Modificaciones (Auditoría Legal Inmutable)
    const legalModifications = await getLegalModifications(60);

    // 6. Solicitudes de Cruce de Mercancía de Operadores
    const crossCheckRequests = await db
      .select()
      .from(inventoryNovelties)
      .where(eq(inventoryNovelties.noveltyType, 'cruce_mercancia'))
      .orderBy(desc(inventoryNovelties.createdAt));

    return {
      success: true,
      data: {
        currentUser: current,
        users,
        sessions,
        metrics: {
          totalSessions: sessions.length,
          activeSessions: sessions.filter((s) => s.status === 'in_progress').length,
          closedSessions: sessions.filter((s) => s.status === 'closed').length,
          totalItems: Number((itemsCount as any)?.total || 0),
          totalCounts: Number((countsCount as any)?.total || 0),
          totalNovelties: Number((noveltiesCount as any)?.total || 0),
          crossCheckCount: crossCheckRequests.length,
        },
        auditLogs,
        legalModifications,
        crossCheckRequests,
      },
    };
  } catch (error: any) {
    console.error('Error al cargar datos del panel de administrador:', error);
    return { success: false, error: error.message };
  }
}
