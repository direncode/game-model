'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { InstructionLogEntry } from '@/lib/instruction-log';
import {
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  FileText,
  TrendingUp,
  TrendingDown,
  Minus,
  Filter,
} from 'lucide-react';

interface InstructionLogPanelProps {
  logs: InstructionLogEntry[];
  onSelectLog?: (log: InstructionLogEntry) => void;
  className?: string;
}

export function InstructionLogPanel({
  logs,
  onSelectLog,
  className,
}: InstructionLogPanelProps) {
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);
  const [filterCategory, setFilterCategory] = useState<string | null>(null);

  const filteredLogs = filterCategory
    ? logs.filter((log) =>
        log.processedInstructions.some((i) => i.category === filterCategory)
      )
    : logs;

  const categories = [
    ...new Set(logs.flatMap((log) => log.processedInstructions.map((i) => i.category))),
  ];

  return (
    <Card className={cn('', className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Instruction Log
          </CardTitle>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">{logs.length} entries</span>
          </div>
        </div>

        {/* Filters */}
        {categories.length > 0 && (
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <Filter className="w-4 h-4 text-gray-400" />
            <button
              onClick={() => setFilterCategory(null)}
              className={cn(
                'px-2 py-1 text-xs rounded-full',
                filterCategory === null
                  ? 'bg-blue-100 text-blue-700'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              )}
            >
              All
            </button>
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setFilterCategory(cat)}
                className={cn(
                  'px-2 py-1 text-xs rounded-full capitalize',
                  filterCategory === cat
                    ? 'bg-blue-100 text-blue-700'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                )}
              >
                {cat.replace('_', ' ')}
              </button>
            ))}
          </div>
        )}
      </CardHeader>

      <CardContent className="pt-0">
        <div className="space-y-2 max-h-[600px] overflow-y-auto">
          {filteredLogs.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <FileText className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No instruction logs yet</p>
              <p className="text-xs">Instructions will appear here as you give them</p>
            </div>
          ) : (
            filteredLogs.map((log) => (
              <LogEntryCard
                key={log.id}
                log={log}
                expanded={expandedLogId === log.id}
                onToggle={() =>
                  setExpandedLogId(expandedLogId === log.id ? null : log.id)
                }
                onSelect={() => onSelectLog?.(log)}
              />
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}

interface LogEntryCardProps {
  log: InstructionLogEntry;
  expanded: boolean;
  onToggle: () => void;
  onSelect: () => void;
}

function LogEntryCard({ log, expanded, onToggle, onSelect }: LogEntryCardProps) {
  const statusColors = {
    pending: 'text-yellow-600 bg-yellow-50',
    verified: 'text-green-600 bg-green-50',
    modified: 'text-blue-600 bg-blue-50',
    rejected: 'text-red-600 bg-red-50',
  };

  const applicationColors = {
    pending: 'bg-gray-100',
    applied: 'bg-green-100',
    failed: 'bg-red-100',
    partial: 'bg-yellow-100',
  };

  const coherenceChange = log.coherenceImpact?.change || 0;

  return (
    <div
      className={cn(
        'border rounded-lg overflow-hidden transition-all',
        expanded ? 'border-blue-300 shadow-sm' : 'border-gray-200'
      )}
    >
      {/* Header */}
      <div
        className="p-3 bg-gray-50 cursor-pointer hover:bg-gray-100 transition-colors"
        onClick={onToggle}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            {/* Time and Status */}
            <div className="flex items-center gap-2 mb-1">
              <Clock className="w-3 h-3 text-gray-400" />
              <span className="text-xs text-gray-500">
                {new Date(log.timestamp).toLocaleTimeString()}
              </span>
              <span
                className={cn(
                  'px-1.5 py-0.5 text-xs rounded-full',
                  statusColors[log.verificationStatus]
                )}
              >
                {log.verificationStatus}
              </span>
              <span
                className={cn(
                  'px-1.5 py-0.5 text-xs rounded-full',
                  applicationColors[log.applicationStatus]
                )}
              >
                {log.applicationStatus}
              </span>
            </div>

            {/* Summary */}
            <p className="text-sm font-medium text-gray-900 truncate">
              {log.interpretation.summary}
            </p>

            {/* Categories */}
            <div className="flex items-center gap-1 mt-1">
              {log.interpretation.affectedAreas.map((area) => (
                <span
                  key={area}
                  className="px-1.5 py-0.5 text-xs bg-blue-50 text-blue-700 rounded capitalize"
                >
                  {area}
                </span>
              ))}
            </div>
          </div>

          {/* Coherence Impact */}
          {log.coherenceImpact && (
            <div className="flex items-center gap-1 text-sm">
              {coherenceChange > 0 ? (
                <TrendingUp className="w-4 h-4 text-green-500" />
              ) : coherenceChange < 0 ? (
                <TrendingDown className="w-4 h-4 text-red-500" />
              ) : (
                <Minus className="w-4 h-4 text-gray-400" />
              )}
              <span
                className={cn(
                  'font-medium',
                  coherenceChange > 0
                    ? 'text-green-600'
                    : coherenceChange < 0
                    ? 'text-red-600'
                    : 'text-gray-500'
                )}
              >
                {coherenceChange > 0 ? '+' : ''}
                {coherenceChange.toFixed(1)}%
              </span>
            </div>
          )}

          {/* Expand toggle */}
          <button className="p-1 text-gray-400 hover:text-gray-600">
            {expanded ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>

      {/* Expanded Content */}
      {expanded && (
        <div className="p-3 border-t border-gray-200 space-y-3">
          {/* Raw Input */}
          <div>
            <span className="text-xs font-medium text-gray-500">Input</span>
            <p className="text-sm text-gray-800 bg-gray-50 p-2 rounded mt-1">
              &quot;{log.rawInput}&quot;
            </p>
          </div>

          {/* Processed Instructions */}
          <div>
            <span className="text-xs font-medium text-gray-500">
              Processed Instructions ({log.processedInstructions.length})
            </span>
            <div className="space-y-1 mt-1">
              {log.processedInstructions.map((instruction, idx) => (
                <div
                  key={idx}
                  className="flex items-start gap-2 p-2 bg-gray-50 rounded text-sm"
                >
                  <span className="text-xs font-medium text-gray-400">
                    {idx + 1}.
                  </span>
                  <div className="flex-1">
                    <span className="text-gray-800">{instruction.instruction}</span>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded capitalize">
                        {instruction.category.replace('_', ' ')}
                      </span>
                      <span className="text-xs text-gray-500">
                        P{instruction.priority}
                      </span>
                      <span className="text-xs text-gray-500">
                        {Math.round(instruction.confidence * 100)}% confidence
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Applied Changes */}
          {log.appliedTo.length > 0 && (
            <div>
              <span className="text-xs font-medium text-gray-500">
                Changes Applied ({log.appliedTo.length})
              </span>
              <div className="space-y-1 mt-1">
                {log.appliedTo.map((change, idx) => (
                  <div key={idx} className="text-xs p-2 bg-green-50 rounded">
                    <span className="font-medium">{change.type}</span>:{' '}
                    {change.target}.{change.field}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Outcomes */}
          {log.outcomes.length > 0 && (
            <div>
              <span className="text-xs font-medium text-gray-500">
                Outcomes ({log.outcomes.length})
              </span>
              <div className="space-y-1 mt-1">
                {log.outcomes.map((outcome, idx) => (
                  <div
                    key={idx}
                    className={cn(
                      'text-xs p-2 rounded flex items-center gap-2',
                      outcome.impact === 'positive'
                        ? 'bg-green-50 text-green-700'
                        : outcome.impact === 'negative'
                        ? 'bg-red-50 text-red-700'
                        : 'bg-gray-50 text-gray-700'
                    )}
                  >
                    {outcome.impact === 'positive' ? (
                      <CheckCircle className="w-3 h-3" />
                    ) : outcome.impact === 'negative' ? (
                      <XCircle className="w-3 h-3" />
                    ) : (
                      <AlertCircle className="w-3 h-3" />
                    )}
                    <span>
                      {outcome.matchMinute && `${outcome.matchMinute}' - `}
                      {outcome.description}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Interpretation Details */}
          <div>
            <span className="text-xs font-medium text-gray-500">Details</span>
            <div className="grid grid-cols-2 gap-2 mt-1 text-xs">
              <div className="p-2 bg-gray-50 rounded">
                <span className="text-gray-500">Urgency:</span>{' '}
                <span className="font-medium capitalize">
                  {log.interpretation.urgency.replace('_', ' ')}
                </span>
              </div>
              <div className="p-2 bg-gray-50 rounded">
                <span className="text-gray-500">Complexity:</span>{' '}
                <span className="font-medium capitalize">
                  {log.interpretation.complexity}
                </span>
              </div>
              <div className="p-2 bg-gray-50 rounded">
                <span className="text-gray-500">Input Type:</span>{' '}
                <span className="font-medium capitalize">{log.inputType}</span>
              </div>
              <div className="p-2 bg-gray-50 rounded">
                <span className="text-gray-500">Source:</span>{' '}
                <span className="font-medium capitalize">
                  {log.inputSource.replace('_', ' ')}
                </span>
              </div>
            </div>
          </div>

          {/* Conflicts/Dependencies */}
          {(log.interpretation.conflicts.length > 0 ||
            log.interpretation.dependencies.length > 0) && (
            <div className="grid grid-cols-2 gap-2">
              {log.interpretation.dependencies.length > 0 && (
                <div>
                  <span className="text-xs font-medium text-gray-500">
                    Dependencies
                  </span>
                  <div className="text-xs p-2 bg-blue-50 rounded mt-1">
                    {log.interpretation.dependencies.join(', ')}
                  </div>
                </div>
              )}
              {log.interpretation.conflicts.length > 0 && (
                <div>
                  <span className="text-xs font-medium text-gray-500">
                    Conflicts
                  </span>
                  <div className="text-xs p-2 bg-red-50 text-red-700 rounded mt-1">
                    {log.interpretation.conflicts.join(', ')}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Notes */}
          {log.notes.length > 0 && (
            <div>
              <span className="text-xs font-medium text-gray-500">Notes</span>
              <div className="space-y-1 mt-1">
                {log.notes.map((note, idx) => (
                  <p key={idx} className="text-xs text-gray-600 p-2 bg-gray-50 rounded">
                    {note}
                  </p>
                ))}
              </div>
            </div>
          )}

          {/* Tags */}
          <div className="flex items-center gap-1 flex-wrap pt-2 border-t">
            {log.tags.map((tag) => (
              <span
                key={tag}
                className="px-1.5 py-0.5 text-xs bg-gray-100 text-gray-600 rounded"
              >
                #{tag}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
