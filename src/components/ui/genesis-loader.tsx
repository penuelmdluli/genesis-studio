'use client';

// ==============================================
// GENESIS STUDIO — Signature Branded Loader
// Dual-ring animation: purple outer + blue inner
// Three sizes: sm (buttons), md (cards), lg (pages)
// ==============================================

export function GenesisLoader({ size = 'md', text }: {
  size?: 'sm' | 'md' | 'lg';
  text?: string;
}) {
  const sizes = {
    sm: { container: 'w-5 h-5', outer: 'w-5 h-5', inner: 'w-2.5 h-2.5', dot: 'w-1 h-1', text: 'text-[10px]' },
    md: { container: 'w-10 h-10', outer: 'w-10 h-10', inner: 'w-5 h-5', dot: 'w-1.5 h-1.5', text: 'text-xs' },
    lg: { container: 'w-16 h-16', outer: 'w-16 h-16', inner: 'w-8 h-8', dot: 'w-2 h-2', text: 'text-sm' },
  };

  const s = sizes[size];

  return (
    <div className="flex flex-col items-center gap-3">
      <div className={`relative ${s.container}`}>
        {/* Outer ring — rotates clockwise */}
        <div className={`absolute inset-0 ${s.outer} rounded-full border-2 border-transparent
          border-t-purple-500 border-r-purple-500/30 animate-spin`}
          style={{ animationDuration: '1.2s' }} />

        {/* Inner ring — rotates counter-clockwise */}
        <div className={`absolute inset-0 m-auto ${s.inner} rounded-full border-2 border-transparent
          border-b-blue-400 border-l-blue-400/30 animate-spin`}
          style={{ animationDuration: '0.8s', animationDirection: 'reverse' }} />

        {/* Center dot — pulses */}
        <div className={`absolute inset-0 m-auto ${s.dot} rounded-full bg-purple-400 animate-pulse`} />
      </div>

      {text && (
        <p className={`${s.text} text-white/40 animate-pulse`}>{text}</p>
      )}
    </div>
  );
}

// Inline button loader (for inside buttons)
export function GenesisButtonLoader() {
  return <GenesisLoader size="sm" />;
}

// Full-page loader (for page transitions & loading states)
export function GenesisPageLoader({ text = 'Loading...' }: { text?: string }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[40vh]">
      <GenesisLoader size="lg" text={text} />
    </div>
  );
}
