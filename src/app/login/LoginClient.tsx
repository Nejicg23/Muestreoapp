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
    <div className="min-h-dvh flex flex-col justify-center items-center py-8 px-4 bg-[#0C0C0E]">
      <div className="w-full max-w-sm space-y-6">

        {/* Brand */}
        <div className="text-center space-y-2">
          <div className="inline-flex w-14 h-14 rounded-xl items-center justify-center text-white mb-1 bg-[#17171A] border border-white/[0.08]">
            <Package2 className="w-7 h-7 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-white">StockSync Pro</h1>
            <p className="text-xs text-[#71717A] mt-0.5">Control de Inventario y Conteo Físico</p>
          </div>
        </div>

        {/* Card */}
        <div className="rounded-2xl overflow-hidden bg-[#141416] border border-white/[0.08]">

          <div className="px-6 pt-5 pb-1">
            <p className="text-xs font-medium text-[#71717A]">Inicio de Sesión</p>
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
                className="w-full mt-2 py-2.5 px-4 rounded-lg bg-white hover:bg-[#E4E4E7] text-[#0C0C0E] font-semibold text-xs flex items-center justify-center gap-2 transition-colors disabled:opacity-50 cursor-pointer"
              >
                {isLoading ? (
                  <>
                    <span className="w-3.5 h-3.5 rounded-full border-2 border-slate-400/30 border-t-slate-800 animate-spin" />
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
          <div className="px-6 py-3.5 flex items-start gap-2.5 border-t border-white/[0.06] bg-black/20">
            <ShieldAlert className="w-3.5 h-3.5 text-[#A1A1AA] shrink-0 mt-0.5" />
            <p className="text-[11px] text-[#71717A] leading-relaxed">
              Protección de cuenta tras <span className="text-[#A1A1AA]">5 intentos fallidos</span>.
            </p>
          </div>
        </div>

        {/* Security badge */}
        <div className="flex items-center justify-center gap-2">
          <ShieldCheck className="w-3.5 h-3.5 text-[#71717A]" />
          <span className="text-[11px] text-[#71717A] font-mono">PBKDF2 · HMAC SHA-256</span>
        </div>
      </div>
    </div>
  );
}
