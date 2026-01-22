// Premier League API Integration
// Using Football-Data.org API (free tier available) and API-Football

import type {
  Player,
  TrackingMetrics,
  PhysicalProfile,
  PlayerPosition,
} from '@/types';

// ==================== API Configuration ====================

const FOOTBALL_DATA_API_KEY = process.env.NEXT_PUBLIC_FOOTBALL_DATA_API_KEY || '';
const API_FOOTBALL_KEY = process.env.NEXT_PUBLIC_API_FOOTBALL_KEY || '';

const FOOTBALL_DATA_BASE_URL = 'https://api.football-data.org/v4';
const API_FOOTBALL_BASE_URL = 'https://v3.football.api-sports.io';

// Premier League Competition ID
const PREMIER_LEAGUE_ID = 'PL';
const PREMIER_LEAGUE_SEASON = 2024;

// ==================== Types ====================

export interface PLTeam {
  id: number;
  name: string;
  shortName: string;
  tla: string;
  crest: string;
  address: string;
  website: string;
  founded: number;
  clubColors: string;
  venue: string;
  coach?: PLCoach;
  squad?: PLPlayer[];
}

export interface PLCoach {
  id: number;
  name: string;
  nationality: string;
  dateOfBirth: string;
}

export interface PLPlayer {
  id: number;
  name: string;
  position: string;
  dateOfBirth: string;
  nationality: string;
  shirtNumber?: number;
  marketValue?: number;
}

export interface PLMatch {
  id: number;
  utcDate: string;
  status: string;
  matchday: number;
  stage: string;
  homeTeam: { id: number; name: string; shortName: string; crest: string };
  awayTeam: { id: number; name: string; shortName: string; crest: string };
  score: {
    winner: string | null;
    fullTime: { home: number | null; away: number | null };
    halfTime: { home: number | null; away: number | null };
  };
}

export interface PLStanding {
  position: number;
  team: { id: number; name: string; shortName: string; crest: string };
  playedGames: number;
  won: number;
  draw: number;
  lost: number;
  points: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
}

export interface PlayerStatistics {
  playerId: number;
  season: string;
  team: string;
  appearances: number;
  goals: number;
  assists: number;
  yellowCards: number;
  redCards: number;
  minutesPlayed: number;
  // Performance metrics
  passAccuracy?: number;
  shotsOnTarget?: number;
  tacklesWon?: number;
  aerialDuelsWon?: number;
  // Physical metrics from tracking
  avgDistancePerMatch?: number;
  avgSprintDistance?: number;
  avgTopSpeed?: number;
  avgHighIntensityRuns?: number;
}

export interface PlayerCareerHistory {
  playerId: number;
  playerName: string;
  currentTeam: string;
  seasons: PlayerSeasonData[];
  totalAppearances: number;
  totalGoals: number;
  totalAssists: number;
  physicalProfile: PhysicalProfile;
  injuryHistory: InjuryRecord[];
  transferHistory: TransferRecord[];
}

export interface PlayerSeasonData {
  season: string;
  team: string;
  league: string;
  appearances: number;
  goals: number;
  assists: number;
  minutesPlayed: number;
  avgRating?: number;
  trackingData?: SeasonTrackingData;
}

export interface SeasonTrackingData {
  totalDistance: number;
  avgDistancePerMatch: number;
  totalSprints: number;
  avgSprintsPerMatch: number;
  maxSpeed: number;
  avgTopSpeed: number;
  totalHighIntensityRuns: number;
  avgPlayerLoad: number;
}

export interface InjuryRecord {
  date: string;
  type: string;
  severity: 'minor' | 'moderate' | 'major';
  daysOut: number;
  matchesMissed: number;
}

export interface TransferRecord {
  date: string;
  fromTeam: string;
  toTeam: string;
  fee?: number;
  type: 'transfer' | 'loan' | 'free' | 'youth';
}

// ==================== API Fetching Functions ====================

async function fetchFromFootballData(endpoint: string) {
  const response = await fetch(`${FOOTBALL_DATA_BASE_URL}${endpoint}`, {
    headers: {
      'X-Auth-Token': FOOTBALL_DATA_API_KEY,
    },
    next: { revalidate: 3600 }, // Cache for 1 hour
  });

  if (!response.ok) {
    throw new Error(`Football-Data API error: ${response.status}`);
  }

  return response.json();
}

