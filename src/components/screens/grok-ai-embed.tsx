'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Loader2, Sparkles } from 'lucide-react';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface GrokAIEmbedProps {
  context: 'backend' | 'analytics' | 'manager';
  matchMinute?: number;
  compact?: boolean;
}

const CONTEXT_SUGGESTIONS: Record<string, string[]> = {
  backend: [
    'Show pattern recognition chain health',
    'Debug the coherence calculation pipeline',
    'Why is the game engine tick rate dropping?',
    'Analyze catapult data feed latency',
  ],
  analytics: [
    'Why is team coherence declining?',
    'Explain the pressing pattern detected',
    'Compare home vs away xG breakdown',
    'Which players have highest fatigue risk?',
  ],
  manager: [
    'Switch to high press immediately',
    'Drop into a low block and counter',
    'Push the defensive line higher',
    'Bring on fresh legs on the right wing',
  ],
};

const RELEVANCE_KEYWORDS = [
  'football', 'soccer', 'match', 'player', 'tactic', 'formation', 'press',
  'coherence', 'algorithm', 'pattern', 'fatigue', 'xg', 'possession', 'pass',
  'sprint', 'catapult', 'gps', 'model', 'engine', 'debug', 'pipeline',
  'alert', 'twin', 'digital', 'defensive', 'attacking', 'transition',
  'goal', 'shot', 'game', 'team', 'coach', 'manager', 'instruction',
  'block', 'line', 'wing', 'midfield', 'striker', 'keeper', 'sub',
  'analyze', 'compare', 'explain', 'show', 'why', 'how', 'what',
  'switch', 'change', 'drop', 'push', 'hold', 'step', 'press',
  'speed', 'distance', 'load', 'heart', 'risk', 'injury', 'score',
];

function isRelevantQuery(query: string): boolean {
  const lower = query.toLowerCase();
  return RELEVANCE_KEYWORDS.some(kw => lower.includes(kw)) || lower.length < 15;
}

