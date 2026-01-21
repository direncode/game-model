'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  MessageSquare,
  Mic,
  MicOff,
  Send,
  Check,
  X,
  AlertCircle,
  Activity,
  Users,
  Target,
  Settings,
  ChevronDown,
  ChevronRight,
  Loader2,
  Brain,
  Zap,
  Shield,
} from 'lucide-react';
import {
  GameModelManager,
  ManagerSession,
  StaffMember,
  CoherenceSnapshot,
  GAME_MODEL_TEMPLATES,
  AIQueryResult,
} from '@/lib/game-model-manager';
import { VerificationRequest, ProcessedInstruction, GameModel } from '@/types';

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
  onSessionStart,
  currentMinute,
  isLive,
}: ManagerConsoleProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [activeTab, setActiveTab] = useState<'chat' | 'model' | 'approach'>('chat');
  const [latestCoherence, setLatestCoherence] = useState<CoherenceSnapshot | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Subscribe to coherence updates
  useEffect(() => {
    const unsubscribe = manager.onCoherenceUpdate((snapshot) => {
      setLatestCoherence(snapshot);
    });
    return unsubscribe;
  }, [manager]);

  // Auto-scroll to latest message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Add welcome message
  useEffect(() => {
    if (session && messages.length === 0) {
      setMessages([
        {
          id: 'welcome',
          type: 'system',
          content: `Welcome, ${session.manager.name}. Session started. You can now give tactical instructions in natural language, create a game model, or query live coherence data.`,
          timestamp: new Date(),
        },
      ]);
    }
  }, [session, messages.length]);

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
      // Check if this is a query or an instruction
      const isQuery = input.toLowerCase().includes('?') ||
        input.toLowerCase().startsWith('how') ||
        input.toLowerCase().startsWith('what') ||
        input.toLowerCase().startsWith('show') ||
        input.toLowerCase().startsWith('tell');

      if (isQuery) {
        // Handle as coherence query
        const result = await manager.queryLiveCoherence(input);

        const aiMessage: ChatMessage = {
          id: `ai-${Date.now()}`,
          type: 'ai',
          content: result.response,
          timestamp: new Date(),
          data: {
            coherence: result.coherenceData,
            suggestions: result.suggestions,
          },
        };
        setMessages(prev => [...prev, aiMessage]);
      } else {
        // Handle as tactical instruction
        const result = await manager.processManagerInstruction(input, 'text');

        if (result.verification) {
          // Needs verification
          const verificationMessage: ChatMessage = {
            id: `verify-${Date.now()}`,
            type: 'verification',
            content: `Instruction needs verification. Confidence: ${Math.round(result.processed.confidence * 100)}%`,
            timestamp: new Date(),
            data: {
              instructions: result.processed.processedInstructions,
              verification: result.verification,
            },
          };
          setMessages(prev => [...prev, verificationMessage]);
        } else if (result.applied) {
          // Applied successfully
          const systemMessage: ChatMessage = {
            id: `system-${Date.now()}`,
            type: 'system',
            content: `Instruction applied successfully. ${result.processed.processedInstructions.length} change(s) made to game model.`,
            timestamp: new Date(),
            data: {
              instructions: result.processed.processedInstructions,
            },
          };
          setMessages(prev => [...prev, systemMessage]);
        }
      }
    } catch (error) {
      const errorMessage: ChatMessage = {
        id: `error-${Date.now()}`,
        type: 'system',
        content: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMessage]);
    }

    setIsProcessing(false);
  }, [input, isProcessing, manager]);

  const handleVerification = useCallback((
    verificationId: string,
    approved: boolean,
    modifications?: string
  ) => {
    const staff: StaffMember = session?.technicalStaff[0] || session?.manager || {
      id: 'system',
      name: 'System',
      role: 'analyst',
      canVerify: true,
      canModify: true,
    };

    const success = manager.verifyInstruction(
      verificationId,
      staff,
      approved ? 'verified' : 'rejected',
      modifications
    );

    const resultMessage: ChatMessage = {
      id: `result-${Date.now()}`,
      type: 'system',
      content: approved
        ? 'Instruction verified and applied to game model.'
        : 'Instruction rejected.',
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, resultMessage]);
  }, [session, manager]);

  const handleTemplateSelect = useCallback((templateId: string) => {
    try {
      const gameModel = manager.createGameModelFromTemplate(templateId);

      const systemMessage: ChatMessage = {
        id: `template-${Date.now()}`,
        type: 'system',
        content: `Game model "${gameModel.name}" created from template. Formation: ${gameModel.formation.name}. You can now customize it with natural language instructions.`,
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, systemMessage]);
      setShowTemplates(false);
    } catch (error) {
      console.error('Error creating game model:', error);
    }
  }, [manager]);

  const toggleRecording = useCallback(() => {
    // Voice recording would integrate with Web Speech API
    setIsRecording(!isRecording);

    if (!isRecording) {
      // Start recording - use browser's Speech Recognition if available
      const SpeechRecognitionAPI = (window as Window & {
        SpeechRecognition?: new () => { continuous: boolean; interimResults: boolean; onresult: (event: { results: { [key: number]: { [key: number]: { transcript: string } } } }) => void; onerror: () => void; start: () => void };
        webkitSpeechRecognition?: new () => { continuous: boolean; interimResults: boolean; onresult: (event: { results: { [key: number]: { [key: number]: { transcript: string } } } }) => void; onerror: () => void; start: () => void };
      }).SpeechRecognition || (window as Window & { webkitSpeechRecognition?: new () => { continuous: boolean; interimResults: boolean; onresult: (event: { results: { [key: number]: { [key: number]: { transcript: string } } } }) => void; onerror: () => void; start: () => void } }).webkitSpeechRecognition;

      if (SpeechRecognitionAPI) {
        const recognizer = new SpeechRecognitionAPI();
        recognizer.continuous = false;
        recognizer.interimResults = false;

        recognizer.onresult = (event) => {
          const transcript = event.results[0][0].transcript;
          setInput(transcript);
          setIsRecording(false);
        };

        recognizer.onerror = () => {
          setIsRecording(false);
        };

        recognizer.start();
      } else {
        // Speech recognition not available
        setIsRecording(false);
        console.warn('Speech recognition not available in this browser');
      }
    }
  }, [isRecording]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  }, [handleSendMessage]);

  const activeGameModel = manager.getActiveGameModel();

  return (
    <div className="flex flex-col h-full bg-zinc-900 rounded-lg border border-zinc-700 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-zinc-800 border-b border-zinc-700">
        <div className="flex items-center gap-3">
          <Brain className="w-5 h-5 text-blue-400" />
          <span className="font-semibold text-white">Manager Console</span>
          {isLive && (
            <span className="flex items-center gap-1 px-2 py-0.5 bg-green-500/20 text-green-400 text-xs rounded-full">
              <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
              LIVE {currentMinute}'
            </span>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-1">
          {(['chat', 'model', 'approach'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-3 py-1 text-sm rounded transition-colors ${
                activeTab === tab
                  ? 'bg-blue-500 text-white'
                  : 'text-zinc-400 hover:text-white hover:bg-zinc-700'
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Live Coherence Bar */}
      {latestCoherence && isLive && (
        <div className="px-4 py-2 bg-zinc-800/50 border-b border-zinc-700">
          <div className="flex items-center justify-between text-sm">
            <span className="text-zinc-400">Live Coherence</span>
            <div className="flex items-center gap-4">
              <span className={`font-mono ${
                latestCoherence.overallScore >= 70 ? 'text-green-400' :
                latestCoherence.overallScore >= 50 ? 'text-yellow-400' : 'text-red-400'
              }`}>
                {latestCoherence.overallScore}%
              </span>
              <span className="text-zinc-500">|</span>
              <span className="text-zinc-400">GPS: {latestCoherence.gpsCoherence.toFixed(0)}%</span>
              <span className="text-zinc-400">Tactical: {latestCoherence.tacticalCoherence.toFixed(0)}%</span>
              {latestCoherence.deviations.length > 0 && (
                <>
                  <span className="text-zinc-500">|</span>
                  <span className="text-orange-400 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    {latestCoherence.deviations.length} deviation(s)
                  </span>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Content Area */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'chat' && (
          <div className="flex flex-col h-full">
            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.map(message => (
                <MessageBubble
                  key={message.id}
                  message={message}
                  onVerify={handleVerification}
                />
              ))}
              {isProcessing && (
                <div className="flex items-center gap-2 text-zinc-400">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Processing...</span>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="p-4 border-t border-zinc-700 bg-zinc-800/50">
              {/* Quick Actions */}
              <div className="flex gap-2 mb-3">
                <button
                  onClick={() => setShowTemplates(!showTemplates)}
                  className="flex items-center gap-1 px-3 py-1.5 text-sm bg-zinc-700 hover:bg-zinc-600 rounded transition-colors"
                >
                  <Settings className="w-4 h-4" />
                  Game Model
                  {showTemplates ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                </button>
                <button
                  onClick={() => setInput('Show me the current coherence?')}
                  className="flex items-center gap-1 px-3 py-1.5 text-sm bg-zinc-700 hover:bg-zinc-600 rounded transition-colors"
                >
                  <Activity className="w-4 h-4" />
                  Coherence
                </button>
                <button
                  onClick={() => setInput('Who needs substituting?')}
                  className="flex items-center gap-1 px-3 py-1.5 text-sm bg-zinc-700 hover:bg-zinc-600 rounded transition-colors"
                >
                  <Users className="w-4 h-4" />
                  Fatigue
                </button>
              </div>

              {/* Templates Dropdown */}
              {showTemplates && (
                <div className="mb-3 p-3 bg-zinc-800 rounded-lg border border-zinc-600">
                  <h4 className="text-sm font-medium text-zinc-300 mb-2">Select Game Model Template</h4>
                  <div className="grid grid-cols-2 gap-2">
                    {GAME_MODEL_TEMPLATES.map(template => (
                      <button
                        key={template.id}
                        onClick={() => handleTemplateSelect(template.id)}
                        className="p-3 text-left bg-zinc-700 hover:bg-zinc-600 rounded-lg transition-colors"
                      >
                        <div className="flex items-center gap-2 mb-1">
                          {template.style === 'high_press' && <Zap className="w-4 h-4 text-orange-400" />}
                          {template.style === 'counter_attacking' && <Target className="w-4 h-4 text-blue-400" />}
                          {template.style === 'possession' && <Activity className="w-4 h-4 text-green-400" />}
                          {template.style === 'total_football' && <Brain className="w-4 h-4 text-purple-400" />}
                          <span className="font-medium text-white text-sm">{template.name}</span>
                        </div>
                        <p className="text-xs text-zinc-400">{template.description}</p>
                        <p className="text-xs text-zinc-500 mt-1">Formation: {template.baseFormation}</p>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Text Input */}
              <div className="flex gap-2">
                <div className="flex-1 relative">
                  <textarea
                    ref={inputRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Give tactical instructions or ask about coherence..."
                    className="w-full px-4 py-3 bg-zinc-700 border border-zinc-600 rounded-lg text-white placeholder-zinc-400 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                    rows={2}
                    disabled={isProcessing}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <button
                    onClick={toggleRecording}
                    className={`p-3 rounded-lg transition-colors ${
                      isRecording
                        ? 'bg-red-500 text-white'
                        : 'bg-zinc-700 text-zinc-300 hover:bg-zinc-600'
                    }`}
                    title={isRecording ? 'Stop recording' : 'Start voice input'}
                  >
                    {isRecording ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                  </button>
                  <button
                    onClick={handleSendMessage}
                    disabled={!input.trim() || isProcessing}
                    className="p-3 bg-blue-500 hover:bg-blue-600 disabled:bg-zinc-600 disabled:cursor-not-allowed rounded-lg transition-colors"
                  >
                    <Send className="w-5 h-5 text-white" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'model' && (
          <GameModelView gameModel={activeGameModel} />
        )}

        {activeTab === 'approach' && (
          <GameApproachView manager={manager} />
        )}
      </div>
    </div>
  );
}

// ==================== Message Bubble Component ====================

interface MessageBubbleProps {
  message: ChatMessage;
  onVerify: (id: string, approved: boolean, modifications?: string) => void;
}

function MessageBubble({ message, onVerify }: MessageBubbleProps) {
  const isUser = message.type === 'user';
  const isVerification = message.type === 'verification';

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[80%] rounded-lg p-3 ${
          isUser
            ? 'bg-blue-500 text-white'
            : message.type === 'system'
            ? 'bg-zinc-700 text-zinc-200'
            : message.type === 'verification'
            ? 'bg-yellow-500/20 border border-yellow-500/50 text-yellow-100'
            : 'bg-zinc-800 text-zinc-200 border border-zinc-700'
        }`}
      >
        {/* Message Type Icon */}
        {!isUser && (
          <div className="flex items-center gap-2 mb-2 text-xs text-zinc-400">
            {message.type === 'system' && <Shield className="w-3 h-3" />}
            {message.type === 'ai' && <Brain className="w-3 h-3 text-blue-400" />}
            {message.type === 'verification' && <AlertCircle className="w-3 h-3 text-yellow-400" />}
            <span>
              {message.type === 'ai' ? 'AI Response' : message.type === 'verification' ? 'Verification Required' : 'System'}
            </span>
            <span className="text-zinc-500">
              {message.timestamp.toLocaleTimeString()}
            </span>
          </div>
        )}

        {/* Content */}
        <p className="whitespace-pre-wrap">{message.content}</p>

        {/* Instructions */}
        {message.data?.instructions && message.data.instructions.length > 0 && (
          <div className="mt-2 pt-2 border-t border-zinc-600">
            <p className="text-xs text-zinc-400 mb-1">Interpreted Instructions:</p>
            {message.data.instructions.map((inst, i) => (
              <div key={i} className="text-xs bg-zinc-700/50 rounded px-2 py-1 mb-1">
                <span className="text-blue-400">[{inst.category}]</span> {inst.instruction}
                <span className="text-zinc-500 ml-2">({Math.round(inst.confidence * 100)}%)</span>
              </div>
            ))}
          </div>
        )}

        {/* Suggestions */}
        {message.data?.suggestions && message.data.suggestions.length > 0 && (
          <div className="mt-2 pt-2 border-t border-zinc-600">
            <p className="text-xs text-zinc-400 mb-1">Suggestions:</p>
            {message.data.suggestions.map((sug, i) => (
              <div key={i} className="text-xs text-green-400">
                {sug}
              </div>
            ))}
          </div>
        )}

        {/* Verification Actions */}
        {isVerification && message.data?.verification && (
          <div className="mt-3 flex gap-2">
            <button
              onClick={() => onVerify(message.data!.verification!.id, true)}
              className="flex items-center gap-1 px-3 py-1.5 bg-green-500 hover:bg-green-600 text-white text-sm rounded transition-colors"
            >
              <Check className="w-4 h-4" />
              Verify
            </button>
            <button
              onClick={() => onVerify(message.data!.verification!.id, false)}
              className="flex items-center gap-1 px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white text-sm rounded transition-colors"
            >
              <X className="w-4 h-4" />
              Reject
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ==================== Game Model View ====================

function GameModelView({ gameModel }: { gameModel: GameModel | null }) {
  if (!gameModel) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-zinc-400">
        <Settings className="w-12 h-12 mb-4 opacity-50" />
        <p>No game model loaded</p>
        <p className="text-sm mt-2">Select a template from the Chat tab to get started</p>
      </div>
    );
  }

  return (
    <div className="p-4 overflow-y-auto h-full space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-white">{gameModel.name}</h3>
          <p className="text-sm text-zinc-400">Formation: {gameModel.formation.name}</p>
        </div>
        <span className={`px-2 py-1 text-xs rounded ${
          gameModel.status === 'active' ? 'bg-green-500/20 text-green-400' :
          gameModel.status === 'validated' ? 'bg-blue-500/20 text-blue-400' :
          'bg-yellow-500/20 text-yellow-400'
        }`}>
          {gameModel.status.toUpperCase()}
        </span>
      </div>

      {/* Formation Details */}
      <div className="bg-zinc-800 rounded-lg p-4">
        <h4 className="text-sm font-medium text-zinc-300 mb-2">Formation Structure</h4>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-zinc-500">Compactness</p>
            <p className="text-white">V: {gameModel.formation.compactness.vertical.target}m / H: {gameModel.formation.compactness.horizontal.target}m</p>
          </div>
          <div>
            <p className="text-zinc-500">Width</p>
            <p className="text-white">In Poss: {gameModel.formation.width.inPossession}m / Out: {gameModel.formation.width.outOfPossession}m</p>
          </div>
          <div>
            <p className="text-zinc-500">Defensive Line</p>
            <p className="text-white">{gameModel.formation.depth.defensiveLineHeight}m from goal</p>
          </div>
          <div>
            <p className="text-zinc-500">Pressure Line</p>
            <p className="text-white">{gameModel.formation.depth.pressureLineHeight}m from goal</p>
          </div>
        </div>
      </div>

      {/* Principles */}
      <div className="bg-zinc-800 rounded-lg p-4">
        <h4 className="text-sm font-medium text-zinc-300 mb-2">Tactical Principles</h4>
        <div className="space-y-2">
          {gameModel.principles.generalPrinciples.map((principle, i) => (
            <div key={i} className="flex items-start gap-2 text-sm">
              <span className="text-blue-400">&#x2022;</span>
              <span className="text-zinc-300">{principle}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Pressure Triggers */}
      {gameModel.pressureTriggers.length > 0 && (
        <div className="bg-zinc-800 rounded-lg p-4">
          <h4 className="text-sm font-medium text-zinc-300 mb-2">Pressure Triggers</h4>
          <div className="space-y-2">
            {gameModel.pressureTriggers.map((trigger) => (
              <div key={trigger.id} className="flex items-center justify-between text-sm bg-zinc-700/50 rounded p-2">
                <span className="text-zinc-300">{trigger.name}</span>
                <span className={`px-2 py-0.5 rounded text-xs ${
                  trigger.intensity === 'max' ? 'bg-red-500/20 text-red-400' :
                  trigger.intensity === 'high' ? 'bg-orange-500/20 text-orange-400' :
                  'bg-yellow-500/20 text-yellow-400'
                }`}>
                  {trigger.intensity.toUpperCase()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Transition Rules */}
      <div className="bg-zinc-800 rounded-lg p-4">
        <h4 className="text-sm font-medium text-zinc-300 mb-2">Transition Rules</h4>
        <div className="space-y-3">
          {gameModel.transitionRules.map((rule) => (
            <div key={rule.id} className="text-sm">
              <div className="flex items-center gap-2 mb-1">
                <span className={`px-2 py-0.5 rounded text-xs ${
                  rule.type === 'positive' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                }`}>
                  {rule.type === 'positive' ? 'ATTACK' : 'DEFEND'}
                </span>
                <span className="text-zinc-500">{rule.timeLimit}s window</span>
              </div>
              <p className="text-zinc-400 text-xs">{rule.trigger}</p>
              <ul className="mt-1 ml-4 text-xs text-zinc-500">
                {rule.immediateActions.map((action, i) => (
                  <li key={i}>&#x2022; {action}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ==================== Game Approach View ====================

function GameApproachView({ manager }: { manager: GameModelManager }) {
  const [opponentInfo, setOpponentInfo] = useState('');
  const [matchContext, setMatchContext] = useState('');
  const approach = manager.getActiveGameApproach();

  const handleCreateApproach = () => {
    try {
      manager.createGameApproach(
        `match-${Date.now()}`,
        opponentInfo,
        matchContext
      );
    } catch (error) {
      console.error('Error creating approach:', error);
    }
  };

  if (!manager.getActiveGameModel()) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-zinc-400">
        <Target className="w-12 h-12 mb-4 opacity-50" />
        <p>Create a Game Model first</p>
        <p className="text-sm mt-2">Then you can create match-specific approaches</p>
      </div>
    );
  }

  return (
    <div className="p-4 overflow-y-auto h-full space-y-4">
      {!approach ? (
        <>
          <h3 className="text-lg font-semibold text-white">Create Game Approach</h3>

          <div className="space-y-4">
            <div>
              <label className="block text-sm text-zinc-400 mb-1">Opponent Information</label>
              <textarea
                value={opponentInfo}
                onChange={(e) => setOpponentInfo(e.target.value)}
                placeholder="e.g., Manchester United play 4-2-3-1. Strengths: quick transitions, set pieces. Weaknesses: high line can be exploited..."
                className="w-full px-3 py-2 bg-zinc-700 border border-zinc-600 rounded-lg text-white placeholder-zinc-500 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={4}
              />
            </div>

            <div>
              <label className="block text-sm text-zinc-400 mb-1">Match Context</label>
              <textarea
                value={matchContext}
                onChange={(e) => setMatchContext(e.target.value)}
                placeholder="e.g., Home match, must win to stay in title race, key players available..."
                className="w-full px-3 py-2 bg-zinc-700 border border-zinc-600 rounded-lg text-white placeholder-zinc-500 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={3}
              />
            </div>

            <button
              onClick={handleCreateApproach}
              className="w-full py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors"
            >
              Generate Game Approach
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-white">Game Approach</h3>
            <span className="text-sm text-zinc-400">vs {approach.opponent.teamName}</span>
          </div>

          {/* Opponent */}
          <div className="bg-zinc-800 rounded-lg p-4">
            <h4 className="text-sm font-medium text-zinc-300 mb-2">Opponent Analysis</h4>
            <p className="text-sm text-zinc-400">Formation: {approach.opponent.formation}</p>
            {approach.opponent.strengths.length > 0 && (
              <div className="mt-2">
                <p className="text-xs text-zinc-500">Strengths:</p>
                {approach.opponent.strengths.map((s, i) => (
                  <span key={i} className="inline-block text-xs bg-red-500/20 text-red-400 rounded px-2 py-0.5 mr-1 mt-1">{s}</span>
                ))}
              </div>
            )}
            {approach.opponent.weaknesses.length > 0 && (
              <div className="mt-2">
                <p className="text-xs text-zinc-500">Weaknesses:</p>
                {approach.opponent.weaknesses.map((w, i) => (
                  <span key={i} className="inline-block text-xs bg-green-500/20 text-green-400 rounded px-2 py-0.5 mr-1 mt-1">{w}</span>
                ))}
              </div>
            )}
          </div>

          {/* Adjustments */}
          {approach.adjustments.length > 0 && (
            <div className="bg-zinc-800 rounded-lg p-4">
              <h4 className="text-sm font-medium text-zinc-300 mb-2">Tactical Adjustments</h4>
              <div className="space-y-2">
                {approach.adjustments.map((adj) => (
                  <div key={adj.id} className="text-sm bg-zinc-700/50 rounded p-2">
                    <p className="text-zinc-300">{adj.description}</p>
                    <p className="text-xs text-zinc-500 mt-1">Reason: {adj.reason}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Priority Focus */}
          {approach.priorityFocus.length > 0 && (
            <div className="bg-zinc-800 rounded-lg p-4">
              <h4 className="text-sm font-medium text-zinc-300 mb-2">Priority Focus</h4>
              <div className="flex flex-wrap gap-2">
                {approach.priorityFocus.map((focus, i) => (
                  <span key={i} className="text-xs bg-blue-500/20 text-blue-400 rounded-full px-3 py-1">
                    {focus}
                  </span>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default ManagerConsole;
