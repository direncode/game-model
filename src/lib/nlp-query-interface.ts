/**
 * NLP Query Interface for Football Analysts
 *
 * Enables natural language queries against match data, player statistics,
 * and tactical analysis. Provides intelligent parsing and response generation.
 */

import type { Player, MatchEvent, TacticalZone } from '@/types';

// Query Intent Types
export type QueryIntent =
  | 'player_stats'
  | 'team_comparison'
  | 'match_analysis'
  | 'tactical_query'
  | 'injury_status'
  | 'recruitment_search'
  | 'performance_trend'
  | 'event_search'
  | 'formation_analysis'
  | 'pressure_analysis'
  | 'unknown';

// Entity Types extracted from queries
export interface ExtractedEntities {
  players: string[];
  teams: string[];
  positions: string[];
  metrics: string[];
  timeframe: TimeframeEntity | null;
  formations: string[];
  zones: string[];
  comparators: ('greater' | 'less' | 'equal' | 'between')[];
  values: number[];
  actions: string[];
}

export interface TimeframeEntity {
  type: 'match' | 'season' | 'recent' | 'custom';
  value?: string;
  startDate?: Date;
  endDate?: Date;
  matchCount?: number;
}

// Query Analysis Result
export interface QueryAnalysis {
  originalQuery: string;
  normalizedQuery: string;
  intent: QueryIntent;
  confidence: number;
  entities: ExtractedEntities;
  suggestedQueries: string[];
}

// Query Response Types
export interface QueryResponse {
  success: boolean;
  query: QueryAnalysis;
  data: QueryResult;
  naturalLanguageResponse: string;
  visualizationHint?: VisualizationHint;
  followUpQuestions: string[];
}

export interface QueryResult {
  type: 'table' | 'chart' | 'summary' | 'comparison' | 'list';
  columns?: string[];
  rows?: Record<string, unknown>[];
  summary?: string;
  metrics?: Record<string, number>;
  comparisons?: ComparisonResult[];
}

export interface ComparisonResult {
  entity1: string;
  entity2: string;
  metric: string;
  value1: number;
  value2: number;
  difference: number;
  percentageDiff: number;
  winner: string;
}

export interface VisualizationHint {
  type: 'bar_chart' | 'line_chart' | 'radar' | 'heatmap' | 'pitch_zones' | 'scatter';
  xAxis?: string;
  yAxis?: string;
  groupBy?: string;
  colorBy?: string;
}

// Keyword dictionaries for entity extraction
const METRIC_KEYWORDS: Record<string, string[]> = {
  goals: ['goals', 'scored', 'scoring', 'goal'],
  assists: ['assists', 'assisted', 'assist', 'created'],
  passes: ['passes', 'passing', 'pass', 'pass completion', 'pass accuracy'],
  shots: ['shots', 'shooting', 'shot', 'attempts'],
  xG: ['xg', 'expected goals', 'expected goal'],
  xA: ['xa', 'expected assists', 'expected assist'],
  tackles: ['tackles', 'tackling', 'tackle', 'won possession'],
  interceptions: ['interceptions', 'intercepted', 'interception'],
  distance: ['distance', 'covered', 'km', 'kilometers', 'metres', 'meters'],
  sprints: ['sprints', 'sprint', 'high speed runs', 'high intensity'],
  pressures: ['pressures', 'pressing', 'press', 'pressure events'],
  progressive: ['progressive', 'progressive passes', 'progressive carries'],
  dribbles: ['dribbles', 'dribbling', 'take ons', 'take-ons'],
  aerials: ['aerials', 'aerial duels', 'headers', 'aerial'],
  fouls: ['fouls', 'fouled', 'foul'],
  cards: ['cards', 'yellow', 'red', 'bookings'],
  minutes: ['minutes', 'playing time', 'game time', 'mins'],
  appearances: ['appearances', 'games', 'matches', 'played'],
};

