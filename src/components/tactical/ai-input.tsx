'use client';

import { useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { TextArea } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { processManagerInput } from '@/lib/ai-manager-interface';
import type { Player, GameModel, ManagerInput, ProcessedInstruction } from '@/types';
import { Mic, MicOff, Send, Check, X, AlertCircle, Loader2 } from 'lucide-react';

interface AIInputProps {
  players: Player[];
  currentGameModel?: GameModel;
  onInstructionsProcessed?: (input: ManagerInput) => void;
  onInstructionsApplied?: (instructions: ProcessedInstruction[]) => void;
  className?: string;
}

export function AIInput({
  players,
  currentGameModel,
  onInstructionsProcessed,
  onInstructionsApplied,
  className,
}: AIInputProps) {
  const [input, setInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [processedResult, setProcessedResult] = useState<ManagerInput | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleProcess = useCallback(async () => {
    if (!input.trim()) return;

    setIsProcessing(true);
    setError(null);

    try {
      // Process locally first
      const result = processManagerInput(input, {
        players,
        currentGameModel,
      });

      setProcessedResult(result);
      onInstructionsProcessed?.(result);

      // Optionally send to API for more sophisticated processing
      const response = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'process-instruction',
          data: { input, players, currentGameModel },
        }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.processed) {
          setProcessedResult(data.processed);
          onInstructionsProcessed?.(data.processed);
        }
      }
    } catch (err) {
      setError('Failed to process instruction');
    } finally {
      setIsProcessing(false);
    }
  }, [input, players, currentGameModel, onInstructionsProcessed]);

  const handleApply = useCallback(() => {
    if (processedResult) {
      onInstructionsApplied?.(processedResult.processedInstructions);
      setInput('');
      setProcessedResult(null);
    }
  }, [processedResult, onInstructionsApplied]);

  const handleClear = useCallback(() => {
    setProcessedResult(null);
    setError(null);
  }, []);

  const toggleRecording = useCallback(() => {
    if (!isRecording) {
      // Start speech recognition (browser API)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const win = window as any;
      if (win.webkitSpeechRecognition || win.SpeechRecognition) {
        const SpeechRecognitionClass = win.webkitSpeechRecognition || win.SpeechRecognition;
        const recognition = new SpeechRecognitionClass();
        recognition.continuous = true;
        recognition.interimResults = true;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        recognition.onresult = (event: any) => {
          const transcript = Array.from(event.results)
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            .map((result: any) => result[0].transcript)
            .join('');
          setInput(transcript);
        };

        recognition.onerror = () => {
          setIsRecording(false);
        };

        recognition.onend = () => {
          setIsRecording(false);
        };

        recognition.start();
        setIsRecording(true);
      } else {
        setError('Speech recognition not supported in this browser');
      }
    } else {
      setIsRecording(false);
    }
  }, [isRecording]);

  return (
    <Card className={cn('', className)}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <span>AI Tactical Assistant</span>
          {isProcessing && <Loader2 className="w-4 h-4 animate-spin" />}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Input area */}
        <div className="space-y-2">
          <div className="relative">
            <TextArea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Enter tactical instructions... (e.g., 'I want the team to press high when the ball is with their goalkeeper. The wingers should tuck in and the fullbacks push up.')"
              rows={4}
              className="pr-12"
            />
            <button
              onClick={toggleRecording}
              className={cn(
                'absolute right-2 top-2 p-2 rounded-full transition-colors',
                isRecording ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              )}
            >
              {isRecording ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            </button>
          </div>

          <div className="flex gap-2">
            <Button
              onClick={handleProcess}
              disabled={!input.trim() || isProcessing}
              className="flex-1"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4 mr-2" />
                  Process Instructions
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Error display */}
        {error && (
          <div className="flex items-center gap-2 p-3 bg-red-50 text-red-700 rounded-lg">
            <AlertCircle className="w-4 h-4" />
            <span className="text-sm">{error}</span>
          </div>
        )}

        {/* Processed result */}
        {processedResult && (
          <div className="space-y-3 p-4 bg-gray-50 rounded-lg">
            <div className="flex items-center justify-between">
              <h4 className="font-medium text-gray-900">Processed Instructions</h4>
              <div className="flex items-center gap-1">
                <span className="text-xs text-gray-500">Confidence:</span>
                <span
                  className={cn(
                    'text-xs font-bold',
                    processedResult.confidence >= 0.8
                      ? 'text-green-600'
                      : processedResult.confidence >= 0.6
                      ? 'text-yellow-600'
                      : 'text-red-600'
                  )}
                >
                  {Math.round(processedResult.confidence * 100)}%
                </span>
              </div>
            </div>

            {processedResult.needsVerification && (
              <div className="flex items-center gap-2 p-2 bg-yellow-50 text-yellow-700 rounded">
                <AlertCircle className="w-4 h-4" />
                <span className="text-sm">This instruction needs verification</span>
              </div>
            )}

            <div className="space-y-2">
              {processedResult.processedInstructions.map((instruction, idx) => (
                <InstructionCard key={idx} instruction={instruction} />
              ))}
            </div>

            <div className="flex gap-2 pt-2">
              <Button onClick={handleApply} variant="primary" className="flex-1">
                <Check className="w-4 h-4 mr-2" />
                Apply to Game Model
              </Button>
              <Button onClick={handleClear} variant="outline">
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}

        {/* Quick suggestions */}
        <div className="space-y-2">
          <span className="text-xs text-gray-500">Quick instructions:</span>
          <div className="flex flex-wrap gap-2">
            {[
              'High press on goalkeeper',
              'Compact midfield block',
              'Quick transitions',
              'Play out from back',
              'Wingers stay wide',
            ].map((suggestion) => (
              <button
                key={suggestion}
                onClick={() => setInput(suggestion)}
                className="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded-full hover:bg-gray-200 transition-colors"
              >
                {suggestion}
              </button>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

interface InstructionCardProps {
  instruction: ProcessedInstruction;
}

function InstructionCard({ instruction }: InstructionCardProps) {
  const categoryColors: Record<string, string> = {
    formation: 'bg-purple-100 text-purple-700',
    pressing: 'bg-red-100 text-red-700',
    possession: 'bg-blue-100 text-blue-700',
    transition: 'bg-green-100 text-green-700',
    player_specific: 'bg-yellow-100 text-yellow-700',
    general: 'bg-gray-100 text-gray-700',
  };

  return (
    <div className="p-3 bg-white rounded-lg border border-gray-200">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1">
          <span
            className={cn(
              'inline-block px-2 py-0.5 text-xs font-medium rounded-full mb-1',
              categoryColors[instruction.category]
            )}
          >
            {instruction.category.replace('_', ' ')}
          </span>
          <p className="text-sm text-gray-800">{instruction.instruction}</p>
        </div>
        <div className="text-xs text-gray-500">
          P{instruction.priority}
        </div>
      </div>

      {instruction.affectedPlayers.length > 0 && (
        <div className="mt-2 flex items-center gap-1">
          <span className="text-xs text-gray-500">Players:</span>
          {instruction.affectedPlayers.slice(0, 3).map((player) => (
            <span
              key={player}
              className="px-1.5 py-0.5 text-xs bg-gray-100 rounded"
            >
              {player}
            </span>
          ))}
          {instruction.affectedPlayers.length > 3 && (
            <span className="text-xs text-gray-500">
              +{instruction.affectedPlayers.length - 3} more
            </span>
          )}
        </div>
      )}

      {instruction.affectedPhases.length > 0 && instruction.affectedPhases[0] !== 'all' && (
        <div className="mt-1 flex items-center gap-1">
          <span className="text-xs text-gray-500">Phases:</span>
          {instruction.affectedPhases.map((phase) => (
            <span
              key={phase}
              className="px-1.5 py-0.5 text-xs bg-blue-50 text-blue-600 rounded"
            >
              {phase}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
