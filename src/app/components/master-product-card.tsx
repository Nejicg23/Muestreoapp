export interface MasterProductCardProps {
  sku: string;
  description: string;
  boxCost: number;
  packQuantity?: number;
  location?: string;
  isActive?: boolean;
  onClick?: () => void;
}

export function MasterProductCard({
  sku,
  description,
  boxCost,
  packQuantity,
  location,
  isActive = true,
  onClick,
}: MasterProductCardProps) {
  const unitCost = packQuantity && packQuantity > 0 ? boxCost / packQuantity : null;

  return (
    <div
      className="rounded-2xl p-4 transition-all duration-200 cursor-pointer group"
      style={{
        background: 'var(--md-surface-container)',
        border: '1px solid rgba(255,255,255,0.07)',
      }}
      onClick={onClick}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex-1 min-w-0">
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold tracking-wide"
            style={{
              background: 'var(--md-primary-container)',
              color: 'var(--md-on-primary-container)',
            }}>
            {sku}
          </span>
        </div>
        {!isActive && (
          <span className="text-[10px] px-2 py-0.5 rounded-full font-medium"
            style={{ background: 'rgba(147,0,10,0.2)', color: '#FFB4AB' }}>
            Inactivo
          </span>
        )}
      </div>

      {/* Description */}
      <p className="text-sm text-[#C5C3D6] leading-snug mb-3 line-clamp-2 group-hover:text-white transition-colors">
        {description || '—'}
      </p>

      {/* Stats row */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex gap-3">
          <div className="text-center">
            <div className="text-xs text-[#6B6880]">Caja</div>
            <div className="text-sm font-semibold text-[#E3E1EC]">${boxCost.toFixed(2)}</div>
          </div>
          {unitCost !== null && (
            <div className="text-center">
              <div className="text-xs text-[#6B6880]">Unidad</div>
              <div className="text-sm font-semibold text-[#9EF2EB]">${unitCost.toFixed(4)}</div>
            </div>
          )}
        </div>
        {location && (
          <span className="text-[11px] px-2.5 py-1 rounded-full text-[#9490A5]"
            style={{ background: 'rgba(255,255,255,0.05)' }}>
            📍 {location}
          </span>
        )}
      </div>
    </div>
  );
}
