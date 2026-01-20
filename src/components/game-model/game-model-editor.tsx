'use client';

import { useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input, TextArea } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { cn, generateId } from '@/lib/utils';
import type { GameModel, Formation, TacticalPrinciples, PlayerInstruction } from '@/types';
import {
  Save,
  Plus,
  Trash2,
  Users,
  Target,
  Shield,
  Zap,
  Settings,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

interface GameModelEditorProps {
  gameModel: GameModel | null;
  onSave: (model: GameModel) => void;
  className?: string;
}

export function GameModelEditor({ gameModel, onSave, className }: GameModelEditorProps) {
  const [model, setModel] = useState<GameModel>(
    gameModel || createDefaultGameModel()
  );
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(['formation', 'possession', 'defensive'])
  );

  const toggleSection = (section: string) => {
    const newSections = new Set(expandedSections);
    if (newSections.has(section)) {
      newSections.delete(section);
    } else {
      newSections.add(section);
    }
    setExpandedSections(newSections);
  };

  const handleSave = useCallback(() => {
    onSave({
      ...model,
      updatedAt: new Date(),
    });
  }, [model, onSave]);

  const updateFormation = (updates: Partial<Formation>) => {
    setModel((prev) => ({
      ...prev,
      formation: { ...prev.formation, ...updates },
    }));
  };

  const addPrinciple = (
    type: 'inPossession' | 'outOfPossession',
    principle: TacticalPrinciples['inPossession'][0] | TacticalPrinciples['outOfPossession'][0]
  ) => {
    setModel((prev) => ({
      ...prev,
      principles: {
        ...prev.principles,
        [type]: [...prev.principles[type], principle],
      },
    }));
  };

  const removePrinciple = (type: 'inPossession' | 'outOfPossession', id: string) => {
    setModel((prev) => ({
      ...prev,
      principles: {
        ...prev.principles,
        [type]: prev.principles[type].filter((p) => p.id !== id),
      },
    }));
  };

  return (
    <div className={cn('space-y-4', className)}>
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <Input
              value={model.name}
              onChange={(e) => setModel((prev) => ({ ...prev, name: e.target.value }))}
              className="text-xl font-bold border-0 p-0 focus:ring-0"
              placeholder="Game Model Name"
            />
            <Button onClick={handleSave}>
              <Save className="w-4 h-4 mr-2" />
              Save Model
            </Button>
          </div>
        </CardHeader>
      </Card>

      {/* Formation Section */}
      <CollapsibleSection
        title="Formation & Shape"
        icon={<Users className="w-4 h-4" />}
        expanded={expandedSections.has('formation')}
        onToggle={() => toggleSection('formation')}
      >
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Formation
            </label>
            <select
              value={model.formation.name}
              onChange={(e) => updateFormation({ name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            >
              <option value="4-3-3">4-3-3</option>
              <option value="4-4-2">4-4-2</option>
              <option value="4-2-3-1">4-2-3-1</option>
              <option value="3-5-2">3-5-2</option>
              <option value="3-4-3">3-4-3</option>
              <option value="5-3-2">5-3-2</option>
              <option value="4-1-4-1">4-1-4-1</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Defensive Line Height (m from goal)
            </label>
            <input
              type="range"
              min="20"
              max="50"
              value={model.formation.depth.defensiveLineHeight}
              onChange={(e) =>
                updateFormation({
                  depth: {
                    ...model.formation.depth,
                    defensiveLineHeight: parseInt(e.target.value),
                  },
                })
              }
              className="w-full"
            />
            <div className="flex justify-between text-xs text-gray-500">
              <span>Deep (20m)</span>
              <span>{model.formation.depth.defensiveLineHeight}m</span>
              <span>High (50m)</span>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Width in Possession (m)
            </label>
            <input
              type="range"
              min="30"
              max="65"
              value={model.formation.width.inPossession}
              onChange={(e) =>
                updateFormation({
                  width: {
                    ...model.formation.width,
                    inPossession: parseInt(e.target.value),
                  },
                })
              }
              className="w-full"
            />
            <div className="flex justify-between text-xs text-gray-500">
              <span>Narrow</span>
              <span>{model.formation.width.inPossession}m</span>
              <span>Wide</span>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Compactness (m between lines)
            </label>
            <input
              type="range"
              min="20"
              max="45"
              value={model.formation.compactness.vertical.target}
              onChange={(e) =>
                updateFormation({
                  compactness: {
                    ...model.formation.compactness,
                    vertical: {
                      ...model.formation.compactness.vertical,
                      target: parseInt(e.target.value),
                    },
                  },
                })
              }
              className="w-full"
            />
            <div className="flex justify-between text-xs text-gray-500">
              <span>Compact</span>
              <span>{model.formation.compactness.vertical.target}m</span>
              <span>Stretched</span>
            </div>
          </div>
        </div>
      </CollapsibleSection>

      {/* In Possession Principles */}
      <CollapsibleSection
        title="In Possession Principles"
        icon={<Target className="w-4 h-4" />}
        expanded={expandedSections.has('possession')}
        onToggle={() => toggleSection('possession')}
      >
        <div className="space-y-3">
          {model.principles.inPossession.map((principle) => (
            <PrincipleCard
              key={principle.id}
              principle={principle}
              onRemove={() => removePrinciple('inPossession', principle.id)}
              onUpdate={(updates) => {
                setModel((prev) => ({
                  ...prev,
                  principles: {
                    ...prev.principles,
                    inPossession: prev.principles.inPossession.map((p) =>
                      p.id === principle.id ? { ...p, ...updates } : p
                    ),
                  },
                }));
              }}
            />
          ))}
          <Button
            variant="outline"
            onClick={() =>
              addPrinciple('inPossession', {
                id: generateId(),
                name: 'New Principle',
                description: '',
                priority: 5,
                triggers: [],
                expectedBehaviors: [],
              })
            }
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Principle
          </Button>
        </div>
      </CollapsibleSection>

      {/* Out of Possession Principles */}
      <CollapsibleSection
        title="Out of Possession / Defensive Principles"
        icon={<Shield className="w-4 h-4" />}
        expanded={expandedSections.has('defensive')}
        onToggle={() => toggleSection('defensive')}
      >
        <div className="space-y-3">
          {model.principles.outOfPossession.map((principle) => (
            <DefensivePrincipleCard
              key={principle.id}
              principle={principle}
              onRemove={() => removePrinciple('outOfPossession', principle.id)}
              onUpdate={(updates) => {
                setModel((prev) => ({
                  ...prev,
                  principles: {
                    ...prev.principles,
                    outOfPossession: prev.principles.outOfPossession.map((p) =>
                      p.id === principle.id ? { ...p, ...updates } : p
                    ),
                  },
                }));
              }}
            />
          ))}
          <Button
            variant="outline"
            onClick={() =>
              addPrinciple('outOfPossession', {
                id: generateId(),
                name: 'New Defensive Principle',
                description: '',
                pressureType: 'mid',
                triggers: [],
                expectedBehaviors: [],
              })
            }
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Principle
          </Button>
        </div>
      </CollapsibleSection>

      {/* Transition Principles */}
      <CollapsibleSection
        title="Transitions"
        icon={<Zap className="w-4 h-4" />}
        expanded={expandedSections.has('transitions')}
        onToggle={() => toggleSection('transitions')}
      >
        <Tabs defaultValue="positive">
          <TabsList>
            <TabsTrigger value="positive">Positive Transition</TabsTrigger>
            <TabsTrigger value="negative">Negative Transition</TabsTrigger>
          </TabsList>
          <TabsContent value="positive">
            <div className="space-y-3">
              {model.principles.transitions
                .filter((t) => t.type === 'attacking')
                .map((transition) => (
                  <TransitionCard
                    key={transition.id}
                    transition={transition}
                    onUpdate={(updates) => {
                      setModel((prev) => ({
                        ...prev,
                        principles: {
                          ...prev.principles,
                          transitions: prev.principles.transitions.map((t) =>
                            t.id === transition.id ? { ...t, ...updates } : t
                          ),
                        },
                      }));
                    }}
                  />
                ))}
            </div>
          </TabsContent>
          <TabsContent value="negative">
            <div className="space-y-3">
              {model.principles.transitions
                .filter((t) => t.type === 'defensive')
                .map((transition) => (
                  <TransitionCard
                    key={transition.id}
                    transition={transition}
                    onUpdate={(updates) => {
                      setModel((prev) => ({
                        ...prev,
                        principles: {
                          ...prev.principles,
                          transitions: prev.principles.transitions.map((t) =>
                            t.id === transition.id ? { ...t, ...updates } : t
                          ),
                        },
                      }));
                    }}
                  />
                ))}
            </div>
          </TabsContent>
        </Tabs>
      </CollapsibleSection>

      {/* General Principles */}
      <CollapsibleSection
        title="General Principles"
        icon={<Settings className="w-4 h-4" />}
        expanded={expandedSections.has('general')}
        onToggle={() => toggleSection('general')}
      >
        <div className="space-y-2">
          {model.principles.generalPrinciples.map((principle, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <Input
                value={principle}
                onChange={(e) => {
                  const newPrinciples = [...model.principles.generalPrinciples];
                  newPrinciples[idx] = e.target.value;
                  setModel((prev) => ({
                    ...prev,
                    principles: {
                      ...prev.principles,
                      generalPrinciples: newPrinciples,
                    },
                  }));
                }}
                placeholder="Enter principle..."
              />
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setModel((prev) => ({
                    ...prev,
                    principles: {
                      ...prev.principles,
                      generalPrinciples: prev.principles.generalPrinciples.filter(
                        (_, i) => i !== idx
                      ),
                    },
                  }));
                }}
              >
                <Trash2 className="w-4 h-4 text-red-500" />
              </Button>
            </div>
          ))}
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setModel((prev) => ({
                ...prev,
                principles: {
                  ...prev.principles,
                  generalPrinciples: [...prev.principles.generalPrinciples, ''],
                },
              }));
            }}
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Principle
          </Button>
        </div>
      </CollapsibleSection>
    </div>
  );
}

