'use client';

import React from 'react';

import ProductosNovedadesClient from './ProductosNovedadesClient';

export const dynamic = 'force-dynamic';

// Manejo robusto de sessionId - both optional and with fallback
export default function ProductosNovedadesPage({
  params,
}: { params: { sessionId?: string } }) {
  const sessionId = params?.sessionId || 'default-session-' + Date.now();

  return (
    <ProductosNovedadesClient
      sessionId={sessionId}
      consolidated={[]}
      onClose={() => {}}
      onExport={() => {}}
    />
  );
}
