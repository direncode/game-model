"use client";

import { useState, useRef, useEffect } from "react";
import { Sidebar } from "@/components/Sidebar";
import { Navbar } from "@/components/Navbar";
import { useDataEstateStore } from "@/lib/data-estate/store";
import { estateChat } from "@/lib/data-estate/api";
import { MessageSquare, Send, Bot, User } from "lucide-react";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  sources?: string[];
  module_hits?: number;
}

export default function EstateChatPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    const question = input.trim();
    if (!question || loading) return;

    const userMsg: ChatMessage = { role: "user", content: question };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const res = await estateChat(question);
      const assistantMsg: ChatMessage = {
        role: "assistant",
        content: res.answer,
        sources: res.sources,
        module_hits: res.module_hits,
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `Error: ${err.message || "Failed to get a response."}`,
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="min-h-screen bg-li-bg">
      <Navbar />
      <Sidebar />
      <main className="ml-60 pt-14 p-6 flex flex-col" style={{ height: "100vh" }}>
        {/* Header */}
        <div className="mb-4 flex-shrink-0">
          <h1 className="text-2xl font-semibold text-white flex items-center gap-2">
            <MessageSquare className="w-6 h-6 text-blue-400" />
            Estate Chat
          </h1>
          <p className="text-sm text-li-text-muted mt-1">
            Ask questions about your crystallized knowledge base
          </p>
        </div>

        {/* Messages area */}
        <div className="flex-1 overflow-y-auto li-card p-4 mb-4 space-y-4">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-li-text-muted">
              <Bot className="w-10 h-10 mb-3 opacity-40" />
              <p className="text-sm">Ask a question about your data estate</p>
              <p className="text-xs mt-1 opacity-60">
                The assistant has access to your crystallized modules, submissions, and ledger data
              </p>
            </div>
          )}

          {messages.map((msg, i) => (
            <div
              key={i}
              className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              {msg.role === "assistant" && (
                <div className="w-7 h-7 rounded-full bg-blue-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Bot className="w-4 h-4 text-blue-400" />
                </div>
              )}
              <div
                className={`max-w-[70%] rounded-lg px-4 py-3 text-sm ${
                  msg.role === "user"
                    ? "bg-cyan-500/15 text-white border border-cyan-500/20"
                    : "bg-li-gray-900 text-white border border-li-gray-800"
                }`}
              >
                <p className="whitespace-pre-wrap">{msg.content}</p>
                {msg.role === "assistant" && msg.module_hits !== undefined && msg.module_hits > 0 && (
                  <p className="text-xs text-li-text-muted mt-2">
                    Referenced {msg.module_hits} module{msg.module_hits !== 1 ? "s" : ""}
                  </p>
                )}
              </div>
              {msg.role === "user" && (
                <div className="w-7 h-7 rounded-full bg-cyan-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <User className="w-4 h-4 text-cyan-400" />
                </div>
              )}
            </div>
          ))}

          {loading && (
            <div className="flex gap-3">
              <div className="w-7 h-7 rounded-full bg-blue-500/20 flex items-center justify-center flex-shrink-0">
                <Bot className="w-4 h-4 text-blue-400" />
              </div>
              <div className="bg-li-gray-900 border border-li-gray-800 rounded-lg px-4 py-3">
                <div className="flex gap-1">
                  <span className="w-2 h-2 bg-li-text-muted rounded-full animate-bounce" />
                  <span className="w-2 h-2 bg-li-text-muted rounded-full animate-bounce [animation-delay:0.15s]" />
                  <span className="w-2 h-2 bg-li-text-muted rounded-full animate-bounce [animation-delay:0.3s]" />
                </div>
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="flex-shrink-0 flex gap-3">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about your data estate..."
            disabled={loading}
            className="flex-1 px-4 py-3 bg-li-gray-900 border border-li-gray-800 rounded-lg text-sm text-white placeholder:text-li-text-muted focus:outline-none focus:border-cyan-500/40 disabled:opacity-50"
          />
          <button
            onClick={handleSend}
            disabled={loading || !input.trim()}
            className="px-4 py-3 bg-cyan-500 hover:bg-cyan-600 disabled:bg-cyan-500/30 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </main>
    </div>
  );
}
