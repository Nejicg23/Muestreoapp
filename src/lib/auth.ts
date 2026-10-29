import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import crypto from 'crypto';
import { db } from '@/db';
import { appUsers } from '@/db/schema';
import { eq, desc, sql } from 'drizzle-orm';

export const COOKIE_NAME = 'stocksync_session';
const SESSION_SECRET = process.env.SESSION_SECRET || 'stocksync_enterprise_secret_key_2026';

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutos de bloqueo

// Rate-limiter en memoria complementario para intentos con usuarios inexistentes
const unknownUserAttempts = new Map<string, { count: number; lockedUntil: number }>();

export interface UserSession {
  id: string;
  username: string;
  fullName: string;
  role: 'admin' | 'auditor' | 'operator';
  createdAt?: string;
}

// Genera un hash criptográfico seguro PBKDF2
export function hashPassword(password: string, salt: string): string {
  return crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
}

// Token firmado con HMAC SHA-256
export function signSessionPayload(payload: UserSession): string {
  const data = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto.createHmac('sha256', SESSION_SECRET).update(data).digest('base64url');
  return `${data}.${signature}`;
}

export function verifySessionToken(token: string): UserSession | null {
  try {
    const [data, signature] = token.split('.');
    if (!data || !signature) return null;

    const expectedSig = crypto.createHmac('sha256', SESSION_SECRET).update(data).digest('base64url');
    if (signature !== expectedSig) return null;

    const json = Buffer.from(data, 'base64url').toString('utf8');
    return JSON.parse(json) as UserSession;
  } catch {
    return null;
  }
}

// Inicializa tabla de usuarios y columnas de protección anti-fuerza bruta
let isInitialized = false;
export async function ensureUsersTableInitialized() {
  if (isInitialized) return;

  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS app_users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        username VARCHAR(50) NOT NULL UNIQUE,
        full_name VARCHAR(100) NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        salt VARCHAR(64) NOT NULL,
        role VARCHAR(30) NOT NULL DEFAULT 'operator',
        is_active BOOLEAN NOT NULL DEFAULT true,
        failed_attempts INTEGER NOT NULL DEFAULT 0,
        locked_until TIMESTAMPTZ,
        last_login TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    // Asegurar columnas de bloqueo en tablas ya existentes
    await db.execute(sql`
      ALTER TABLE app_users ADD COLUMN IF NOT EXISTS failed_attempts INTEGER NOT NULL DEFAULT 0;
    `);
    await db.execute(sql`
      ALTER TABLE app_users ADD COLUMN IF NOT EXISTS locked_until TIMESTAMPTZ;
    `);

    // Comprobar si ya existen usuarios
    const existing = await db.select().from(appUsers).limit(1);
    if (existing.length === 0) {
      const defaultUsers = [
        {
          username: 'admin',
          fullName: 'Administrador Principal',
          pass: 'admin123',
          role: 'admin' as const,
        },
        {
          username: 'auditor',
          fullName: 'Auditor de Calidad e Inventarios',
          pass: 'auditor123',
          role: 'auditor' as const,
        },
        {
          username: 'operador',
          fullName: 'Operador de Conteo Físico',
          pass: 'operador123',
          role: 'operator' as const,
        },
      ];

      for (const u of defaultUsers) {
        const salt = crypto.randomBytes(16).toString('hex');
        const hash = hashPassword(u.pass, salt);
        await db.insert(appUsers).values({
          username: u.username,
          fullName: u.fullName,
          passwordHash: hash,
          salt,
          role: u.role,
          isActive: true,
          failedAttempts: 0,
        });
      }
    }
    isInitialized = true;
  } catch (err) {
    console.error('Error al inicializar tabla app_users:', err);
  }
}

// Obtener usuario actualmente autenticado desde la cookie
export async function getCurrentUser(): Promise<UserSession | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(COOKIE_NAME)?.value;
    if (!token) return null;

    const session = verifySessionToken(token);
    if (!session) return null;

    return session;
  } catch {
    return null;
  }
}

// Exigir usuario autenticado en páginas de servidor (redirige a /login si no hay sesión)
export async function requireAuth(allowedRoles?: Array<'admin' | 'auditor' | 'operator'>): Promise<UserSession> {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/login');
  }
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    redirect('/');
  }
  return user;
}