async function fetchFromAPIFootball(endpoint: string) {
  const response = await fetch(`${API_FOOTBALL_BASE_URL}${endpoint}`, {
    headers: {
      'x-rapidapi-key': API_FOOTBALL_KEY,
      'x-rapidapi-host': 'v3.football.api-sports.io',
    },
    next: { revalidate: 3600 },
  });

  if (!response.ok) {
    throw new Error(`API-Football error: ${response.status}`);
  }

  return response.json();
}

// ==================== Premier League Data Functions ====================

export async function getPLTeams(): Promise<PLTeam[]> {
  try {
    const data = await fetchFromFootballData(`/competitions/${PREMIER_LEAGUE_ID}/teams`);
    return data.teams || [];
  } catch (error) {
    console.error('Error fetching PL teams:', error);
    return getPLTeamsFallback();
  }
}

export async function getPLTeamSquad(teamId: number): Promise<PLPlayer[]> {
  try {
    const data = await fetchFromFootballData(`/teams/${teamId}`);
    return data.squad || [];
  } catch (error) {
    console.error('Error fetching team squad:', error);
    return [];
  }
}

export async function getPLStandings(): Promise<PLStanding[]> {
  try {
    const data = await fetchFromFootballData(`/competitions/${PREMIER_LEAGUE_ID}/standings`);
    return data.standings?.[0]?.table || [];
  } catch (error) {
    console.error('Error fetching PL standings:', error);
    return [];
  }
}

export async function getPLMatches(matchday?: number): Promise<PLMatch[]> {
  try {
    const endpoint = matchday
      ? `/competitions/${PREMIER_LEAGUE_ID}/matches?matchday=${matchday}`
      : `/competitions/${PREMIER_LEAGUE_ID}/matches`;
    const data = await fetchFromFootballData(endpoint);
    return data.matches || [];
  } catch (error) {
    console.error('Error fetching PL matches:', error);
    return [];
  }
}

export async function getPlayerStatistics(playerId: number, season: string): Promise<PlayerStatistics | null> {
  try {
    const data = await fetchFromAPIFootball(`/players?id=${playerId}&season=${season}`);
    const playerData = data.response?.[0];

    if (!playerData) return null;

    const stats = playerData.statistics?.[0];
    return {
      playerId,
      season,
      team: stats?.team?.name || '',
      appearances: stats?.games?.appearences || 0,
      goals: stats?.goals?.total || 0,
      assists: stats?.goals?.assists || 0,
      yellowCards: stats?.cards?.yellow || 0,
      redCards: stats?.cards?.red || 0,
      minutesPlayed: stats?.games?.minutes || 0,
      passAccuracy: stats?.passes?.accuracy || undefined,
      shotsOnTarget: stats?.shots?.on || undefined,
      tacklesWon: stats?.tackles?.total || undefined,
    };
  } catch (error) {
    console.error('Error fetching player statistics:', error);
    return null;
  }
}

// ==================== Player History & Career Functions ====================

export async function getPlayerCareerHistory(playerId: number): Promise<PlayerCareerHistory | null> {
  try {
    // Fetch from API or use cached/fallback data
    const data = await fetchFromAPIFootball(`/players?id=${playerId}&season=2024`);
    const playerData = data.response?.[0];

    if (!playerData) return null;

    const player = playerData.player;
    const statistics = playerData.statistics || [];

    // Build season history
    const seasons: PlayerSeasonData[] = statistics.map((stat: { league: { season: number; name: string }; team: { name: string }; games: { appearences?: number; minutes?: number }; goals: { total?: number; assists?: number } }) => ({
      season: `${stat.league.season}/${stat.league.season + 1}`,
      team: stat.team.name,
      league: stat.league.name,
      appearances: stat.games.appearences || 0,
      goals: stat.goals.total || 0,
      assists: stat.goals.assists || 0,
      minutesPlayed: stat.games.minutes || 0,
    }));

    return {
      playerId: player.id,
      playerName: player.name,
      currentTeam: statistics[0]?.team?.name || 'Unknown',
      seasons,
      totalAppearances: seasons.reduce((sum, s) => sum + s.appearances, 0),
      totalGoals: seasons.reduce((sum, s) => sum + s.goals, 0),
      totalAssists: seasons.reduce((sum, s) => sum + s.assists, 0),
      physicalProfile: estimatePhysicalProfile(player.height, player.weight),
      injuryHistory: [],
      transferHistory: [],
    };
  } catch (error) {
    console.error('Error fetching player career history:', error);
    return null;
  }
}

