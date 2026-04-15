'use client';

export type SourceType = 'database' | 'file' | 'api' | 's3' | 'stream';

interface SourceDetectorProps {
  detectedType: SourceType | null;
}

const SOURCES: Array<{ type: SourceType; label: string; icon: JSX.Element }> = [
  {
    type: 'database',
    label: 'Database',
    icon: (
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
        <ellipse cx="7" cy="3" rx="5" ry="2" stroke="currentColor" strokeWidth="1.2" />
        <path d="M2 3v3c0 1.1 2.24 2 5 2s5-.9 5-2V3" stroke="currentColor" strokeWidth="1.2" />
        <path d="M2 6v3c0 1.1 2.24 2 5 2s5-.9 5-2V6" stroke="currentColor" strokeWidth="1.2" />
      </svg>
    ),
  },
  {
    type: 'file',
    label: 'File',
    icon: (
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M3 1.5h5l3 3v8H3v-11z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
        <path d="M8 1.5v3h3" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    type: 's3',
    label: 'Cloud',
    icon: (
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M3.5 10A2.5 2.5 0 013 5.05 3.5 3.5 0 019.95 4 3 3 0 0111 10H3.5z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    type: 'api',
    label: 'API',
    icon: (
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.2" />
        <path d="M2 7h10M7 2c-1.5 1.5-2 3-2 5s.5 3.5 2 5c1.5-1.5 2-3 2-5s-.5-3.5-2-5z" stroke="currentColor" strokeWidth="1.2" />
      </svg>
    ),
  },
  {
    type: 'stream',
    label: 'Stream',
    icon: (
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M2 7h2l1.5-3 2 6 1.5-3H12" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
];

export function SourceDetector({ detectedType }: SourceDetectorProps) {
  return (
    <div className="flex items-center gap-5">
      {SOURCES.map(({ type, label, icon }) => {
        const isActive = detectedType === type;
        return (
          <div
            key={type}
            className={`flex items-center gap-1.5 transition-all duration-300 ${
              isActive
                ? 'text-li-cyan opacity-100'
                : detectedType
                  ? 'text-white/10 opacity-50'
                  : 'text-white/20 opacity-70'
            }`}
          >
            {icon}
            <span className="text-[10px] font-mono uppercase tracking-wider">
              {label}
            </span>
          </div>
        );
      })}
    </div>
  );
}