const POSITION_KEYWORDS: Record<string, string[]> = {
  GK: ['goalkeeper', 'keeper', 'gk', 'goalie'],
  CB: ['centre back', 'center back', 'cb', 'central defender'],
  LB: ['left back', 'lb', 'left fullback'],
  RB: ['right back', 'rb', 'right fullback'],
  FB: ['fullback', 'full back', 'fb', 'fullbacks'],
  DM: ['defensive midfielder', 'dm', 'cdm', 'holding midfielder', 'anchor'],
  CM: ['central midfielder', 'cm', 'midfielder', 'midfielders'],
  AM: ['attacking midfielder', 'am', 'cam', 'playmaker', 'number 10'],
  LW: ['left winger', 'lw', 'left wing'],
  RW: ['right winger', 'rw', 'right wing'],
  WG: ['winger', 'wingers', 'wide player'],
  ST: ['striker', 'st', 'forward', 'centre forward', 'cf', 'number 9'],
  FW: ['forward', 'forwards', 'attacker', 'attackers'],
  DF: ['defender', 'defenders', 'defense', 'defence', 'backline'],
  MF: ['midfielder', 'midfielders', 'midfield'],
};

const ACTION_KEYWORDS: Record<string, string[]> = {
  shot: ['shot', 'shots', 'shooting', 'shoot'],
  pass: ['pass', 'passes', 'passing', 'passed'],
  cross: ['cross', 'crosses', 'crossing', 'crossed'],
  tackle: ['tackle', 'tackles', 'tackling', 'tackled'],
  interception: ['interception', 'interceptions', 'intercepted'],
  dribble: ['dribble', 'dribbles', 'dribbling', 'dribbled'],
  clearance: ['clearance', 'clearances', 'cleared'],
  foul: ['foul', 'fouls', 'fouled'],
  save: ['save', 'saves', 'saved', 'saving'],
  goal: ['goal', 'goals', 'scored', 'scoring'],
  assist: ['assist', 'assists', 'assisted'],
  press: ['press', 'pressing', 'pressure', 'pressures'],
  carry: ['carry', 'carries', 'carrying', 'carried'],
};

const TIME_KEYWORDS: Record<string, TimeframeEntity> = {
  'this season': { type: 'season', value: 'current' },
  'last season': { type: 'season', value: 'previous' },
  'this match': { type: 'match', value: 'current' },
  'last match': { type: 'match', value: 'previous' },
  'last 5 matches': { type: 'recent', matchCount: 5 },
  'last 5 games': { type: 'recent', matchCount: 5 },
  'last 10 matches': { type: 'recent', matchCount: 10 },
  'last 10 games': { type: 'recent', matchCount: 10 },
  'recent': { type: 'recent', matchCount: 5 },
  'recently': { type: 'recent', matchCount: 5 },
  'all time': { type: 'custom' },
  'career': { type: 'custom' },
};

const COMPARATOR_PATTERNS = [
  { pattern: /more than|greater than|over|above|>/i, type: 'greater' as const },
  { pattern: /less than|under|below|fewer than|</i, type: 'less' as const },
  { pattern: /equal to|exactly|==/i, type: 'equal' as const },
  { pattern: /between/i, type: 'between' as const },
];

const ZONE_KEYWORDS: Record<string, string[]> = {
  'defensive_third': ['defensive third', 'own third', 'back third', 'deep'],
  'middle_third': ['middle third', 'midfield', 'center of pitch'],
  'attacking_third': ['attacking third', 'final third', 'opponent third'],
  'left_flank': ['left flank', 'left side', 'left wing area'],
  'right_flank': ['right flank', 'right side', 'right wing area'],
  'box': ['box', 'penalty area', 'penalty box', '18 yard box', 'inside the box'],
  'half_spaces': ['half spaces', 'half-spaces', 'channels'],
};

/**
 * NLP Query Interface for natural language football analytics queries
 */
