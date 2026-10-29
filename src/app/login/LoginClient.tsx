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
  Sparkles,
  AlertCircle,
  CheckCircle2,
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
        setSuccessMsg(`¡Bienvenido, ${loggedUser.fullName}! Redirigiendo...`);
        setTimeout(() => {
          if (loggedUser.role === 'admin') {
            router.push('/admin');
          } else {
            router.push('/');
          }
          router.refresh();
        }, 600);
      } else {
        setErrorMsg(res.error || 'Credenciales inválidas');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Error de conexión con el servidor.');
    } finally {
      setIsLoading(false);
    }
  };

  const setDemoCredentials = (u: string, p: string) => {
    setUsername(u);
    setPassword(p);
    setErrorMsg(null);
  };

  return (
    <div className="min-h-[80vh] flex flex-col justify-center items-center py-6 px-4">
      <div className="w-full max-w-md space-y-6">
        {/* Brand & Title */}
        <div className="text-center space-y-2">
          <div className="inline-flex w-16 h-16 rounded-2xl bg-gradient-to-tr from-cyan-600 to-blue-500 items-center justify-center text-white shadow-xl shadow-cyan-500/25 mb-2 ring-4 ring-cyan-500/20">
            <Package2 className="w-8 h-8" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
            Iniciar Sesión
          </h1>
          <p className="text-sm text-slate-400">
            Acceso al Sistema de Control de Inventario y Conteo Físico
          </p>
        </div>

        {/* Card Form */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl backdrop-blur-xl space-y-6">
          {errorMsg && (
            <div className="p-3.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs sm:text-sm flex items-start gap-2.5 animate-in fade-in">
              <AlertCircle className="w-5 h-5 shrink-0 text-rose-400" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs sm:text-sm flex items-center gap-2.5 animate-in fade-in">
              <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-400" />
              <span>{successMsg}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                Usuario
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <User className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="admin, auditor u operador"
                  required
                  autoFocus
                  className="w-full pl-10 pr-4 py-3 bg-slate-950/70 border border-slate-700 rounded-xl text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                Contraseña
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full pl-10 pr-11 py-3 bg-slate-950/70 border border-slate-700 rounded-xl text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition-all font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-200"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full mt-2 py-3.5 px-4 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold text-sm shadow-lg shadow-cyan-600/30 flex items-center justify-center gap-2 transition-all disabled:opacity-50 cursor-pointer"
            >
              {isLoading ? (
                <span>Validando credenciales...</span>
              ) : (
                <>
                  <span>Ingresar al Sistema</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Cuentas de Acceso Rápido / Demo */}
          <div className="pt-4 border-t border-slate-800">
            <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-3 font-medium">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>Accesos Rápidos de Prueba:</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setDemoCredentials('admin', 'admin123')}
                className="p-2.5 rounded-xl bg-slate-950/60 hover:bg-slate-800 border border-slate-800 hover:border-cyan-500/50 text-left transition-all group"
              >
                <div className="text-[11px] font-bold text-white group-hover:text-cyan-400">Admin</div>
                <div className="text-[9px] text-slate-400 font-mono">admin123</div>
                <span className="text-[9px] text-amber-400 block mt-0.5">Control Total</span>
              </button>
              <button
                type="button"
                onClick={() => setDemoCredentials('auditor', 'auditor123')}
                className="p-2.5 rounded-xl bg-slate-950/60 hover:bg-slate-800 border border-slate-800 hover:border-cyan-500/50 text-left transition-all group"
              >
                <div className="text-[11px] font-bold text-white group-hover:text-cyan-400">Auditor</div>
                <div className="text-[9px] text-slate-400 font-mono">auditor123</div>
                <span className="text-[9px] text-cyan-400 block mt-0.5">Auditoría</span>
              </button>
              <button
                type="button"
                onClick={() => setDemoCredentials('operador', 'operador123')}
                className="p-2.5 rounded-xl bg-slate-950/60 hover:bg-slate-800 border border-slate-800 hover:border-cyan-500/50 text-left transition-all group"
              >
                <div className="text-[11px] font-bold text-white group-hover:text-cyan-400">Operador</div>
                <div className="text-[9px] text-slate-400 font-mono">operador123</div>
                <span className="text-[9px] text-emerald-400 block mt-0.5">Conteo Físico</span>
              </button>
            </div>
          </div>
        </div>

        {/* Security Badge */}
        <div className="flex items-center justify-center gap-2 text-xs text-slate-400">
          <ShieldCheck className="w-4 h-4 text-cyan-500" />
          <span>Sesión encriptada con firma HMAC SHA-256</span>
        </div>
      </div>
    </div>
  );
}