function estimatePhysicalProfile(height?: string, weight?: string): PhysicalProfile {
  // Estimate based on typical profiles
  const heightCm = height ? parseInt(height) : 180;
  const weightKg = weight ? parseInt(weight) : 75;

  // Taller/heavier players typically have different physical profiles
  const speedModifier = heightCm > 185 ? -1 : heightCm < 175 ? 1 : 0;

  return {
    maxSpeed: 32 + speedModifier + Math.random() * 3,
    accelerationPeak: 4 + (speedModifier * 0.2) + Math.random() * 0.5,
    sprintCapacity: 350 + (weightKg < 75 ? 50 : -20) + Math.random() * 100,
    highIntensityThreshold: 19.5 + Math.random(),
    aerobicThreshold: 150 + Math.random() * 10,
    anaerobicThreshold: 175 + Math.random() * 10,
  };
}

// ==================== Convert PL Data to App Format ====================

export function convertPLPlayerToPlayer(plPlayer: PLPlayer, teamName: string): Player {
  const position = mapPLPosition(plPlayer.position);

  return {
    id: `pl-${plPlayer.id}`,
    name: plPlayer.name,
    number: plPlayer.shirtNumber || 0,
    position,
    preferredFoot: 'right', // Default, would need additional data
    physicalProfile: estimatePhysicalProfile(),
    currentStatus: 'available',
  };
}

function mapPLPosition(position: string): PlayerPosition {
  const positionMap: Record<string, PlayerPosition> = {
    'Goalkeeper': 'GK',
    'Defence': 'CB',
    'Left-Back': 'LB',
    'Right-Back': 'RB',
    'Centre-Back': 'CB',
    'Defensive Midfield': 'CDM',
    'Midfield': 'CM',
    'Central Midfield': 'CM',
    'Attacking Midfield': 'CAM',
    'Left Midfield': 'LM',
    'Right Midfield': 'RM',
    'Left Winger': 'LW',
    'Right Winger': 'RW',
    'Offence': 'ST',
    'Centre-Forward': 'CF',
    'Striker': 'ST',
  };

  return positionMap[position] || 'CM';
}

// ==================== Fallback Data (Top 6 PL Teams) ====================

function getPLTeamsFallback(): PLTeam[] {
  return [
    {
      id: 65,
      name: 'Manchester City FC',
      shortName: 'Man City',
      tla: 'MCI',
      crest: 'https://crests.football-data.org/65.png',
      address: 'SportCity, Rowsley Street Manchester M11 3FF',
      website: 'https://www.mancity.com',
      founded: 1880,
      clubColors: 'Sky Blue / White',
      venue: 'Etihad Stadium',
    },
    {
      id: 57,
      name: 'Arsenal FC',
      shortName: 'Arsenal',
      tla: 'ARS',
      crest: 'https://crests.football-data.org/57.png',
      address: 'Highbury House, 75 Drayton Park London N5 1BU',
      website: 'https://www.arsenal.com',
      founded: 1886,
      clubColors: 'Red / White',
      venue: 'Emirates Stadium',
    },
    {
      id: 64,
      name: 'Liverpool FC',
      shortName: 'Liverpool',
      tla: 'LIV',
      crest: 'https://crests.football-data.org/64.png',
      address: 'Anfield Road Liverpool L4 0TH',
      website: 'https://www.liverpoolfc.com',
      founded: 1892,
      clubColors: 'Red / White',
      venue: 'Anfield',
    },
    {
      id: 66,
      name: 'Manchester United FC',
      shortName: 'Man United',
      tla: 'MUN',
      crest: 'https://crests.football-data.org/66.png',
      address: 'Sir Matt Busby Way Manchester M16 0RA',
      website: 'https://www.manutd.com',
      founded: 1878,
      clubColors: 'Red / White',
      venue: 'Old Trafford',
    },
    {
      id: 61,
      name: 'Chelsea FC',
      shortName: 'Chelsea',
      tla: 'CHE',
      crest: 'https://crests.football-data.org/61.png',
      address: 'Stamford Bridge Fulham Road London SW6 1HS',
      website: 'https://www.chelseafc.com',
      founded: 1905,
      clubColors: 'Blue / White',
      venue: 'Stamford Bridge',
    },
    {
      id: 73,
      name: 'Tottenham Hotspur FC',
      shortName: 'Spurs',
      tla: 'TOT',
      crest: 'https://crests.football-data.org/73.png',
      address: '748 High Road London N17 0AP',
      website: 'https://www.tottenhamhotspur.com',
      founded: 1882,
      clubColors: 'White / Navy Blue',
      venue: 'Tottenham Hotspur Stadium',
    },
  ];
}

