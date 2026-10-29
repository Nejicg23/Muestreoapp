import { cookies } from 'next/headers';
import crypto from 'crypto';
import { db } from '@/db';
import { appUsers } from '@/db/schema';
import { eq, desc, sql } from 'drizzle-orm';

const COOKIE_NAME = 'stocksync_session';
const SESSION_SECRET = process.env.SESSION_SECRET || 'stocksync_enterprise_secret_key_2026';

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

// Inicializa tabla de usuarios y datos base (admin / auditor / operador)
let isInitialized = false;
export async function ensureUsersTableInitialized() {
  if (isInitialized) return;

  try {
    // Crear tabla si no existe
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS app_users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        username VARCHAR(50) NOT NULL UNIQUE,
        full_name VARCHAR(100) NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        salt VARCHAR(64) NOT NULL,
        role VARCHAR(30) NOT NULL DEFAULT 'operator',
        is_active BOOLEAN NOT NULL DEFAULT true,
        last_login TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    // Comprobar si ya existen usuarios
    const existing = await db.select().from(appUsers).limit(1);
    if (existing.length === 0) {
      // Sembrar usuarios iniciales
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

// Iniciar sesión
export async function loginUser(username: string, pass: string) {
  await ensureUsersTableInitialized();

  const cleanUser = username.trim().toLowerCase();
  const [user] = await db
    .select()
    .from(appUsers)
    .where(eq(appUsers.username, cleanUser));

  if (!user) {
    return { success: false, error: 'Usuario no encontrado o no registrado.' };
  }

  if (!user.isActive) {
    return { success: false, error: 'Esta cuenta de usuario ha sido desactivada por el administrador.' };
  }

  const calculatedHash = hashPassword(pass, user.salt);
  if (calculatedHash !== user.passwordHash) {
    return { success: false, error: 'Contraseña incorrecta.' };
  }

  // Actualizar último login
  await db
    .update(appUsers)
    .set({ lastLogin: new Date() })
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
  if (payload.password.length < 5) {
    return { success: false, error: 'La contraseña debe tener al menos 5 caracteres.' };
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
    .set({ isActive: newStatus })
    .where(eq(appUsers.id, userId));

  return { success: true, isActive: newStatus };
}