// Sub-components

interface CollapsibleSectionProps {
  title: string;
  icon: React.ReactNode;
  expanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}

function CollapsibleSection({
  title,
  icon,
  expanded,
  onToggle,
  children,
}: CollapsibleSectionProps) {
  return (
    <Card>
      <CardHeader
        className="cursor-pointer hover:bg-gray-50 transition-colors"
        onClick={onToggle}
      >
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            {icon}
            {title}
          </CardTitle>
          {expanded ? (
            <ChevronUp className="w-5 h-5 text-gray-400" />
          ) : (
            <ChevronDown className="w-5 h-5 text-gray-400" />
          )}
        </div>
      </CardHeader>
      {expanded && <CardContent>{children}</CardContent>}
    </Card>
  );
}

interface PrincipleCardProps {
  principle: TacticalPrinciples['inPossession'][0];
  onRemove: () => void;
  onUpdate: (updates: Partial<TacticalPrinciples['inPossession'][0]>) => void;
}

function PrincipleCard({ principle, onRemove, onUpdate }: PrincipleCardProps) {
  return (
    <div className="p-4 bg-gray-50 rounded-lg space-y-3">
      <div className="flex items-center justify-between">
        <Input
          value={principle.name}
          onChange={(e) => onUpdate({ name: e.target.value })}
          className="font-medium"
          placeholder="Principle name"
        />
        <Button variant="ghost" size="sm" onClick={onRemove}>
          <Trash2 className="w-4 h-4 text-red-500" />
        </Button>
      </div>
      <TextArea
        value={principle.description}
        onChange={(e) => onUpdate({ description: e.target.value })}
        placeholder="Describe this principle..."
        rows={2}
      />
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-600">Priority:</label>
          <input
            type="number"
            min="1"
            max="10"
            value={principle.priority}
            onChange={(e) => onUpdate({ priority: parseInt(e.target.value) })}
            className="w-16 px-2 py-1 border rounded"
          />
        </div>
      </div>
    </div>
  );
}

