import React from 'react';

export function LoadingShimmer({ rowCount = 3 }: { rowCount?: number }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {Array.from({ length: rowCount }, () => (
        <div key={Math.random()} className="h-12 w-full bg-gray-200 rounded animate-shimmer" />
      ))}
    </div>
  );
}

const ShimmerStyle = {
  background: "linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%)",
  backgroundSize: "200% 100%",
  animation: "shimmer 1.5s infinite",
};

function ShimmerDiv({ className, ...props }: any) {
  return <div className={className} style={ShimmerStyle} {...props} />;
}

ShimmerDiv.displayName = "ShimmerDiv";

export default LoadingShimmer;