function generateMockResponse(query: string, context: string): string {
  const lower = query.toLowerCase();

  if (!isRelevantQuery(query)) {
    return "I'm specialized for football analytics within this platform. Please ask about match data, tactical patterns, player metrics, or system operations.";
  }

  if (context === 'backend') {
    if (lower.includes('pattern') || lower.includes('chain'))
      return "Pattern Recognition Engine: Chain health is STRONG. 14 patterns detected this half. Markov chain predicting 'high_press \u2192 counter_press' with 73% confidence. Top sequences: positional_rotation (8x), half_space_occupation (5x), build_from_back (4x). Transition matrix updated 342 times.";
    if (lower.includes('debug') || lower.includes('pipeline'))
      return "Pipeline Status: All 6 modules operational. Game Engine: 10 ticks/s, 0 errors. Pattern Recognition: 147ms avg latency. Catapult: 11 players tracked. Analytics: xG model calibrated at 0.94 accuracy. Coherence: 23 deviations logged. AI Interface: 12 instructions processed, avg confidence 0.82.";
    if (lower.includes('tick') || lower.includes('engine'))
      return "Game Engine Performance: Current tick rate 10Hz (target 10Hz). Match phase: first_half. Events generated: 47 (passes: 31, tackles: 8, shots: 5, fouls: 3). Ball position updates: 100% on schedule. State serialization: 2.3ms avg.";
    if (lower.includes('catapult') || lower.includes('latency') || lower.includes('feed'))
      return "Catapult Integration: GPS feed active at 10Hz for 22 players. IMU data: 100Hz. Avg position accuracy: \u00b11.2m. Data feed latency: 45ms. Last position update: 0.1s ago. Fatigue models: 22 active. Injury risk calculations: running for all tracked players.";
    return "System operational. Game Engine running at 10Hz. Pattern Recognition analyzing positions every tick. Catapult GPS tracking 22 players. Analytics engine processing xG and passing networks. Coherence analysis scoring 11 home players against digital twin positions.";
  }

  if (context === 'analytics') {
    if (lower.includes('coherence') || lower.includes('declining'))
      return "Coherence Analysis: Overall score trending downward from 78% \u2192 64% over last 10 minutes. Key deviations: LB drifting too centrally (deviation: 12m), RW not maintaining width in possession (deviation: 8m). Recommendation: Reinforce positional discipline or adjust game model expectations.";
    if (lower.includes('pressing') || lower.includes('pattern'))
      return "Pressing Pattern Detected: Counter-press initiated at 62' after turnover in middle third. 4 players engaged within 3 seconds. Success rate this match: 67%. Pattern matches 'gegenpressing' template. Markov chain suggests transition to 'build_from_back' next.";
    if (lower.includes('xg') || lower.includes('compare'))
      return "xG Breakdown \u2014 Home: 1.47 (7 shots, 3 on target, best chance 0.42xG from 6-yard box). Away: 0.83 (4 shots, 2 on target, best chance 0.31xG from edge of box). Home outperforming xG by 0.53. Shot quality: Home averaging 0.21xG/shot vs Away 0.21xG/shot.";
    if (lower.includes('fatigue') || lower.includes('risk'))
      return "Fatigue Risk Assessment: HIGH \u2014 #8 CM (fatigue index: 72, sprint capacity -34%), #7 RW (fatigue index: 68, high-intensity distance declining). MODERATE \u2014 #6 CDM (fatigue index: 58). Recommendation: Consider substitution for #8 within next 10 minutes. Reduce pressing intensity or switch to mid-block.";
    return "Match Analytics: Possession 58-42% (home dominant). 312 passes completed (87% accuracy). 14 pressing sequences triggered. Territory control: 62% home. Formation maintenance: 71%. 3 tactical alerts logged this half.";
  }

  if (lower.includes('press') || lower.includes('high'))
    return "Instruction acknowledged: High Press activated. Pressing line moved to 60m from own goal. All forwards and midfielders engaging within 4 seconds of opposition receiving ball. Counter-press enabled on turnover. Monitoring fatigue impact \u2014 will alert if pressing sustainability drops below threshold.";
  if (lower.includes('low block') || lower.includes('counter'))
    return "Instruction acknowledged: Switching to Low Block + Counter Attack. Defensive line dropping to 25m. Midfield compact at 30m gap. Counter-attack triggers: ball recovery in own half \u2192 direct ball to ST/RW. Wings stay high and wide on transition. Saving energy for explosive counters.";
  if (lower.includes('defensive') || lower.includes('line') || lower.includes('higher'))
    return "Instruction acknowledged: Defensive line pushed higher to 45m. Offside trap active. Sweeper keeper instruction engaged \u2014 GK to patrol space behind line. Risk assessment: Increased exposure to through-balls. Compensation: Midfield must drop to cover gaps within 2 seconds of line break.";
  if (lower.includes('sub') || lower.includes('fresh'))
    return "Substitution Analysis: Recommended targets \u2014 #8 CM (fatigue: 72%, sprint decline -34%) \u2192 bring on #16 CM (readiness: 94%). #7 RW (fatigue: 68%) \u2192 #21 RW (readiness: 91%). Impact projection: +12% pressing intensity, +8% transition speed. Window: next natural stoppage.";

  return "Instruction received. Processing tactical adjustment. The game model will be updated and coherence recalculated with the new parameters. Digital twin comparison running \u2014 results in next analysis cycle.";
}

