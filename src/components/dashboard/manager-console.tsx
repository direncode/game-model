'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Mic, MicOff, Loader2 } from 'lucide-react';
import {
  GameModelManager,
  ManagerSession,
  StaffMember,
  CoherenceSnapshot,
  GAME_MODEL_TEMPLATES,
} from '@/lib/game-model-manager';
import { VerificationRequest, ProcessedInstruction } from '@/types';

interface ManagerConsoleProps {
  manager: GameModelManager;
  session: ManagerSession | null;
  onSessionStart: (manager: StaffMember, staff: StaffMember[]) => void;
  currentMinute: number;
  isLive: boolean;
}

interface ChatMessage {
  id: string;
  type: 'user' | 'system' | 'ai' | 'verification';
  content: string;
  timestamp: Date;
  data?: {
    instructions?: ProcessedInstruction[];
    coherence?: CoherenceSnapshot;
    verification?: VerificationRequest;
    suggestions?: string[];
  };
}

export function ManagerConsole({
  manager,
  session,
  currentMinute,
  isLive,
}: ManagerConsoleProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = useCallback(async () => {
    if (!input.trim() || isProcessing) return;

    const userMessage: ChatMessage = {
      id: `msg-${Date.now()}`,
      type: 'user',
      content: input,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsProcessing(true);

    try {
      const isQuery = input.toLowerCase().includes('?') ||
        input.toLowerCase().startsWith('how') ||
        input.toLowerCase().startsWith('what') ||
        input.toLowerCase().startsWith('show');

      if (isQuery) {
        const result = await manager.queryLiveCoherence(input);
        setMessages(prev => [...prev, {
          id: `ai-${Date.now()}`,
          type: 'ai',
          content: result.response,
          timestamp: new Date(),
        }]);
      } else {
        const result = await manager.processManagerInstruction(input, 'text');
        if (result.applied) {
          setMessages(prev => [...prev, {
            id: `system-${Date.now()}`,
            type: 'system',
            content: `Applied ${result.processed.processedInstructions.length} instruction(s)`,
            timestamp: new Date(),
          }]);
        } else if (result.verification) {
          setMessages(prev => [...prev, {
            id: `verify-${Date.now()}`,
            type: 'verification',
            content: `Needs verification (${Math.round(result.processed.confidence * 100)}% confidence)`,
            timestamp: new Date(),
          }]);
        }
      }
    } catch (error) {
      setMessages(prev => [...prev, {
        id: `error-${Date.now()}`,
        type: 'system',
        content: error instanceof Error ? error.message : 'Error processing',
        timestamp: new Date(),
      }]);
    }

    setIsProcessing(false);
  }, [input, isProcessing, manager]);

  const handleTemplateSelect = useCallback((templateId: string) => {
    try {
      const gameModel = manager.createGameModelFromTemplate(templateId);
      setMessages(prev => [...prev, {
        id: `template-${Date.now()}`,
        type: 'system',
        content: `Created "${gameModel.name}" (${gameModel.formation.name})`,
        timestamp: new Date(),
      }]);
      setShowTemplates(false);
    } catch (error) {
      console.error('Error creating game model:', error);
    }
  }, [manager]);

  const toggleRecording = useCallback(() => {
    setIsRecording(!isRecording);
    if (!isRecording) {
      const SpeechRecognitionAPI = (window as Window & {
        SpeechRecognition?: new () => { continuous: boolean; interimResults: boolean; onresult: (event: { results: { [key: number]: { [key: number]: { transcript: string } } } }) => void; onerror: () => void; start: () => void };
        webkitSpeechRecognition?: new () => { continuous: boolean; interimResults: boolean; onresult: (event: { results: { [key: number]: { [key: number]: { transcript: string } } } }) => void; onerror: () => void; start: () => void };
      }).SpeechRecognition || (window as Window & { webkitSpeechRecognition?: new () => { continuous: boolean; interimResults: boolean; onresult: (event: { results: { [key: number]: { [key: number]: { transcript: string } } } }) => void; onerror: () => void; start: () => void } }).webkitSpeechRecognition;

      if (SpeechRecognitionAPI) {
        const recognizer = new SpeechRecognitionAPI();
        recognizer.continuous = false;
        recognizer.interimResults = false;
        recognizer.onresult = (event) => {
          setInput(event.results[0][0].transcript);
          setIsRecording(false);
        };
        recognizer.onerror = () => setIsRecording(false);
        recognizer.start();
      } else {
        setIsRecording(false);
      }
    }
  }, [isRecording]);

  const activeModel = manager.getActiveGameModel();

  return (
    <div className="h-full flex flex-col bg-black rounded-xl overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 flex items-center justify-between px-4 py-2 border-b border-white/5">
        <div className="flex items-center gap-3">
          <span className="text-[11px] uppercase tracking-widest text-white/40 font-medium">Manager AI</span>
          {isLive && (
            <span className="text-[11px] text-emerald-400">{currentMinute}&apos;</span>
          )}
        </div>
        {activeModel && (
          <span className="text-[11px] text-white/30">{activeModel.name}</span>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-2 space-y-2">
        {messages.length === 0 && !showTemplates && (
          <div className="text-center py-4">
            <p className="text-white/30 text-[13px] mb-3">Give tactical instructions or ask questions</p>
            <button
              onClick={() => setShowTemplates(true)}
              className="text-[13px] text-sky-400 hover:text-sky-300 transition-colors"
            >
              Select game model →
            </button>
          </div>
        )}

        {showTemplates && (
          <div className="grid grid-cols-2 gap-2">
            {GAME_MODEL_TEMPLATES.map(t => (
              <button
                key={t.id}
                onClick={() => handleTemplateSelect(t.id)}
                className="text-left p-2 bg-white/[0.03] hover:bg-white/[0.06] rounded-lg transition-colors"
              >
                <div className="text-[13px] text-white/90">{t.name}</div>
                <div className="text-[11px] text-white/30">{t.baseFormation}</div>
              </button>
            ))}
          </div>
        )}

        {messages.map(msg => (
          <div
            key={msg.id}
            className={`text-[13px] ${
              msg.type === 'user' ? 'text-white/90 bg-white/[0.06] rounded-lg px-3 py-1.5 ml-8' :
              msg.type === 'ai' ? 'text-white/70 bg-sky-500/10 rounded-lg px-3 py-1.5 mr-8' :
              msg.type === 'verification' ? 'text-amber-400 bg-amber-500/10 rounded-lg px-3 py-1.5' :
              'text-white/40'
            }`}
          >
            {msg.content}
          </div>
        ))}
        {isProcessing && (
          <div className="flex items-center gap-2 text-white/30 text-[13px]">
            <Loader2 className="w-3 h-3 animate-spin" />
            Processing...
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="flex-shrink-0 px-3 py-2 border-t border-white/5">
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
            placeholder="Press high when they pass back..."
            className="flex-1 bg-white/[0.03] border-0 rounded-full px-4 py-2 text-[13px] text-white placeholder-white/20 focus:outline-none focus:ring-1 focus:ring-white/20"
            disabled={isProcessing}
          />
          <button
            onClick={toggleRecording}
            className={`w-8 h-8 flex items-center justify-center rounded-full transition-colors ${
              isRecording ? 'bg-red-500 text-white' : 'bg-white/[0.06] text-white/40 hover:text-white/60'
            }`}
          >
            {isRecording ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
          </button>
          <button
            onClick={handleSendMessage}
            disabled={!input.trim() || isProcessing}
            className="w-8 h-8 flex items-center justify-center bg-white text-black rounded-full disabled:opacity-30 disabled:cursor-not-allowed hover:bg-white/90 transition-colors"
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

export default ManagerConsole;