interface DefensivePrincipleCardProps {
  principle: TacticalPrinciples['outOfPossession'][0];
  onRemove: () => void;
  onUpdate: (updates: Partial<TacticalPrinciples['outOfPossession'][0]>) => void;
}

function DefensivePrincipleCard({
  principle,
  onRemove,
  onUpdate,
}: DefensivePrincipleCardProps) {
  return (
    <div className="p-4 bg-gray-50 rounded-lg space-y-3">
      <div className="flex items-center justify-between">
        <Input
          value={principle.name}
          onChange={(e) => onUpdate({ name: e.target.value })}
          className="font-medium"
          placeholder="Principle name"
        />
        <Button variant="ghost" size="sm" onClick={onRemove}>
          <Trash2 className="w-4 h-4 text-red-500" />
        </Button>
      </div>
      <TextArea
        value={principle.description}
        onChange={(e) => onUpdate({ description: e.target.value })}
        placeholder="Describe this defensive principle..."
        rows={2}
      />
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-600">Press Type:</label>
          <select
            value={principle.pressureType}
            onChange={(e) =>
              onUpdate({
                pressureType: e.target.value as 'high' | 'mid' | 'low' | 'variable',
              })
            }
            className="px-2 py-1 border rounded"
          >
            <option value="high">High Press</option>
            <option value="mid">Mid Block</option>
            <option value="low">Low Block</option>
            <option value="variable">Variable</option>
          </select>
        </div>
      </div>
    </div>
  );
}

