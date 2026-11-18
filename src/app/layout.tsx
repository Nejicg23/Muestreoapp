import React from 'react';
import type { Metadata, Viewport } from 'next';
import './globals.css';
import BottomNav from '@/app/components/BottomNav';

export const metadata: Metadata = {
  title: 'StockSync Pro | Control de Inventario y Conteo Físico',
  description:
    'Aplicación empresarial de conteo físico, conciliación de inventario y auditoría con soporte offline.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: '#0F0F17',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body>
        <main className="min-h-dvh">
          {children}
        </main>
        <BottomNav />
      </body>
    </html>
  );
}
