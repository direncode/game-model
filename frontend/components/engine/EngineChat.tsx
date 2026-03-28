"use client";

import React, { useEffect, useRef } from "react";
import { useEngineStore } from "@/stores/engine";
import EngineChatMessage from "./EngineChatMessage";

export default function EngineChat() {
  const { chatMessages, initChat } = useEngineStore();
  const bottomRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Initialize chat on mount
  useEffect(() => {
    initChat();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages.length]);

  return (
    <div ref={containerRef} className="flex-1 overflow-y-auto">
      <div className="max-w-3xl mx-auto px-4 py-6 space-y-1">
        {chatMessages.map((msg) => (
          <EngineChatMessage key={msg.id} message={msg} />
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
