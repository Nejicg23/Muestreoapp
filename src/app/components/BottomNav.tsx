"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Package2, Smartphone, Upload, Shield } from "lucide-react";

const navItems = [
  { href: "/", icon: Package2, label: "Sesiones" },
  { href: "/inventario-rapido", icon: Smartphone, label: "Rápido" },
  { href: "/importar", icon: Upload, label: "Importar" },
  { href: "/admin", icon: Shield, label: "Admin" },
];

export default function BottomNav() {
  const pathname = usePathname();

  // No mostrar navegación en login ni en reportes públicos compartidos
  if (pathname === "/login" || pathname?.startsWith("/compartir")) {
    return null;
  }

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 bg-[#0F0F0F]/90 backdrop-blur-xl border-t border-white/[0.06] shadow-lg"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="flex items-center justify-around h-16 px-2">
        {navItems.map(({ href, icon: Icon, label }) => {
          const isActive = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={`
                flex flex-col items-center justify-center gap-0.5 flex-1 h-full px-1 py-1
                transition-all duration-200 ease-out select-none
                ${isActive ? "" : "text-slate-500 hover:text-slate-300"}
              `}
            >
              <div
                className={`
                  relative flex items-center justify-center w-14 h-7 rounded-full transition-all duration-200 ease-out
                  ${isActive ? "bg-[#004D61]" : "hover:bg-white/5 rounded-2xl"}
                `}
              >
                <Icon
                  size={20}
                  className={`transition-colors duration-200 ease-out ${
                    isActive ? "text-cyan-300" : ""
                  }`}
                />
              </div>
              <span
                className={`text-[10px] leading-tight transition-all duration-200 ease-out ${
                  isActive
                    ? "text-cyan-200 font-semibold"
                    : "text-slate-500"
                }`}
              >
                {label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