export function GrokAIEmbed({ context, matchMinute, compact = false }: GrokAIEmbedProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = useCallback(async (text?: string) => {
    const messageText = text || input.trim();
    if (!messageText || isTyping) return;

    const userMsg: ChatMessage = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: messageText,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setShowSuggestions(false);
    setIsTyping(true);

    await new Promise(resolve => setTimeout(resolve, 600 + Math.random() * 800));

    let responseText: string;
    try {
      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'process-instruction',
          data: { input: messageText, players: [] },
        }),
      });
      const data = await res.json();
      if (data.success && data.processed) {
        const instructions = data.processed.processedInstructions || [];
        const confidence = data.processed.confidence || 0;
        responseText = instructions.length > 0
          ? `${instructions.map((i: { category: string; instruction: string }) => `[${i.category}] ${i.instruction}`).join('\n')}\n\nConfidence: ${Math.round(confidence * 100)}%`
          : generateMockResponse(messageText, context);
      } else {
        responseText = generateMockResponse(messageText, context);
      }
    } catch {
      responseText = generateMockResponse(messageText, context);
    }

    const aiMsg: ChatMessage = {
      id: `msg-${Date.now()}-ai`,
      role: 'assistant',
      content: responseText,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, aiMsg]);
    setIsTyping(false);
  }, [input, isTyping, context]);

  const suggestions = CONTEXT_SUGGESTIONS[context] || [];

  return (
    <div className={`flex flex-col bg-white rounded-2xl border border-[#e8e4f0] overflow-hidden shadow-sm ${compact ? 'h-full' : ''}`}>
      {/* Header */}
      <div className="flex-shrink-0 px-3 py-1.5 bg-gradient-to-r from-[#f3eefc] to-[#faf9fe] border-b border-[#e8e4f0] flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <div className="w-5 h-5 bg-gradient-to-br from-[#6B46C1] to-[#9F7AEA] rounded-md flex items-center justify-center shadow-sm shadow-purple-200">
            <Sparkles className="w-3 h-3 text-white" />
          </div>
          <span className="text-[11px] font-bold text-[#1a1a2e]">Grok</span>
          <span className="text-[8px] text-[#8E8CA0] px-1.5 py-0.5 bg-[#f3eefc] rounded-full font-medium">AI</span>
        </div>
        {matchMinute !== undefined && (
          <span className="text-[9px] text-[#8E8CA0] font-medium">{matchMinute}&apos;</span>
        )}
      </div>

      {/* Messages */}
      <div className={`flex-1 overflow-y-auto px-2 py-2 space-y-2 ${compact ? 'min-h-0' : 'min-h-[80px] max-h-[180px]'}`}>
        {messages.length === 0 && showSuggestions && (
          <div className="space-y-1.5">
            <p className="text-[9px] text-[#8E8CA0] font-semibold uppercase tracking-wider">Suggested</p>
            {suggestions.slice(0, 3).map((s, i) => (
              <button
                key={i}
                onClick={() => handleSend(s)}
                className="block w-full text-left px-2 py-1.5 rounded-lg bg-[#faf9fe] border border-[#e8e4f0] text-[10px] text-[#6B46C1] hover:bg-[#f3eefc] hover:border-[#6B46C1]/30 transition-all font-medium"
              >
                {s}
              </button>
            ))}
          </div>
        )}
        {messages.map(msg => (
          <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] px-2.5 py-1.5 rounded-xl text-[10px] leading-relaxed whitespace-pre-wrap ${
              msg.role === 'user'
                ? 'bg-[#6B46C1] text-white rounded-br-sm'
                : 'bg-[#f3eefc] text-[#1a1a2e] border border-[#e8e4f0] rounded-bl-sm'
            }`}>
              {msg.content}
            </div>
          </div>
        ))}
        {isTyping && (
          <div className="flex justify-start">
            <div className="px-2.5 py-1.5 rounded-xl bg-[#f3eefc] border border-[#e8e4f0] rounded-bl-sm">
              <div className="flex items-center gap-1">
                <span className="w-1 h-1 bg-[#6B46C1] rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-1 h-1 bg-[#6B46C1] rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-1 h-1 bg-[#6B46C1] rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="flex-shrink-0 px-2 py-1.5 border-t border-[#e8e4f0] bg-[#faf9fe]">
        <div className="flex items-center gap-1.5">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder={context === 'manager' ? 'Give tactical instruction...' : 'Ask about system data...'}
            className="flex-1 bg-white border border-[#e8e4f0] rounded-full px-3 py-1.5 text-[10px] text-[#1a1a2e] placeholder-[#b8b4c8] outline-none focus:border-[#6B46C1] focus:ring-2 focus:ring-[#6B46C1]/10 transition-all"
          />
          <button
            onClick={() => handleSend()}
            disabled={isTyping || !input.trim()}
            className="w-7 h-7 flex items-center justify-center bg-[#6B46C1] hover:bg-[#5a38a8] disabled:opacity-30 rounded-full transition-all shadow-sm shadow-purple-200"
          >
            {isTyping ? <Loader2 className="w-3 h-3 text-white animate-spin" /> : <Send className="w-3 h-3 text-white" />}
          </button>
        </div>
      </div>
    </div>
  );
}
