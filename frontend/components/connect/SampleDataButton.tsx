'use client';

interface SampleDataButtonProps {
  onClick: () => void;
  loading?: boolean;
}

export function SampleDataButton({ onClick, loading }: SampleDataButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className="text-xs font-mono text-white/25 hover:text-white/50 transition-colors duration-200 underline underline-offset-4 decoration-white/10 disabled:opacity-30 disabled:cursor-not-allowed"
    >
      {loading ? 'Loading sample...' : 'or try with sample data'}
    </button>
  );
}
