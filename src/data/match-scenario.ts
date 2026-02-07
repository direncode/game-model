// Match Scenario: Manchester United vs Liverpool
// MUN 1-0 LIV, 67th minute, Old Trafford, 4-2-3-1 vs 4-3-3

import { getPLSquadData } from '@/lib/premier-league-api';
import type { Player, MatchEvent, LiveMatchData, TeamMetrics } from '@/types';

export interface MatchScenario {
  home: {
    name: string;
    shortName: string;
    tla: string;
    formation: string;
    players: Player[];
    startingXI: string[]; // player IDs in formation order
    positions: { x: number; y: number }[];
  };
  away: {
    name: string;
    shortName: string;
    tla: string;
    formation: string;
    players: Player[];
    startingXI: string[];
    positions: { x: number; y: number }[];
  };
  match: {
    venue: string;
    minute: number;
    phase: LiveMatchData['phase'];
    score: { home: number; away: number };
    events: MatchEvent[];
    teamMetrics: { home: TeamMetrics; away: TeamMetrics };
  };
}

// MUN 4-2-3-1 positions (home, left to right)
const MUN_POSITIONS = [
  { x: 5, y: 50 },   // GK
  { x: 25, y: 85 },  // RB
  { x: 22, y: 62 },  // CB-R
  { x: 22, y: 38 },  // CB-L
  { x: 25, y: 15 },  // LB
  { x: 38, y: 60 },  // CDM-R
  { x: 38, y: 40 },  // CDM-L (Mainoo)
  { x: 52, y: 50 },  // CAM
  { x: 55, y: 85 },  // RW
  { x: 60, y: 50 },  // ST
  { x: 55, y: 15 },  // LW
];

// LIV 4-3-3 positions (away, right to left)
const LIV_POSITIONS = [
  { x: 95, y: 50 },  // GK
  { x: 78, y: 15 },  // RB
  { x: 80, y: 38 },  // CB-L
  { x: 80, y: 62 },  // CB-R
  { x: 78, y: 85 },  // LB
  { x: 65, y: 50 },  // CDM
  { x: 58, y: 30 },  // CM-L
  { x: 58, y: 70 },  // CM-R
  { x: 48, y: 15 },  // RW
  { x: 45, y: 50 },  // ST
  { x: 48, y: 85 },  // LW
];

const PRE_SEEDED_EVENTS: MatchEvent[] = [
  {
    id: 'evt-1',
    minute: 0,
    type: 'tactical_change',
    description: 'Kick-off — Manchester United get the match underway',
    playersInvolved: ['mun-10'],
  },
  {
    id: 'evt-2',
    minute: 12,
    type: 'card',
    description: 'Yellow card — Ugarte booked for late challenge on Salah',
    playersInvolved: ['mun-6', 'liv-9'],
    impact: 'MUN must be careful in midfield tackles',
  },
  {
    id: 'evt-3',
    minute: 24,
    type: 'tactical_change',
    description: 'Liverpool switch to high press after sustained MUN possession',
    playersInvolved: [],
    impact: 'LIV pressing intensity increased',
  },
  {
    id: 'evt-4',
    minute: 34,
    type: 'goal',
    description: 'GOAL! Fernandes curls in a free-kick from 22 yards — MUN 1-0 LIV',
    playersInvolved: ['mun-8'],
    impact: 'Manchester United take the lead',
  },
  {
    id: 'evt-5',
    minute: 41,
    type: 'card',
    description: 'Yellow card — Gravenberch cautioned for pulling back Fernandes',
    playersInvolved: ['liv-6', 'mun-8'],
  },
  {
    id: 'evt-6',
    minute: 45,
    type: 'tactical_change',
    description: 'Half time — MUN 1-0 LIV',
    playersInvolved: [],
  },
  {
    id: 'evt-7',
    minute: 46,
    type: 'tactical_change',
    description: 'Second half begins — Liverpool push higher',
    playersInvolved: [],
    impact: 'LIV more aggressive in second half',
  },
  {
    id: 'evt-8',
    minute: 58,
    type: 'tactical_change',
    description: 'Amorim signals for MUN to drop deeper and protect the lead',
    playersInvolved: [],
    impact: 'MUN defensive block drops to mid-low',
  },
];

export function initializeMatchScenario(): MatchScenario {
  const munPlayers = getPLSquadData('MUN');
  const livPlayers = getPLSquadData('LIV');

  // MUN starting XI in 4-2-3-1 order
  const munStartingXI = [
    'mun-1',  // GK: Lammens
    'mun-2',  // RB: Dalot
    'mun-3',  // CB: de Ligt
    'mun-4',  // CB: Martinez
    'mun-5',  // LB: Dorgu
    'mun-6',  // CDM: Ugarte
    'mun-7',  // CM: Mainoo
    'mun-8',  // CAM: Fernandes
    'mun-9',  // RW: Mbuemo
    'mun-10', // ST: Sesko
    'mun-11', // LW: Cunha
  ];

  // LIV starting XI in 4-3-3 order
  const livStartingXI = [
    'liv-1',  // GK: Alisson
    'liv-2',  // RB: Alexander-Arnold
    'liv-3',  // CB: van Dijk
    'liv-4',  // CB: Konate
    'liv-5',  // LB: Robertson
    'liv-6',  // CDM: Gravenberch
    'liv-7',  // CM: Mac Allister
    'liv-8',  // CM: Szoboszlai
    'liv-9',  // RW: Salah
    'liv-10', // LW: Diaz
    'liv-11', // ST: Nunez
  ];

  return {
    home: {
      name: 'Manchester United',
      shortName: 'Man United',
      tla: 'MUN',
      formation: '4-2-3-1',
      players: munPlayers,
      startingXI: munStartingXI,
      positions: MUN_POSITIONS,
    },
    away: {
      name: 'Liverpool FC',
      shortName: 'Liverpool',
      tla: 'LIV',
      formation: '4-3-3',
      players: livPlayers,
      startingXI: livStartingXI,
      positions: LIV_POSITIONS,
    },
    match: {
      venue: 'Old Trafford',
      minute: 67,
      phase: 'second_half',
      score: { home: 1, away: 0 },
      events: PRE_SEEDED_EVENTS,
      teamMetrics: {
        home: {
          possession: 44,
          passAccuracy: 82,
          pressureSuccess: 38,
          territorialControl: 42,
          compactness: 78,
          formationMaintenance: 85,
        },
        away: {
          possession: 56,
          passAccuracy: 87,
          pressureSuccess: 45,
          territorialControl: 58,
          compactness: 72,
          formationMaintenance: 80,
        },
      },
    },
  };
}

// Get ordered starting XI players from full squad
export function getStartingXI(players: Player[], ids: string[]): Player[] {
  return ids
    .map((id) => players.find((p) => p.id === id))
    .filter((p): p is Player => p !== undefined);
}
