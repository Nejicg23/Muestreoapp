"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Layers, Smartphone, Upload, Shield, AlertTriangle } from "lucide-react";

const navItems = [
  { href: "/", icon: Layers, label: "Sesiones" },
  { href: "/inventario-rapido", icon: Smartphone, label: "Rápido" },
  { href: "/novedades", icon: AlertTriangle, label: "Novedades" },
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
      className="fixed bottom-0 left-0 right-0 z-50 bg-[#0C0C0E]/95 backdrop-blur-md border-t border-white/[0.08]"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="flex items-center justify-around h-16 max-w-lg mx-auto px-2">
        {navItems.map(({ href, icon: Icon, label }) => {
          const isActive = href === "/" ? pathname === "/" : pathname?.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={`
                flex flex-col items-center justify-center gap-1 flex-1 h-full px-1 py-1
                transition-colors duration-150 select-none
                ${isActive ? "" : "text-[#71717A] hover:text-[#A1A1AA]"}
              `}
            >
              <div
                className={`
                  relative flex items-center justify-center w-12 h-7 rounded-full transition-colors duration-150
                  ${isActive ? "bg-white/10 text-white" : "hover:bg-white/[0.04]"}
                `}
              >
                <Icon
                  size={18}
                  className={`transition-colors duration-150 ${
                    isActive ? "text-white" : "text-[#71717A]"
                  }`}
                  strokeWidth={isActive ? 2.25 : 1.75}
                />
              </div>
              <span
                className={`text-[11px] tracking-tight leading-none transition-colors duration-150 ${
                  isActive
                    ? "text-white font-semibold"
                    : "text-[#71717A] font-normal"
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
