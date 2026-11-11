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
  themeColor: '#121212',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body>{children}</body>
      <BottomNav />
    </html>
  );
}