interface TransitionCardProps {
  transition: TacticalPrinciples['transitions'][0];
  onUpdate: (updates: Partial<TacticalPrinciples['transitions'][0]>) => void;
}

function TransitionCard({ transition, onUpdate }: TransitionCardProps) {
  return (
    <div className="p-4 bg-gray-50 rounded-lg space-y-3">
      <Input
        value={transition.name}
        onChange={(e) => onUpdate({ name: e.target.value })}
        className="font-medium"
        placeholder="Transition name"
      />
      <TextArea
        value={transition.description}
        onChange={(e) => onUpdate({ description: e.target.value })}
        placeholder="Describe this transition behavior..."
        rows={2}
      />
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-600">Time Window:</label>
          <input
            type="number"
            min="1"
            max="15"
            value={transition.timeWindow}
            onChange={(e) => onUpdate({ timeWindow: parseInt(e.target.value) })}
            className="w-16 px-2 py-1 border rounded"
          />
          <span className="text-sm text-gray-500">seconds</span>
        </div>
      </div>
    </div>
  );
}

// Helper function to create default game model
function createDefaultGameModel(): GameModel {
  return {
    id: generateId(),
    name: 'New Game Model',
    createdBy: 'Manager',
    createdAt: new Date(),
    updatedAt: new Date(),
    formation: {
      name: '4-3-3',
      shape: {
        positions: [],
        lines: [],
      },
      compactness: {
        vertical: { min: 25, max: 40, target: 30 },
        horizontal: { min: 30, max: 50, target: 40 },
      },
      width: {
        inPossession: 55,
        outOfPossession: 40,
        transitions: 45,
      },
      depth: {
        defensiveLineHeight: 35,
        pressureLineHeight: 60,
        compactZoneDepth: 30,
      },
    },
    principles: {
      inPossession: [
        {
          id: generateId(),
          name: 'Build from Back',
          description: 'Patient build-up play starting from the goalkeeper',
          priority: 8,
          triggers: ['goalkeeper has ball', 'defenders have space'],
          expectedBehaviors: [],
        },
      ],
      outOfPossession: [
        {
          id: generateId(),
          name: 'Organized Press',
          description: 'Coordinated pressing from the front',
          pressureType: 'high',
          triggers: ['ball played to goalkeeper', 'opposition in own half'],
          expectedBehaviors: [],
        },
      ],
      transitions: [
        {
          id: generateId(),
          type: 'attacking',
          name: 'Quick Counter',
          description: 'Fast vertical play on winning ball',
          timeWindow: 8,
          expectedBehaviors: [],
        },
        {
          id: generateId(),
          type: 'defensive',
          name: 'Counter-Press',
          description: 'Immediate pressure on losing ball',
          timeWindow: 5,
          expectedBehaviors: [],
        },
      ],
      generalPrinciples: [
        'Keep possession under pressure',
        'Create numerical superiority',
        'Exploit space behind defensive line',
      ],
    },
    phases: {
      buildUp: { description: '', keyPoints: [], playerMovements: [], passingPatterns: [], triggers: [] },
      progression: { description: '', keyPoints: [], playerMovements: [], passingPatterns: [], triggers: [] },
      finalThird: { description: '', keyPoints: [], playerMovements: [], passingPatterns: [], triggers: [] },
      pressing: { description: '', keyPoints: [], playerMovements: [], passingPatterns: [], triggers: [] },
      defensiveBlock: { description: '', keyPoints: [], playerMovements: [], passingPatterns: [], triggers: [] },
      attackingTransition: { description: '', keyPoints: [], playerMovements: [], passingPatterns: [], triggers: [] },
      defensiveTransition: { description: '', keyPoints: [], playerMovements: [], passingPatterns: [], triggers: [] },
    },
    pressureTriggers: [],
    transitionRules: [],
    setPlays: [],
    playerInstructions: new Map(),
    validatedBy: [],
    status: 'draft',
  };
}
