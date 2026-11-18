import React from 'react';

interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className = '' }: SkeletonProps) {
  return (
    <div
      className={`md-skeleton ${className}`}
      aria-hidden="true"
    />
  );
}

export function SessionCardSkeleton() {
  return (
    <div className="rounded-2xl p-4 space-y-3"
      style={{ background: 'var(--md-surface-container)', border: '1px solid rgba(255,255,255,0.07)' }}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-3 w-1/2" />
        </div>
        <Skeleton className="h-6 w-16 rounded-full" />
      </div>
      <div className="flex gap-2 pt-1">
        <Skeleton className="h-6 w-20 rounded-full" />
        <Skeleton className="h-6 w-20 rounded-full" />
      </div>
    </div>
  );
}

export function LoadingShimmer({ rowCount = 3 }: { rowCount?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rowCount }).map((_, i) => (
        <SessionCardSkeleton key={i} />
      ))}
    </div>
  );
}

export default LoadingShimmer;