// ==================== Comprehensive PL Squad Data ====================

export function getPLSquadData(teamTla: string): Player[] {
  const squads: Record<string, Player[]> = {
    MCI: [
      { id: 'mci-1', name: 'Ederson', number: 31, position: 'GK', preferredFoot: 'left', physicalProfile: { maxSpeed: 26, accelerationPeak: 3.2, sprintCapacity: 180, highIntensityThreshold: 18, aerobicThreshold: 145, anaerobicThreshold: 170 }, currentStatus: 'available' },
      { id: 'mci-2', name: 'Kyle Walker', number: 2, position: 'RB', preferredFoot: 'right', physicalProfile: { maxSpeed: 35.2, accelerationPeak: 4.5, sprintCapacity: 450, highIntensityThreshold: 21, aerobicThreshold: 158, anaerobicThreshold: 183 }, currentStatus: 'available' },
      { id: 'mci-3', name: 'Ruben Dias', number: 3, position: 'CB', preferredFoot: 'right', physicalProfile: { maxSpeed: 31, accelerationPeak: 3.9, sprintCapacity: 320, highIntensityThreshold: 19, aerobicThreshold: 152, anaerobicThreshold: 177 }, currentStatus: 'available' },
      { id: 'mci-5', name: 'John Stones', number: 5, position: 'CB', preferredFoot: 'right', physicalProfile: { maxSpeed: 31.5, accelerationPeak: 4.0, sprintCapacity: 330, highIntensityThreshold: 19.5, aerobicThreshold: 153, anaerobicThreshold: 178 }, currentStatus: 'available' },
      { id: 'mci-6', name: 'Nathan Ake', number: 6, position: 'CB', preferredFoot: 'left', physicalProfile: { maxSpeed: 30.5, accelerationPeak: 3.8, sprintCapacity: 310, highIntensityThreshold: 19, aerobicThreshold: 150, anaerobicThreshold: 175 }, currentStatus: 'available' },
      { id: 'mci-24', name: 'Josko Gvardiol', number: 24, position: 'LB', preferredFoot: 'left', physicalProfile: { maxSpeed: 32, accelerationPeak: 4.1, sprintCapacity: 380, highIntensityThreshold: 20, aerobicThreshold: 155, anaerobicThreshold: 180 }, currentStatus: 'available' },
      { id: 'mci-16', name: 'Rodri', number: 16, position: 'CDM', preferredFoot: 'right', physicalProfile: { maxSpeed: 29, accelerationPeak: 3.6, sprintCapacity: 280, highIntensityThreshold: 18, aerobicThreshold: 148, anaerobicThreshold: 173 }, currentStatus: 'injured' },
      { id: 'mci-8', name: 'Mateo Kovacic', number: 8, position: 'CM', preferredFoot: 'right', physicalProfile: { maxSpeed: 30, accelerationPeak: 3.8, sprintCapacity: 320, highIntensityThreshold: 19, aerobicThreshold: 152, anaerobicThreshold: 177 }, currentStatus: 'available' },
      { id: 'mci-17', name: 'Kevin De Bruyne', number: 17, position: 'CM', preferredFoot: 'right', physicalProfile: { maxSpeed: 31, accelerationPeak: 4.0, sprintCapacity: 350, highIntensityThreshold: 19, aerobicThreshold: 152, anaerobicThreshold: 177 }, currentStatus: 'available' },
      { id: 'mci-20', name: 'Bernardo Silva', number: 20, position: 'CM', preferredFoot: 'left', physicalProfile: { maxSpeed: 29.5, accelerationPeak: 3.7, sprintCapacity: 320, highIntensityThreshold: 18.5, aerobicThreshold: 151, anaerobicThreshold: 176 }, currentStatus: 'available' },
      { id: 'mci-47', name: 'Phil Foden', number: 47, position: 'LW', preferredFoot: 'left', physicalProfile: { maxSpeed: 33, accelerationPeak: 4.3, sprintCapacity: 420, highIntensityThreshold: 21, aerobicThreshold: 158, anaerobicThreshold: 183 }, currentStatus: 'available' },
      { id: 'mci-10', name: 'Jack Grealish', number: 10, position: 'LW', preferredFoot: 'right', physicalProfile: { maxSpeed: 32, accelerationPeak: 4.1, sprintCapacity: 380, highIntensityThreshold: 20, aerobicThreshold: 155, anaerobicThreshold: 180 }, currentStatus: 'available' },
      { id: 'mci-11', name: 'Jeremy Doku', number: 11, position: 'RW', preferredFoot: 'right', physicalProfile: { maxSpeed: 34.5, accelerationPeak: 4.5, sprintCapacity: 460, highIntensityThreshold: 22, aerobicThreshold: 160, anaerobicThreshold: 185 }, currentStatus: 'available' },
      { id: 'mci-26', name: 'Savinho', number: 26, position: 'RW', preferredFoot: 'right', physicalProfile: { maxSpeed: 33.5, accelerationPeak: 4.4, sprintCapacity: 440, highIntensityThreshold: 21.5, aerobicThreshold: 159, anaerobicThreshold: 184 }, currentStatus: 'available' },
      { id: 'mci-9', name: 'Erling Haaland', number: 9, position: 'ST', preferredFoot: 'left', physicalProfile: { maxSpeed: 36, accelerationPeak: 4.6, sprintCapacity: 480, highIntensityThreshold: 22, aerobicThreshold: 160, anaerobicThreshold: 185 }, currentStatus: 'available' },
    ],
    ARS: [
      { id: 'ars-1', name: 'David Raya', number: 22, position: 'GK', preferredFoot: 'right', physicalProfile: { maxSpeed: 25, accelerationPeak: 3.1, sprintCapacity: 170, highIntensityThreshold: 17.5, aerobicThreshold: 143, anaerobicThreshold: 168 }, currentStatus: 'available' },
      { id: 'ars-2', name: 'Ben White', number: 4, position: 'RB', preferredFoot: 'right', physicalProfile: { maxSpeed: 33, accelerationPeak: 4.2, sprintCapacity: 400, highIntensityThreshold: 20.5, aerobicThreshold: 156, anaerobicThreshold: 181 }, currentStatus: 'available' },
      { id: 'ars-3', name: 'William Saliba', number: 2, position: 'CB', preferredFoot: 'right', physicalProfile: { maxSpeed: 32, accelerationPeak: 4.0, sprintCapacity: 360, highIntensityThreshold: 20, aerobicThreshold: 154, anaerobicThreshold: 179 }, currentStatus: 'available' },
      { id: 'ars-4', name: 'Gabriel Magalhaes', number: 6, position: 'CB', preferredFoot: 'left', physicalProfile: { maxSpeed: 31.5, accelerationPeak: 3.9, sprintCapacity: 340, highIntensityThreshold: 19.5, aerobicThreshold: 153, anaerobicThreshold: 178 }, currentStatus: 'available' },
      { id: 'ars-5', name: 'Jurrien Timber', number: 12, position: 'LB', preferredFoot: 'right', physicalProfile: { maxSpeed: 32.5, accelerationPeak: 4.1, sprintCapacity: 380, highIntensityThreshold: 20, aerobicThreshold: 155, anaerobicThreshold: 180 }, currentStatus: 'available' },
      { id: 'ars-6', name: 'Declan Rice', number: 41, position: 'CDM', preferredFoot: 'right', physicalProfile: { maxSpeed: 30.5, accelerationPeak: 3.8, sprintCapacity: 340, highIntensityThreshold: 19.5, aerobicThreshold: 154, anaerobicThreshold: 179 }, currentStatus: 'available' },
      { id: 'ars-7', name: 'Thomas Partey', number: 5, position: 'CDM', preferredFoot: 'right', physicalProfile: { maxSpeed: 30, accelerationPeak: 3.7, sprintCapacity: 320, highIntensityThreshold: 19, aerobicThreshold: 152, anaerobicThreshold: 177 }, currentStatus: 'available' },
      { id: 'ars-8', name: 'Martin Odegaard', number: 8, position: 'CAM', preferredFoot: 'left', physicalProfile: { maxSpeed: 30, accelerationPeak: 3.8, sprintCapacity: 330, highIntensityThreshold: 19, aerobicThreshold: 152, anaerobicThreshold: 177 }, currentStatus: 'available' },
      { id: 'ars-9', name: 'Bukayo Saka', number: 7, position: 'RW', preferredFoot: 'left', physicalProfile: { maxSpeed: 34, accelerationPeak: 4.4, sprintCapacity: 440, highIntensityThreshold: 21.5, aerobicThreshold: 159, anaerobicThreshold: 184 }, currentStatus: 'available' },
      { id: 'ars-10', name: 'Gabriel Martinelli', number: 11, position: 'LW', preferredFoot: 'right', physicalProfile: { maxSpeed: 34.5, accelerationPeak: 4.5, sprintCapacity: 450, highIntensityThreshold: 22, aerobicThreshold: 160, anaerobicThreshold: 185 }, currentStatus: 'available' },
      { id: 'ars-11', name: 'Kai Havertz', number: 29, position: 'ST', preferredFoot: 'left', physicalProfile: { maxSpeed: 32, accelerationPeak: 4.0, sprintCapacity: 360, highIntensityThreshold: 20, aerobicThreshold: 155, anaerobicThreshold: 180 }, currentStatus: 'available' },
    ],
    LIV: [
      { id: 'liv-1', name: 'Alisson', number: 1, position: 'GK', preferredFoot: 'right', physicalProfile: { maxSpeed: 27, accelerationPeak: 3.3, sprintCapacity: 190, highIntensityThreshold: 18.5, aerobicThreshold: 146, anaerobicThreshold: 171 }, currentStatus: 'available' },
      { id: 'liv-2', name: 'Trent Alexander-Arnold', number: 66, position: 'RB', preferredFoot: 'right', physicalProfile: { maxSpeed: 32, accelerationPeak: 4.0, sprintCapacity: 370, highIntensityThreshold: 20, aerobicThreshold: 155, anaerobicThreshold: 180 }, currentStatus: 'available' },
      { id: 'liv-3', name: 'Virgil van Dijk', number: 4, position: 'CB', preferredFoot: 'right', physicalProfile: { maxSpeed: 32.5, accelerationPeak: 4.0, sprintCapacity: 350, highIntensityThreshold: 20, aerobicThreshold: 154, anaerobicThreshold: 179 }, currentStatus: 'available' },
      { id: 'liv-4', name: 'Ibrahima Konate', number: 5, position: 'CB', preferredFoot: 'right', physicalProfile: { maxSpeed: 33, accelerationPeak: 4.2, sprintCapacity: 380, highIntensityThreshold: 20.5, aerobicThreshold: 156, anaerobicThreshold: 181 }, currentStatus: 'available' },
      { id: 'liv-5', name: 'Andrew Robertson', number: 26, position: 'LB', preferredFoot: 'left', physicalProfile: { maxSpeed: 33, accelerationPeak: 4.1, sprintCapacity: 400, highIntensityThreshold: 20.5, aerobicThreshold: 157, anaerobicThreshold: 182 }, currentStatus: 'available' },
      { id: 'liv-6', name: 'Ryan Gravenberch', number: 38, position: 'CDM', preferredFoot: 'right', physicalProfile: { maxSpeed: 31, accelerationPeak: 3.9, sprintCapacity: 350, highIntensityThreshold: 19.5, aerobicThreshold: 153, anaerobicThreshold: 178 }, currentStatus: 'available' },
      { id: 'liv-7', name: 'Alexis Mac Allister', number: 10, position: 'CM', preferredFoot: 'right', physicalProfile: { maxSpeed: 30, accelerationPeak: 3.7, sprintCapacity: 320, highIntensityThreshold: 19, aerobicThreshold: 152, anaerobicThreshold: 177 }, currentStatus: 'available' },
      { id: 'liv-8', name: 'Dominik Szoboszlai', number: 8, position: 'CM', preferredFoot: 'right', physicalProfile: { maxSpeed: 32, accelerationPeak: 4.0, sprintCapacity: 360, highIntensityThreshold: 20, aerobicThreshold: 155, anaerobicThreshold: 180 }, currentStatus: 'available' },
      { id: 'liv-9', name: 'Mohamed Salah', number: 11, position: 'RW', preferredFoot: 'left', physicalProfile: { maxSpeed: 34.5, accelerationPeak: 4.5, sprintCapacity: 460, highIntensityThreshold: 22, aerobicThreshold: 160, anaerobicThreshold: 185 }, currentStatus: 'available' },
      { id: 'liv-10', name: 'Luis Diaz', number: 7, position: 'LW', preferredFoot: 'right', physicalProfile: { maxSpeed: 34, accelerationPeak: 4.4, sprintCapacity: 440, highIntensityThreshold: 21.5, aerobicThreshold: 159, anaerobicThreshold: 184 }, currentStatus: 'available' },
      { id: 'liv-11', name: 'Darwin Nunez', number: 9, position: 'ST', preferredFoot: 'right', physicalProfile: { maxSpeed: 35, accelerationPeak: 4.5, sprintCapacity: 470, highIntensityThreshold: 22, aerobicThreshold: 160, anaerobicThreshold: 185 }, currentStatus: 'available' },
    ],
    MUN: [
      { id: 'mun-1', name: 'Bart Lammens', number: 1, position: 'GK', preferredFoot: 'right', physicalProfile: { maxSpeed: 26, accelerationPeak: 3.2, sprintCapacity: 185, highIntensityThreshold: 18, aerobicThreshold: 145, anaerobicThreshold: 170 }, currentStatus: 'available' },
      { id: 'mun-2', name: 'Diogo Dalot', number: 20, position: 'RB', preferredFoot: 'right', physicalProfile: { maxSpeed: 32.5, accelerationPeak: 4.1, sprintCapacity: 390, highIntensityThreshold: 20.5, aerobicThreshold: 156, anaerobicThreshold: 181 }, currentStatus: 'available' },
      { id: 'mun-3', name: 'Matthijs de Ligt', number: 4, position: 'CB', preferredFoot: 'right', physicalProfile: { maxSpeed: 31, accelerationPeak: 3.9, sprintCapacity: 330, highIntensityThreshold: 19.5, aerobicThreshold: 153, anaerobicThreshold: 178 }, currentStatus: 'available' },
      { id: 'mun-4', name: 'Lisandro Martinez', number: 6, position: 'CB', preferredFoot: 'left', physicalProfile: { maxSpeed: 30.5, accelerationPeak: 3.8, sprintCapacity: 320, highIntensityThreshold: 19, aerobicThreshold: 151, anaerobicThreshold: 176 }, currentStatus: 'available' },
      { id: 'mun-5', name: 'Patrick Dorgu', number: 3, position: 'LB', preferredFoot: 'left', physicalProfile: { maxSpeed: 33, accelerationPeak: 4.2, sprintCapacity: 400, highIntensityThreshold: 21, aerobicThreshold: 157, anaerobicThreshold: 182 }, currentStatus: 'available' },
      { id: 'mun-6', name: 'Manuel Ugarte', number: 25, position: 'CDM', preferredFoot: 'right', physicalProfile: { maxSpeed: 30, accelerationPeak: 3.7, sprintCapacity: 310, highIntensityThreshold: 19, aerobicThreshold: 150, anaerobicThreshold: 175 }, currentStatus: 'available' },
      { id: 'mun-7', name: 'Kobbie Mainoo', number: 37, position: 'CM', preferredFoot: 'right', physicalProfile: { maxSpeed: 31, accelerationPeak: 3.9, sprintCapacity: 350, highIntensityThreshold: 19.5, aerobicThreshold: 154, anaerobicThreshold: 179 }, currentStatus: 'available' },
      { id: 'mun-8', name: 'Bruno Fernandes', number: 8, position: 'CAM', preferredFoot: 'right', physicalProfile: { maxSpeed: 30.5, accelerationPeak: 3.8, sprintCapacity: 340, highIntensityThreshold: 19, aerobicThreshold: 152, anaerobicThreshold: 177 }, currentStatus: 'available' },
      { id: 'mun-9', name: 'Bryan Mbuemo', number: 19, position: 'RW', preferredFoot: 'left', physicalProfile: { maxSpeed: 34, accelerationPeak: 4.3, sprintCapacity: 430, highIntensityThreshold: 21.5, aerobicThreshold: 158, anaerobicThreshold: 183 }, currentStatus: 'available' },
      { id: 'mun-10', name: 'Benjamin Sesko', number: 9, position: 'ST', preferredFoot: 'right', physicalProfile: { maxSpeed: 34.5, accelerationPeak: 4.4, sprintCapacity: 455, highIntensityThreshold: 22, aerobicThreshold: 160, anaerobicThreshold: 185 }, currentStatus: 'available' },
      { id: 'mun-11', name: 'Matheus Cunha', number: 10, position: 'LW', preferredFoot: 'right', physicalProfile: { maxSpeed: 33.5, accelerationPeak: 4.2, sprintCapacity: 410, highIntensityThreshold: 21, aerobicThreshold: 157, anaerobicThreshold: 182 }, currentStatus: 'available' },
      { id: 'mun-12', name: 'Amad Diallo', number: 16, position: 'RW', preferredFoot: 'right', physicalProfile: { maxSpeed: 33.5, accelerationPeak: 4.3, sprintCapacity: 420, highIntensityThreshold: 21, aerobicThreshold: 158, anaerobicThreshold: 183 }, currentStatus: 'available' },
      { id: 'mun-13', name: 'Alejandro Garnacho', number: 17, position: 'LW', preferredFoot: 'right', physicalProfile: { maxSpeed: 34, accelerationPeak: 4.4, sprintCapacity: 440, highIntensityThreshold: 21.5, aerobicThreshold: 159, anaerobicThreshold: 184 }, currentStatus: 'available' },
      { id: 'mun-14', name: 'Rasmus Hojlund', number: 11, position: 'ST', preferredFoot: 'right', physicalProfile: { maxSpeed: 34.5, accelerationPeak: 4.4, sprintCapacity: 450, highIntensityThreshold: 21.5, aerobicThreshold: 159, anaerobicThreshold: 184 }, currentStatus: 'available' },
    ],
  };

  return squads[teamTla] || squads['MCI'];
}