// Iniciar sesión con protección anti-fuerza bruta
export async function loginUser(username: string, pass: string) {
  await ensureUsersTableInitialized();

  const cleanUser = username.trim().toLowerCase();
  const now = Date.now();

  // Verificar rate-limit de memoria para evitar enumeración de usuarios
  const memRecord = unknownUserAttempts.get(cleanUser);
  if (memRecord && memRecord.lockedUntil > now) {
    const remainingMin = Math.ceil((memRecord.lockedUntil - now) / 60000);
    return {
      success: false,
      error: `Acceso bloqueado temporalmente por múltiples intentos fallidos. Intenta de nuevo en ${remainingMin} min.`,
    };
  }

  const [user] = await db
    .select()
    .from(appUsers)
    .where(eq(appUsers.username, cleanUser));

  if (!user) {
    const currentCount = (memRecord?.count || 0) + 1;
    if (currentCount >= MAX_FAILED_ATTEMPTS) {
      unknownUserAttempts.set(cleanUser, {
        count: currentCount,
        lockedUntil: now + LOCKOUT_DURATION_MS,
      });
      return {
        success: false,
        error: `Demasiados intentos fallidos (${MAX_FAILED_ATTEMPTS}/${MAX_FAILED_ATTEMPTS}). Acceso bloqueado por 15 minutos.`,
      };
    }
    unknownUserAttempts.set(cleanUser, { count: currentCount, lockedUntil: 0 });
    return {
      success: false,
      error: `Credenciales inválidas. Intento ${currentCount} de ${MAX_FAILED_ATTEMPTS}.`,
    };
  }

  // Verificar si la cuenta está bloqueada temporalmente en Base de Datos
  if (user.lockedUntil && new Date(user.lockedUntil).getTime() > now) {
    const remainingMin = Math.max(
      1,
      Math.ceil((new Date(user.lockedUntil).getTime() - now) / 60000)
    );
    return {
      success: false,
      error: `🔒 Cuenta bloqueada por seguridad tras ${MAX_FAILED_ATTEMPTS} intentos fallidos. Espera ${remainingMin} min o solicita desbloqueo al Administrador.`,
    };
  }

  if (!user.isActive) {
    return {
      success: false,
      error: 'Esta cuenta de usuario ha sido desactivada por el administrador.',
    };
  }

  const calculatedHash = hashPassword(pass, user.salt);
  if (calculatedHash !== user.passwordHash) {
    // Si el bloqueo anterior ya expiró, reiniciar contador a 1; si no, incrementar
    const previousAttempts =
      user.lockedUntil && new Date(user.lockedUntil).getTime() <= now
        ? 0
        : user.failedAttempts || 0;
    const newAttempts = previousAttempts + 1;

    if (newAttempts >= MAX_FAILED_ATTEMPTS) {
      const lockTime = new Date(now + LOCKOUT_DURATION_MS);
      await db
        .update(appUsers)
        .set({
          failedAttempts: newAttempts,
          lockedUntil: lockTime,
        })
        .where(eq(appUsers.id, user.id));

      return {
        success: false,
        error: `🔒 Has superado los ${MAX_FAILED_ATTEMPTS} intentos permitidos. La cuenta @${user.username} ha sido bloqueada por 15 minutos por seguridad.`,
      };
    } else {
      await db
        .update(appUsers)
        .set({
          failedAttempts: newAttempts,
          lockedUntil: null,
        })
        .where(eq(appUsers.id, user.id));

      const remaining = MAX_FAILED_ATTEMPTS - newAttempts;
      return {
        success: false,
        error: `Contraseña incorrecta. Te ${remaining === 1 ? 'queda 1 intento' : `quedan ${remaining} intentos`} antes del bloqueo automático.`,
      };
    }
  }

  // Login exitoso: limpiar contadores de intentos fallidos y actualizar último login
  unknownUserAttempts.delete(cleanUser);
  await db
    .update(appUsers)
    .set({
      failedAttempts: 0,
      lockedUntil: null,
      lastLogin: new Date(),
    })
    .where(eq(appUsers.id, user.id));

  const sessionData: UserSession = {
    id: user.id,
    username: user.username,
    fullName: user.fullName,
    role: user.role as 'admin' | 'auditor' | 'operator',
  };

  const token = signSessionPayload(sessionData);
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7, // 7 días
    path: '/',
  });

  return { success: true, user: sessionData };
}

// Cerrar sesión
export async function logoutUser() {
  try {
    const cookieStore = await cookies();
    cookieStore.delete(COOKIE_NAME);
  } catch {}
  return { success: true };
}

