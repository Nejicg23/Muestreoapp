import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import crypto from 'crypto';

const COOKIE_NAME = 'stocksync_session';
const SESSION_SECRET = process.env.SESSION_SECRET || 'stocksync_enterprise_secret_key_2026';

function verifyTokenInProxy(token: string): { id: string; username: string; role: string } | null {
  try {
    const [data, signature] = token.split('.');
    if (!data || !signature) return null;

    const expectedSig = crypto
      .createHmac('sha256', SESSION_SECRET)
      .update(data)
      .digest('base64url');

    if (signature !== expectedSig) return null;

    const json = Buffer.from(data, 'base64url').toString('utf8');
    return JSON.parse(json);
  } catch {
    return null;
  }
}

function verifyPublicShareInProxy(sessionId: string, key: string | null): boolean {
  if (!sessionId || !key) return false;
  const expected = crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(`public_report_v1:${sessionId}`)
    .digest('base64url')
    .slice(0, 24);
  return key === expected;
}

export function proxy(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;

  // Ignorar archivos estáticos o internos de Next.js
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname === '/favicon.ico'
  ) {
    return NextResponse.next();
  }

  // Permitir acceso público de solo lectura a informes compartidos con token criptográfico válido (/compartir/[sessionid]?key=...)
  if (pathname.startsWith('/compartir/')) {
    const parts = pathname.split('/').filter(Boolean);
    const sessionId = parts[1] || '';
    const key = searchParams.get('key');
    if (verifyPublicShareInProxy(sessionId, key)) {
      return NextResponse.next();
    }
    return NextResponse.redirect(new URL('/login', request.url));
  }

  const token = request.cookies.get(COOKIE_NAME)?.value;
  const session = token ? verifyTokenInProxy(token) : null;

  // Permitir la página de login (y Server Actions que se ejecutan en /login)
  if (pathname.startsWith('/login')) {
    if (session && request.method === 'GET') {
      const target = session.role === 'admin' ? '/admin' : '/';
      return NextResponse.redirect(new URL(target, request.url));
    }
    return NextResponse.next();
  }

  // Bloqueo total: cualquier ruta fuera de /login exige sesión válida firmada
  if (!session) {
    const loginUrl = new URL('/login', request.url);
    return NextResponse.redirect(loginUrl);
  }

  // Protección adicional de perímetro para rutas exclusivas de Administrador
  if (pathname.startsWith('/admin') && session.role !== 'admin') {
    return NextResponse.redirect(new URL('/', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
