'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Package2,
  Lock,
  User,
  Eye,
  EyeOff,
  ShieldCheck,
  ArrowRight,
  AlertCircle,
  CheckCircle2,
  ShieldAlert,
} from 'lucide-react';
import { loginAction } from '@/app/actions/auth';

export default function LoginClient() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) {
      setErrorMsg('Por favor completa todos los campos.');
      return;
    }

    setIsLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const res = await loginAction(username, password);
      if (res.success) {
        const loggedUser = res.user;
        setSuccessMsg(`¡Bienvenido, ${loggedUser.fullName}!`);
        setTimeout(() => {
          router.push(loggedUser.role === 'admin' ? '/admin' : '/');
          router.refresh();
        }, 500);
      } else {
        setErrorMsg(res.error || 'Credenciales inválidas');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Error de conexión con el servidor.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-dvh flex flex-col justify-center items-center py-8 px-4"
      style={{ background: 'linear-gradient(160deg, #0F0F17 0%, #0C1420 60%, #0A0C10 100%)' }}
    >
      <div className="w-full max-w-sm space-y-6 animate-fade-in">

        {/* Brand */}
        <div className="text-center space-y-3">
          <div className="inline-flex w-20 h-20 rounded-[2rem] items-center justify-center text-white mb-1"
            style={{
              background: 'linear-gradient(145deg, #004D61 0%, #006D8A 100%)',
              boxShadow: '0 8px 32px rgba(109,213,250,0.18), 0 2px 8px rgba(0,0,0,0.4)',
            }}>
            <Package2 className="w-10 h-10 text-cyan-200" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white">StockSync Pro</h1>
            <p className="text-sm text-[#9490A5] mt-1">Control de Inventario Empresarial</p>
          </div>
        </div>

        {/* Card */}
        <div className="rounded-3xl overflow-hidden"
          style={{
            background: 'var(--md-surface-container)',
            border: '1px solid rgba(255,255,255,0.07)',
            boxShadow: '0 4px 24px rgba(0,0,0,0.5)',
          }}>

          <div className="px-6 pt-6 pb-2">
            <p className="text-xs font-semibold uppercase tracking-widest text-[#9490A5]">Inicio de Sesión</p>
          </div>

          <div className="px-6 pb-6 space-y-4">
            {/* Error / Success banners */}
            {errorMsg && (
              <div className="flex items-start gap-3 px-4 py-3 rounded-2xl animate-fade-in"
                style={{ background: 'rgba(147,0,10,0.18)', border: '1px solid rgba(255,180,171,0.2)' }}>
                <AlertCircle className="w-4 h-4 shrink-0 text-[#FFB4AB] mt-0.5" />
                <span className="text-sm text-[#FFDAD6]">{errorMsg}</span>
              </div>
            )}
            {successMsg && (
              <div className="flex items-center gap-3 px-4 py-3 rounded-2xl animate-fade-in"
                style={{ background: 'rgba(0,78,74,0.3)', border: '1px solid rgba(158,242,235,0.2)' }}>
                <CheckCircle2 className="w-4 h-4 shrink-0 text-[#9EF2EB]" />
                <span className="text-sm text-[#9EF2EB]">{successMsg}</span>
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-4">
              {/* Username */}
              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-[#9490A5]">Usuario</label>
                <div className="relative">
                  <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6B6880] pointer-events-none" />
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Usuario corporativo"
                    autoComplete="username"
                    required
                    autoFocus
                    className="md-input pl-10"
                  />
                </div>
              </div>

              {/* Password */}
              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-[#9490A5]">Contraseña</label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6B6880] pointer-events-none" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••"
                    autoComplete="current-password"
                    required
                    className="md-input pl-10 pr-12 font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#6B6880] hover:text-[#9490A5] transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full mt-2 py-3.5 px-6 rounded-full font-semibold text-sm flex items-center justify-center gap-2 transition-all duration-200 disabled:opacity-50"
                style={{
                  background: isLoading ? '#004D61' : 'linear-gradient(135deg, #006D8A 0%, #3BBFE8 100%)',
                  color: '#E3E1EC',
                  boxShadow: isLoading ? 'none' : '0 4px 16px rgba(109,213,250,0.25)',
                }}
              >
                {isLoading ? (
                  <>
                    <span className="w-4 h-4 rounded-full border-2 border-cyan-200/30 border-t-cyan-200 animate-spin" />
                    <span>Verificando...</span>
                  </>
                ) : (
                  <>
                    <span>Ingresar</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Footer info */}
          <div className="px-6 py-4 flex items-start gap-2.5"
            style={{ borderTop: '1px solid rgba(255,255,255,0.06)', background: 'rgba(0,0,0,0.15)' }}>
            <ShieldAlert className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
            <p className="text-[11px] text-[#6B6880] leading-relaxed">
              Cuenta bloqueada automáticamente tras <span className="text-[#9490A5] font-medium">5 intentos fallidos</span>.
            </p>
          </div>
        </div>

        {/* Security badge */}
        <div className="flex items-center justify-center gap-2">
          <ShieldCheck className="w-3.5 h-3.5 text-[#6DD5FA]" />
          <span className="text-[11px] text-[#514E62]">PBKDF2 · HMAC SHA-256 · Cookie HttpOnly</span>
        </div>
      </div>
    </div>
  );
}