// Listar todos los usuarios para el panel de administración
export async function listAllUsers() {
  await ensureUsersTableInitialized();
  return await db
    .select({
      id: appUsers.id,
      username: appUsers.username,
      fullName: appUsers.fullName,
      role: appUsers.role,
      isActive: appUsers.isActive,
      failedAttempts: appUsers.failedAttempts,
      lockedUntil: appUsers.lockedUntil,
      lastLogin: appUsers.lastLogin,
      createdAt: appUsers.createdAt,
    })
    .from(appUsers)
    .orderBy(desc(appUsers.createdAt));
}

export type CreateUserResult =
  | { success: true; user: { id: string; username: string; fullName: string; role: string }; error?: never }
  | { success: false; error: string; user?: never };

export type ToggleUserResult =
  | { success: true; isActive: boolean; error?: never }
  | { success: false; error: string; isActive?: never };

// Crear un nuevo usuario desde el panel de administración
export async function createNewUser(payload: {
  username: string;
  fullName: string;
  password: string;
  role: 'admin' | 'auditor' | 'operator';
}): Promise<CreateUserResult> {
  await ensureUsersTableInitialized();

  const cleanUser = payload.username.trim().toLowerCase();
  if (cleanUser.length < 3) {
    return { success: false, error: 'El nombre de usuario debe tener al menos 3 caracteres.' };
  }
  if (payload.password.length < 6) {
    return { success: false, error: 'Por seguridad, la contraseña debe tener al menos 6 caracteres.' };
  }

  const existing = await db
    .select()
    .from(appUsers)
    .where(eq(appUsers.username, cleanUser));

  if (existing.length > 0) {
    return { success: false, error: 'El nombre de usuario ya está en uso.' };
  }

  const salt = crypto.randomBytes(16).toString('hex');
  const passwordHash = hashPassword(payload.password, salt);

  const [newUser] = await db
    .insert(appUsers)
    .values({
      username: cleanUser,
      fullName: payload.fullName.trim(),
      passwordHash,
      salt,
      role: payload.role,
      isActive: true,
      failedAttempts: 0,
    })
    .returning({
      id: appUsers.id,
      username: appUsers.username,
      fullName: appUsers.fullName,
      role: appUsers.role,
    });

  return { success: true, user: newUser };
}

// Cambiar estado activo/inactivo de un usuario
export async function toggleUserActive(userId: string): Promise<ToggleUserResult> {
  await ensureUsersTableInitialized();

  const [user] = await db
    .select()
    .from(appUsers)
    .where(eq(appUsers.id, userId));

  if (!user) {
    return { success: false, error: 'Usuario no encontrado' };
  }

  const newStatus = !user.isActive;
  await db
    .update(appUsers)
    .set({
      isActive: newStatus,
      failedAttempts: 0,
      lockedUntil: null,
    })
    .where(eq(appUsers.id, userId));

  return { success: true, isActive: newStatus };
}

// Cambiar contraseña y desbloquear cuenta desde el Panel de Administrador
export async function updateUserPassword(
  userId: string,
  newPassword: string
): Promise<{ success: true; username: string } | { success: false; error: string }> {
  await ensureUsersTableInitialized();

  if (!newPassword || newPassword.trim().length < 6) {
    return {
      success: false,
      error: 'La nueva contraseña debe tener al menos 6 caracteres.',
    };
  }

  const [user] = await db
    .select()
    .from(appUsers)
    .where(eq(appUsers.id, userId));

  if (!user) {
    return { success: false, error: 'Usuario no encontrado.' };
  }

  const salt = crypto.randomBytes(16).toString('hex');
  const passwordHash = hashPassword(newPassword.trim(), salt);

  await db
    .update(appUsers)
    .set({
      passwordHash,
      salt,
      failedAttempts: 0,
      lockedUntil: null,
    })
    .where(eq(appUsers.id, userId));

  unknownUserAttempts.delete(user.username);

  return { success: true, username: user.username };
}

// Desbloquear cuenta bloqueada por intentos fallidos
export async function unlockUserAccount(
  userId: string
): Promise<{ success: true; username: string } | { success: false; error: string }> {
  await ensureUsersTableInitialized();

  const [user] = await db
    .select()
    .from(appUsers)
    .where(eq(appUsers.id, userId));

  if (!user) {
    return { success: false, error: 'Usuario no encontrado.' };
  }

  await db
    .update(appUsers)
    .set({
      failedAttempts: 0,
      lockedUntil: null,
    })
    .where(eq(appUsers.id, userId));

  unknownUserAttempts.delete(user.username);

  return { success: true, username: user.username };
}
