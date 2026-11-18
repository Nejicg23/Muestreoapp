import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Edge-compatible HMAC SHA-256 using Web Crypto API (no Node.js crypto)
async function hmacSha256Base64Url(key: string, data: string): Promise<string> {
  const enc = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    enc.encode(key),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', cryptoKey, enc.encode(data));
  // Convert ArrayBuffer to base64url
  const bytes = new Uint8Array(sig);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

const COOKIE_NAME = 'stocksync_session';

function getSessionSecret(): string {
  const secret = process.env.SESSION_SECRET || process.env.AUTH_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('CRITICAL SECURITY ERROR: SESSION_SECRET or AUTH_SECRET must be defined in production.');
    }
    return 'stocksync_dev_fallback_secret_key_change_in_production';
  }
  return secret;
}

async function verifyTokenInMiddleware(
  token: string
): Promise<{ id: string; username: string; role: string } | null> {
  try {
    const [data, signature] = token.split('.');
    if (!data || !signature) return null;

    const secret = getSessionSecret();
    const expectedSig = await hmacSha256Base64Url(secret, data);
    if (signature !== expectedSig) return null;

    const json = atob(data.replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(json);
  } catch {
    return null;
  }
}

async function verifyPublicShareInMiddleware(
  sessionId: string,
  key: string | null
): Promise<boolean> {
  if (!sessionId || !key) return false;
  const secret = getSessionSecret();
  const full = await hmacSha256Base64Url(secret, `public_report_v1:${sessionId}`);
  const expected = full.slice(0, 24);
  return key === expected;
}

export async function middleware(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;

  // Archivos estáticos
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon.ico') ||
    pathname.includes('.')
  ) {
    return NextResponse.next();
  }

  // Acceso público a informes compartidos con token criptográfico
  if (pathname.startsWith('/compartir/')) {
    const parts = pathname.split('/').filter(Boolean);
    const sessionId = parts[1] || '';
    const key = searchParams.get('key');
    if (await verifyPublicShareInMiddleware(sessionId, key)) {
      return NextResponse.next();
    }
    return NextResponse.redirect(new URL('/login', request.url));
  }

  const token = request.cookies.get(COOKIE_NAME)?.value;
  const session = token ? await verifyTokenInMiddleware(token) : null;

  // Login: redirigir si ya está autenticado
  if (pathname.startsWith('/login')) {
    if (session && request.method === 'GET') {
      return NextResponse.redirect(new URL(session.role === 'admin' ? '/admin' : '/', request.url));
    }
    return NextResponse.next();
  }

  // API routes: 401 si no hay sesión
  if (pathname.startsWith('/api/')) {
    if (!session) {
      return NextResponse.json(
        { success: false, error: 'No autorizado. Se requiere sesión activa.' },
        { status: 401 }
      );
    }
    if (pathname.startsWith('/api/admin/') && session.role !== 'admin') {
      return NextResponse.json(
        { success: false, error: 'Acceso denegado. Se requiere rol de Administrador.' },
        { status: 403 }
      );
    }
    return NextResponse.next();
  }

  // Bloqueo total para rutas no autenticadas
  if (!session) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // Rutas de Admin solo para admins
  if (pathname.startsWith('/admin') && session.role !== 'admin') {
    return NextResponse.redirect(new URL('/', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
