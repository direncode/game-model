"use client";

import { useState } from "react";
import { MessageSquare, Send, X } from "lucide-react";
import { useTCDStore } from "@/lib/tcd/store";
import { queryAgent } from "@/lib/tcd/api";
import { cn } from "@/lib/utils";

const SUGGESTIONS = [
  "What hidden dependencies did you find?",
  "Which modules are highest value?",
  "Where are knowledge gaps?",
  "Explain the strongest causal chain.",
];

interface Message {
  role: "user" | "agent";
  text: string;
  sources?: string[];
  confidence?: number;
}

export default function TCDAIDrawer() {
  const { sessionId, agentOpen, setAgentOpen } = useTCDStore();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const sendMessage = async (question: string) => {
    if (!sessionId || !question.trim()) return;
    setMessages((prev) => [...prev, { role: "user", text: question }]);
    setInput("");
    setLoading(true);
    try {
      const resp = await queryAgent(sessionId, question);
      setMessages((prev) => [
        ...prev,
        { role: "agent", text: resp.answer, sources: resp.sources, confidence: resp.confidence },
      ]);
    } catch (e: any) {
      setMessages((prev) => [...prev, { role: "agent", text: `Error: ${e.message}` }]);
    }
    setLoading(false);
  };

  if (!agentOpen) {
    return (
      <button
        onClick={() => setAgentOpen(true)}
        className="fixed bottom-6 right-6 w-12 h-12 bg-cyan-600 hover:bg-cyan-500 rounded-full flex items-center justify-center shadow-lg shadow-cyan-600/30 transition-all z-50"
      >
        <MessageSquare className="w-5 h-5 text-white" />
      </button>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 w-96 h-[500px] bg-li-gray-900 border border-li-gray-700 rounded-xl shadow-2xl flex flex-col z-50">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-li-gray-800">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-cyan-400" />
          <span className="text-sm font-medium text-white">TCD-JEPA Agent</span>
        </div>
        <button onClick={() => setAgentOpen(false)} className="text-li-text-muted hover:text-white">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {messages.length === 0 && (
          <div className="space-y-2">
            <p className="text-xs text-li-text-muted">Ask about crystallization results:</p>
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                onClick={() => sendMessage(s)}
                className="w-full text-left text-xs px-3 py-2 bg-li-gray-800/50 hover:bg-li-gray-800 rounded-lg text-li-text-secondary transition-colors"
              >
                {s}
              </button>
            ))}
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={cn("text-xs", m.role === "user" ? "text-right" : "")}>
            <div
              className={cn(
                "inline-block max-w-[85%] px-3 py-2 rounded-lg whitespace-pre-wrap",
                m.role === "user"
                  ? "bg-cyan-600/20 text-cyan-100"
                  : "bg-li-gray-800 text-li-text-secondary"
              )}
            >
              {m.text}
              {m.sources && m.sources.length > 0 && (
                <div className="mt-2 pt-1 border-t border-li-gray-700 text-[9px] text-li-text-muted">
                  Sources: {m.sources.join(", ")}
                </div>
              )}
            </div>
          </div>
        ))}
        {loading && (
          <div className="text-xs text-li-text-muted animate-pulse">Analyzing...</div>
        )}
      </div>

      {/* Input */}
      <div className="p-3 border-t border-li-gray-800">
        <div className="flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && sendMessage(input)}
            placeholder="Ask about modules, risks, gaps..."
            className="flex-1 bg-li-gray-800 border border-li-gray-700 rounded-lg px-3 py-2 text-xs text-white placeholder:text-li-text-muted focus:border-cyan-500 focus:outline-none"
          />
          <button
            onClick={() => sendMessage(input)}
            disabled={loading || !input.trim()}
            className="px-3 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 rounded-lg transition-colors"
          >
            <Send className="w-3.5 h-3.5 text-white" />
          </button>
        </div>
      </div>
    </div>
  );
}
