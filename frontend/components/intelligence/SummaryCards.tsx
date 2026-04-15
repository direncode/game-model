'use client';

interface MetricCard {
  value: string;
  label: string;
  trend?: 'up' | 'down' | 'neutral';
}

interface SummaryCardsProps {
  cards: MetricCard[];
}

export function SummaryCards({ cards }: SummaryCardsProps) {
  return (
    <div className="flex flex-col gap-3">
      {cards.map((card, i) => (
        <div
          key={i}
          className="bg-white/[0.02] border border-white/[0.04] rounded-lg px-5 py-4 opacity-0 animate-fade-in"
          style={{ animationDelay: `${i * 80}ms`, animationFillMode: 'forwards' }}
        >
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-mono font-medium text-white tracking-tight">
              {card.value}
            </span>
            {card.trend && card.trend !== 'neutral' && (
              <span
                className={`text-[10px] font-mono ${
                  card.trend === 'up' ? 'text-li-green' : 'text-li-red'
                }`}
              >
                {card.trend === 'up' ? '\u2191' : '\u2193'}
              </span>
            )}
          </div>
          <span className="text-[11px] text-white/30 mt-1 block">{card.label}</span>
        </div>
      ))}
    </div>
  );
}
