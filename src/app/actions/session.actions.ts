'use server';

import { duplicateSession } from '@/services/session.service';
import { getCurrentUser } from '@/lib/auth';

/**
 * Server Action para duplicar una sesión de inventario desde el cliente.
 * Wrapper delgado que delega toda la lógica en session.service tras validar autorización.
 */
export async function duplicateInventorySessionAction(
  sourceSessionId: string,
  newTitle?: string
): Promise<{
  success: boolean;
  newSessionId?: string;
  error?: string;
  itemsDuplicated?: number;
  countsDuplicated?: number;
  noveltiesDuplicated?: number;
}> {
  const user = await getCurrentUser();
  if (!user) {
    return {
      success: false,
      error: 'Acceso no autorizado. Debe iniciar sesión para duplicar una sesión de inventario.',
    };
  }

  return await duplicateSession(sourceSessionId, newTitle);
}