// ==================== Match Tracking Data Generation ====================

export function generateMatchTrackingHistory(
  playerId: string,
  matches: number = 10
): TrackingMetrics[] {
  const history: TrackingMetrics[] = [];

  for (let i = 0; i < matches; i++) {
    // Generate realistic match data with some variation
    const baseDistance = 10000 + Math.random() * 2000;
    const intensity = 0.8 + Math.random() * 0.4;

    history.push({
      totalDistance: baseDistance * intensity,
      distancePerMinute: (baseDistance * intensity) / 90,
      highSpeedRunningDistance: baseDistance * 0.08 * intensity + Math.random() * 100,
      sprintDistance: baseDistance * 0.03 * intensity + Math.random() * 50,
      walkingDistance: baseDistance * 0.2,
      joggingDistance: baseDistance * 0.4,
      runningDistance: baseDistance * 0.27,
      currentSpeed: 0,
      averageSpeed: 6.5 + Math.random() * 1.5,
      maxSpeed: 30 + Math.random() * 5,
      speedZones: {
        zone1: 1200 + Math.random() * 300,
        zone2: 1500 + Math.random() * 400,
        zone3: 1200 + Math.random() * 300,
        zone4: 600 + Math.random() * 200,
        zone5: 240 + Math.random() * 100,
        zone6: 60 + Math.random() * 40,
      },
      accelerations: {
        low: 40 + Math.floor(Math.random() * 20),
        medium: 25 + Math.floor(Math.random() * 15),
        high: 12 + Math.floor(Math.random() * 10),
        total: 77 + Math.floor(Math.random() * 45),
      },
      decelerations: {
        low: 40 + Math.floor(Math.random() * 20),
        medium: 25 + Math.floor(Math.random() * 15),
        high: 12 + Math.floor(Math.random() * 10),
        total: 77 + Math.floor(Math.random() * 45),
      },
      maxAcceleration: 3.5 + Math.random(),
      maxDeceleration: -(3.5 + Math.random()),
      playerLoad: 400 + Math.random() * 150,
      playerLoadPerMinute: 4.5 + Math.random() * 2,
      metabolicPower: 9 + Math.random() * 4,
      highMetabolicLoadDistance: baseDistance * 0.11 * intensity,
      position: {
        x: 0,
        y: 0,
        zone: 'middle_third',
        heatmap: { cells: [], resolution: { x: 21, y: 14 } },
      },
    });
  }

  return history;
}