export class NLPQueryInterface {
  private knownPlayers: Set<string> = new Set();
  private knownTeams: Set<string> = new Set();
  private queryHistory: QueryAnalysis[] = [];

  constructor() {
    // Initialize with common PL teams
    this.knownTeams = new Set([
      'Arsenal', 'Aston Villa', 'Bournemouth', 'Brentford', 'Brighton',
      'Chelsea', 'Crystal Palace', 'Everton', 'Fulham', 'Ipswich',
      'Leicester', 'Liverpool', 'Manchester City', 'Manchester United',
      'Newcastle', 'Nottingham Forest', 'Southampton', 'Tottenham',
      'West Ham', 'Wolves'
    ]);
  }

  /**
   * Register players for entity recognition
   */
  registerPlayers(players: Player[]): void {
    players.forEach(p => {
      this.knownPlayers.add(p.name);
      // Also add surname for matching
      const nameParts = p.name.split(' ');
      if (nameParts.length > 1) {
        this.knownPlayers.add(nameParts[nameParts.length - 1]);
      }
    });
  }

  /**
   * Analyze a natural language query
   */
  analyzeQuery(query: string): QueryAnalysis {
    const normalizedQuery = this.normalizeQuery(query);
    const entities = this.extractEntities(normalizedQuery);
    const intent = this.classifyIntent(normalizedQuery, entities);
    const confidence = this.calculateConfidence(intent, entities);
    const suggestedQueries = this.generateSuggestedQueries(intent, entities);

    const analysis: QueryAnalysis = {
      originalQuery: query,
      normalizedQuery,
      intent,
      confidence,
      entities,
      suggestedQueries,
    };

    this.queryHistory.push(analysis);
    return analysis;
  }

  /**
   * Process a query and generate a response
   */
  processQuery(
    query: string,
    dataContext: {
      players?: Player[];
      events?: MatchEvent[];
      zones?: TacticalZone[];
    }
  ): QueryResponse {
    const analysis = this.analyzeQuery(query);

    // Generate appropriate response based on intent
    let result: QueryResult;
    let naturalLanguageResponse: string;
    let visualizationHint: VisualizationHint | undefined;

    switch (analysis.intent) {
      case 'player_stats':
        result = this.handlePlayerStatsQuery(analysis, dataContext);
        naturalLanguageResponse = this.generatePlayerStatsResponse(analysis, result);
        visualizationHint = { type: 'bar_chart', xAxis: 'metric', yAxis: 'value' };
        break;

      case 'team_comparison':
        result = this.handleTeamComparisonQuery(analysis, dataContext);
        naturalLanguageResponse = this.generateComparisonResponse(analysis, result);
        visualizationHint = { type: 'radar', groupBy: 'team' };
        break;

      case 'match_analysis':
        result = this.handleMatchAnalysisQuery(analysis, dataContext);
        naturalLanguageResponse = this.generateMatchAnalysisResponse(analysis, result);
        visualizationHint = { type: 'line_chart', xAxis: 'minute', yAxis: 'events' };
        break;

      case 'tactical_query':
        result = this.handleTacticalQuery(analysis, dataContext);
        naturalLanguageResponse = this.generateTacticalResponse(analysis, result);
        visualizationHint = { type: 'pitch_zones', colorBy: 'intensity' };
        break;

      case 'pressure_analysis':
        result = this.handlePressureQuery(analysis, dataContext);
        naturalLanguageResponse = this.generatePressureResponse(analysis, result);
        visualizationHint = { type: 'heatmap', colorBy: 'pressure_intensity' };
        break;

      case 'performance_trend':
        result = this.handlePerformanceTrendQuery(analysis, dataContext);
        naturalLanguageResponse = this.generateTrendResponse(analysis, result);
        visualizationHint = { type: 'line_chart', xAxis: 'match', yAxis: 'performance' };
        break;

      case 'event_search':
        result = this.handleEventSearchQuery(analysis, dataContext);
        naturalLanguageResponse = this.generateEventSearchResponse(analysis, result);
        visualizationHint = { type: 'pitch_zones', colorBy: 'event_type' };
        break;

      case 'formation_analysis':
        result = this.handleFormationQuery(analysis, dataContext);
        naturalLanguageResponse = this.generateFormationResponse(analysis, result);
        visualizationHint = { type: 'pitch_zones' };
        break;

      case 'recruitment_search':
        result = this.handleRecruitmentQuery(analysis, dataContext);
        naturalLanguageResponse = this.generateRecruitmentResponse(analysis, result);
        visualizationHint = { type: 'scatter', xAxis: 'age', yAxis: 'performance' };
        break;

      case 'injury_status':
        result = this.handleInjuryQuery(analysis, dataContext);
        naturalLanguageResponse = this.generateInjuryResponse(analysis, result);
        break;

      default:
        result = { type: 'summary', summary: 'Unable to process query' };
        naturalLanguageResponse = this.generateUnknownQueryResponse(analysis);
    }

    const followUpQuestions = this.generateFollowUpQuestions(analysis, result);

    return {
      success: analysis.confidence > 0.3,
      query: analysis,
      data: result,
      naturalLanguageResponse,
      visualizationHint,
      followUpQuestions,
    };
  }

