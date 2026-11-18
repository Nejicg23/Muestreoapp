import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import crypto from 'crypto';

const COOKIE_NAME = 'stocksync_session';

function getSessionSecret(): string {
  const secret = process.env.SESSION_SECRET || process.env.AUTH_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('CRITICAL SECURITY ERROR: SESSION_SECRET or AUTH_SECRET must be defined in production environment.');
    }
    return 'stocksync_dev_fallback_secret_key_change_in_production';
  }
  return secret;
}

function verifyTokenInMiddleware(token: string): { id: string; username: string; role: string } | null {
  try {
    const [data, signature] = token.split('.');
    if (!data || !signature) return null;

    const secret = getSessionSecret();
    const expectedSig = crypto
      .createHmac('sha256', secret)
      .update(data)
      .digest('base64url');

    if (signature !== expectedSig) return null;

    const json = Buffer.from(data, 'base64url').toString('utf8');
    return JSON.parse(json);
  } catch {
    return null;
  }
}

function verifyPublicShareInMiddleware(sessionId: string, key: string | null): boolean {
  if (!sessionId || !key) return false;
  const secret = getSessionSecret();
  const expected = crypto
    .createHmac('sha256', secret)
    .update(`public_report_v1:${sessionId}`)
    .digest('base64url')
    .slice(0, 24);
  return key === expected;
}

export function middleware(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;

  // Ignorar archivos estáticos o internos de Next.js
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon.ico') ||
    pathname.includes('.')
  ) {
    return NextResponse.next();
  }

  // Permitir acceso público de solo lectura a informes compartidos con token criptográfico válido (/compartir/[sessionid]?key=...)
  if (pathname.startsWith('/compartir/')) {
    const parts = pathname.split('/').filter(Boolean);
    const sessionId = parts[1] || '';
    const key = searchParams.get('key');
    if (verifyPublicShareInMiddleware(sessionId, key)) {
      return NextResponse.next();
    }
    return NextResponse.redirect(new URL('/login', request.url));
  }

  const token = request.cookies.get(COOKIE_NAME)?.value;
  const session = token ? verifyTokenInMiddleware(token) : null;

  // Permitir la página de login (y llamadas que se ejecutan en /login)
  if (pathname.startsWith('/login')) {
    if (session && request.method === 'GET') {
      const target = session.role === 'admin' ? '/admin' : '/';
      return NextResponse.redirect(new URL(target, request.url));
    }
    return NextResponse.next();
  }

  // Rutas de API: si no hay sesión, devolver 401 Unauthorized JSON
  if (pathname.startsWith('/api/')) {
    if (!session) {
      return NextResponse.json(
        { success: false, error: 'No autorizado. Se requiere sesión activa.' },
        { status: 401 }
      );
    }
    // Si la API es de administración, validar rol admin
    if (pathname.startsWith('/api/admin/') && session.role !== 'admin') {
      return NextResponse.json(
        { success: false, error: 'Acceso denegado. Se requiere rol de Administrador.' },
        { status: 403 }
      );
    }
    return NextResponse.next();
  }

  // Bloqueo total: cualquier ruta fuera de /login exige sesión válida firmada
  if (!session) {
    const loginUrl = new URL('/login', request.url);
    return NextResponse.redirect(loginUrl);
  }

  // Protección perimetral para rutas exclusivas de Administrador (/admin, /admin/...)
  if (pathname.startsWith('/admin') && session.role !== 'admin') {
    return NextResponse.redirect(new URL('/', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
