'use server';

import { duplicateSession } from '@/services/session.service';

/**
 * Server Action para duplicar una sesión de inventario desde el cliente.
 * Wrapper delgado que delega toda la lógica en session.service.
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
  return await duplicateSession(sourceSessionId, newTitle);
}