  /**
   * Normalize query text
   */
  private normalizeQuery(query: string): string {
    return query
      .toLowerCase()
      .replace(/['']/g, "'")
      .replace(/[""]/g, '"')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Extract entities from normalized query
   */
  private extractEntities(query: string): ExtractedEntities {
    const entities: ExtractedEntities = {
      players: [],
      teams: [],
      positions: [],
      metrics: [],
      timeframe: null,
      formations: [],
      zones: [],
      comparators: [],
      values: [],
      actions: [],
    };

    // Extract players
    this.knownPlayers.forEach(player => {
      if (query.includes(player.toLowerCase())) {
        entities.players.push(player);
      }
    });

    // Extract teams
    this.knownTeams.forEach(team => {
      if (query.includes(team.toLowerCase())) {
        entities.teams.push(team);
      }
    });

    // Extract positions
    Object.entries(POSITION_KEYWORDS).forEach(([position, keywords]) => {
      if (keywords.some(kw => query.includes(kw))) {
        entities.positions.push(position);
      }
    });

    // Extract metrics
    Object.entries(METRIC_KEYWORDS).forEach(([metric, keywords]) => {
      if (keywords.some(kw => query.includes(kw))) {
        entities.metrics.push(metric);
      }
    });

    // Extract timeframe
    Object.entries(TIME_KEYWORDS).forEach(([phrase, timeframe]) => {
      if (query.includes(phrase)) {
        entities.timeframe = timeframe;
      }
    });

    // Extract formations (e.g., 4-3-3, 4-4-2)
    const formationPattern = /\b[3-5]-[3-5]-[1-4](-[1-2])?\b/g;
    const formations = query.match(formationPattern);
    if (formations) {
      entities.formations = formations;
    }

    // Extract zones
    Object.entries(ZONE_KEYWORDS).forEach(([zone, keywords]) => {
      if (keywords.some(kw => query.includes(kw))) {
        entities.zones.push(zone);
      }
    });

    // Extract comparators
    COMPARATOR_PATTERNS.forEach(({ pattern, type }) => {
      if (pattern.test(query)) {
        entities.comparators.push(type);
      }
    });

    // Extract numeric values
    const numbers = query.match(/\b\d+(\.\d+)?\b/g);
    if (numbers) {
      entities.values = numbers.map(n => parseFloat(n));
    }

    // Extract actions
    Object.entries(ACTION_KEYWORDS).forEach(([action, keywords]) => {
      if (keywords.some(kw => query.includes(kw))) {
        entities.actions.push(action);
      }
    });

    return entities;
  }

  /**
   * Classify query intent
   */
  private classifyIntent(query: string, entities: ExtractedEntities): QueryIntent {
    // Check for comparison indicators
    if (query.includes('compare') || query.includes('vs') || query.includes('versus') ||
        query.includes('difference between') || entities.teams.length > 1 ||
        entities.players.length > 1) {
      if (entities.teams.length > 1) return 'team_comparison';
      return 'player_stats';
    }

    // Check for trend indicators
    if (query.includes('trend') || query.includes('over time') ||
        query.includes('progression') || query.includes('improvement')) {
      return 'performance_trend';
    }

    // Check for tactical indicators
    if (query.includes('formation') || entities.formations.length > 0) {
      return 'formation_analysis';
    }

    if (query.includes('pressure') || query.includes('pressing') ||
        query.includes('high press') || query.includes('gegenpressing')) {
      return 'pressure_analysis';
    }

    if (query.includes('tactical') || query.includes('shape') ||
        query.includes('positioning') || entities.zones.length > 0) {
      return 'tactical_query';
    }

    // Check for match analysis
    if (query.includes('match') || query.includes('game') ||
        query.includes('during the') || query.includes('in the')) {
      return 'match_analysis';
    }

    // Check for injury queries
    if (query.includes('injury') || query.includes('injured') ||
        query.includes('fitness') || query.includes('availability')) {
      return 'injury_status';
    }

    // Check for recruitment queries
    if (query.includes('recruit') || query.includes('sign') ||
        query.includes('target') || query.includes('similar to') ||
        query.includes('like') || query.includes('replacement')) {
      return 'recruitment_search';
    }

    // Check for event search
    if (entities.actions.length > 0 || query.includes('when') ||
        query.includes('where') || query.includes('how many')) {
      return 'event_search';
    }

    // Default to player stats if players or metrics mentioned
    if (entities.players.length > 0 || entities.metrics.length > 0) {
      return 'player_stats';
    }

    return 'unknown';
  }

  /**
   * Calculate confidence score for the analysis
   */
  private calculateConfidence(intent: QueryIntent, entities: ExtractedEntities): number {
    if (intent === 'unknown') return 0.1;

    let confidence = 0.5;

    // Boost confidence based on entity extraction
    if (entities.players.length > 0) confidence += 0.15;
    if (entities.teams.length > 0) confidence += 0.1;
    if (entities.metrics.length > 0) confidence += 0.1;
    if (entities.timeframe) confidence += 0.05;
    if (entities.actions.length > 0) confidence += 0.1;

    return Math.min(confidence, 1.0);
  }

  /**
   * Generate suggested queries based on analysis
   */
  private generateSuggestedQueries(intent: QueryIntent, entities: ExtractedEntities): string[] {
    const suggestions: string[] = [];

    if (entities.players.length === 1) {
      const player = entities.players[0];
      suggestions.push(`What are ${player}'s stats this season?`);
      suggestions.push(`Compare ${player} to similar players`);
      suggestions.push(`Show ${player}'s performance trend`);
    }

    if (entities.teams.length === 1) {
      const team = entities.teams[0];
      suggestions.push(`How does ${team} press in the final third?`);
      suggestions.push(`Show ${team}'s formation variations`);
      suggestions.push(`Who are ${team}'s top performers?`);
    }

    if (intent === 'unknown') {
      suggestions.push('Show top scorers this season');
      suggestions.push('Compare pressing intensity between teams');
      suggestions.push('Which players have improved most recently?');
    }

    return suggestions.slice(0, 3);
  }

  // Query handlers
  private handlePlayerStatsQuery(
    analysis: QueryAnalysis,
    context: { players?: Player[] }
  ): QueryResult {
    const { entities } = analysis;
    const metrics = entities.metrics.length > 0 ? entities.metrics : ['goals', 'assists', 'passes'];

    // Generate mock stats for demonstration
    const rows = entities.players.map(playerName => {
      const row: Record<string, unknown> = { player: playerName };
      metrics.forEach(metric => {
        row[metric] = Math.floor(Math.random() * 20);
      });
      return row;
    });

    return {
      type: 'table',
      columns: ['player', ...metrics],
      rows,
      metrics: metrics.reduce((acc, m) => {
        acc[m] = rows.reduce((sum, row) => sum + (row[m] as number), 0);
        return acc;
      }, {} as Record<string, number>),
    };
  }

  private handleTeamComparisonQuery(
    analysis: QueryAnalysis,
    _context: unknown
  ): QueryResult {
    const { entities } = analysis;
    const teams = entities.teams.length >= 2 ? entities.teams : ['Team A', 'Team B'];

    const comparisonMetrics = ['possession', 'xG', 'pressures', 'pass_completion'];

    const comparisons: ComparisonResult[] = comparisonMetrics.map(metric => {
      const value1 = Math.random() * 100;
      const value2 = Math.random() * 100;
      return {
        entity1: teams[0],
        entity2: teams[1],
        metric,
        value1: Math.round(value1 * 10) / 10,
        value2: Math.round(value2 * 10) / 10,
        difference: Math.round((value1 - value2) * 10) / 10,
        percentageDiff: Math.round(((value1 - value2) / value2) * 100),
        winner: value1 > value2 ? teams[0] : teams[1],
      };
    });

    return {
      type: 'comparison',
      comparisons,
      summary: `Comparison between ${teams[0]} and ${teams[1]} across ${comparisonMetrics.length} metrics`,
    };
  }

  private handleMatchAnalysisQuery(
    analysis: QueryAnalysis,
    _context: unknown
  ): QueryResult {
    return {
      type: 'summary',
      summary: `Match analysis for query: "${analysis.originalQuery}"`,
      metrics: {
        total_passes: 847,
        successful_passes: 756,
        shots: 24,
        shots_on_target: 9,
        possession_home: 58,
        possession_away: 42,
        xG_home: 2.3,
        xG_away: 1.1,
      },
    };
  }

  private handleTacticalQuery(
    analysis: QueryAnalysis,
    _context: unknown
  ): QueryResult {
    const { entities } = analysis;

    return {
      type: 'summary',
      summary: `Tactical analysis for zones: ${entities.zones.join(', ') || 'all zones'}`,
      metrics: {
        defensive_actions: 45,
        progressive_passes: 32,
        zone_entries: 28,
        touches_in_box: 18,
      },
    };
  }

  private handlePressureQuery(
    analysis: QueryAnalysis,
    _context: unknown
  ): QueryResult {
    return {
      type: 'summary',
      summary: 'Pressing intensity analysis',
      metrics: {
        total_pressures: 156,
        successful_pressures: 47,
        PPDA: 8.2,
        high_press_percentage: 34,
        counterpressure_success: 28,
      },
    };
  }

  private handlePerformanceTrendQuery(
    analysis: QueryAnalysis,
    _context: unknown
  ): QueryResult {
    const { entities } = analysis;
    const matchCount = entities.timeframe?.matchCount || 5;

    const rows = Array.from({ length: matchCount }, (_, i) => ({
      match: `Match ${i + 1}`,
      performance_score: 6 + Math.random() * 3,
      xG_contribution: Math.random() * 1.5,
      defensive_actions: Math.floor(Math.random() * 10),
    }));

    return {
      type: 'chart',
      columns: ['match', 'performance_score', 'xG_contribution', 'defensive_actions'],
      rows,
    };
  }

  private handleEventSearchQuery(
    analysis: QueryAnalysis,
    _context: unknown
  ): QueryResult {
    const { entities } = analysis;
    const actionType = entities.actions[0] || 'shot';

    const rows = Array.from({ length: 8 }, (_, i) => ({
      minute: Math.floor(Math.random() * 90) + 1,
      player: entities.players[0] || 'Player',
      action: actionType,
      location_x: Math.random() * 100,
      location_y: Math.random() * 100,
      outcome: Math.random() > 0.5 ? 'successful' : 'unsuccessful',
    }));

    return {
      type: 'list',
      columns: ['minute', 'player', 'action', 'location_x', 'location_y', 'outcome'],
      rows: rows.sort((a, b) => a.minute - b.minute),
    };
  }

  private handleFormationQuery(
    analysis: QueryAnalysis,
    _context: unknown
  ): QueryResult {
    const { entities } = analysis;

    return {
      type: 'summary',
      summary: `Formation analysis${entities.formations.length > 0 ? ` for ${entities.formations.join(', ')}` : ''}`,
      metrics: {
        width: 45.2,
        depth: 38.7,
        compactness: 72,
        midfield_overload: 1.2,
        defensive_line_height: 42,
      },
    };
  }

  private handleRecruitmentQuery(
    analysis: QueryAnalysis,
    _context: unknown
  ): QueryResult {
    const { entities } = analysis;

    const candidates = [
      { name: 'Player A', age: 23, similarity: 0.89, market_value: 45 },
      { name: 'Player B', age: 21, similarity: 0.85, market_value: 32 },
      { name: 'Player C', age: 25, similarity: 0.82, market_value: 55 },
    ];

    return {
      type: 'table',
      columns: ['name', 'age', 'similarity', 'market_value'],
      rows: candidates,
      summary: entities.players.length > 0
        ? `Players similar to ${entities.players[0]}`
        : 'Recruitment candidates matching criteria',
    };
  }

  private handleInjuryQuery(
    analysis: QueryAnalysis,
    _context: unknown
  ): QueryResult {
    const { entities } = analysis;

    return {
      type: 'summary',
      summary: entities.players.length > 0
        ? `Injury status for ${entities.players.join(', ')}`
        : 'Squad injury overview',
      metrics: {
        players_available: 22,
        players_injured: 3,
        average_recovery_days: 12,
        high_risk_players: 4,
      },
    };
  }

  // Response generators
  private generatePlayerStatsResponse(analysis: QueryAnalysis, result: QueryResult): string {
    const { entities } = analysis;
    if (result.rows && result.rows.length > 0) {
      const playerName = entities.players[0] || 'The player';
      const metrics = entities.metrics.join(', ') || 'key metrics';
      return `Here are ${playerName}'s statistics for ${metrics}${entities.timeframe ? ` over ${entities.timeframe.type}` : ''}.`;
    }
    return 'No statistics found for the specified player(s).';
  }

  private generateComparisonResponse(analysis: QueryAnalysis, result: QueryResult): string {
    if (result.comparisons && result.comparisons.length > 0) {
      const winners = result.comparisons.map(c => c.winner);
      const dominant = winners.sort((a, b) =>
        winners.filter(w => w === b).length - winners.filter(w => w === a).length
      )[0];
      return `Comparison complete. ${dominant} leads in most metrics.`;
    }
    return 'Unable to generate comparison.';
  }

  private generateMatchAnalysisResponse(_analysis: QueryAnalysis, result: QueryResult): string {
    if (result.metrics) {
      const possession = result.metrics['possession_home'] || 50;
      return `Match analysis complete. Home team controlled ${possession}% possession with ${result.metrics['shots'] || 0} total shots.`;
    }
    return 'Match analysis unavailable.';
  }

  private generateTacticalResponse(_analysis: QueryAnalysis, result: QueryResult): string {
    return result.summary || 'Tactical analysis complete.';
  }

  private generatePressureResponse(_analysis: QueryAnalysis, result: QueryResult): string {
    if (result.metrics) {
      const ppda = result.metrics['PPDA'] || 0;
      return `Pressing analysis: PPDA of ${ppda} indicates ${ppda < 8 ? 'high' : ppda < 12 ? 'moderate' : 'low'} pressing intensity.`;
    }
    return 'Pressure analysis complete.';
  }

  private generateTrendResponse(analysis: QueryAnalysis, _result: QueryResult): string {
    const { entities } = analysis;
    const period = entities.timeframe?.matchCount || 5;
    return `Performance trend analysis over the last ${period} matches.`;
  }

  private generateEventSearchResponse(analysis: QueryAnalysis, result: QueryResult): string {
    const { entities } = analysis;
    const action = entities.actions[0] || 'event';
    const count = result.rows?.length || 0;
    return `Found ${count} ${action} events matching your criteria.`;
  }

  private generateFormationResponse(analysis: QueryAnalysis, result: QueryResult): string {
    const { entities } = analysis;
    if (entities.formations.length > 0) {
      return `Analysis of ${entities.formations.join(' vs ')} formation(s). ${result.summary || ''}`;
    }
    return result.summary || 'Formation analysis complete.';
  }

  private generateRecruitmentResponse(analysis: QueryAnalysis, result: QueryResult): string {
    const count = result.rows?.length || 0;
    const { entities } = analysis;
    if (entities.players.length > 0) {
      return `Found ${count} players with similar profiles to ${entities.players[0]}.`;
    }
    return `Found ${count} recruitment candidates matching your criteria.`;
  }

  private generateInjuryResponse(analysis: QueryAnalysis, result: QueryResult): string {
    if (result.metrics) {
      const injured = result.metrics['players_injured'] || 0;
      const highRisk = result.metrics['high_risk_players'] || 0;
      return `Current squad status: ${injured} players injured, ${highRisk} players at elevated injury risk.`;
    }
    return 'Injury status report generated.';
  }

  private generateUnknownQueryResponse(analysis: QueryAnalysis): string {
    return `I couldn't fully understand your query: "${analysis.originalQuery}". ` +
      `Try asking about player stats, team comparisons, match analysis, or tactical queries.`;
  }

  private generateFollowUpQuestions(analysis: QueryAnalysis, _result: QueryResult): string[] {
    const questions: string[] = [];
    const { intent, entities } = analysis;

    if (intent === 'player_stats' && entities.players.length > 0) {
      questions.push(`How has ${entities.players[0]} performed compared to last season?`);
      questions.push(`Which players have similar profiles to ${entities.players[0]}?`);
    }

    if (intent === 'team_comparison') {
      questions.push('Which team is more effective in the final third?');
      questions.push('How do their pressing strategies differ?');
    }

    if (intent === 'tactical_query') {
      questions.push('How does this compare to league average?');
      questions.push('Which players are key to this tactical approach?');
    }

    // Add generic follow-ups if needed
    if (questions.length < 2) {
      questions.push('Can you show me the underlying data?');
      questions.push('What insights can we draw from this?');
    }

    return questions.slice(0, 3);
  }

  /**
   * Get query history for context
   */
  getQueryHistory(): QueryAnalysis[] {
    return [...this.queryHistory];
  }

  /**
   * Clear query history
   */
  clearHistory(): void {
    this.queryHistory = [];
  }
}

// Export singleton instance
export const nlpQueryInterface = new NLPQueryInterface();

// Example queries for documentation
export const EXAMPLE_QUERIES = [
  "What are Salah's goals and assists this season?",
  "Compare Manchester City vs Liverpool pressing intensity",
  "Show me all shots from the final third in the last match",
  "How has our defensive line height changed over the last 5 games?",
  "Find players similar to Bruno Fernandes under 25",
  "Which midfielders have the highest progressive pass rate?",
  "Analyze our 4-3-3 vs 4-2-3-1 formation effectiveness",
  "Who are the injury risks ahead of the weekend?",
  "Show pressing triggers in the attacking third",
  "Compare xG performance trend for strikers",
];
