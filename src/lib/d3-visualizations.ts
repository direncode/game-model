/**
 * Advanced D3 Visualizations for Football Analytics
 *
 * Provides professional-grade visualizations for:
 * - Pitch heatmaps and zones
 * - Pass networks and flow diagrams
 * - Pressure maps
 * - Shot maps with xG
 * - Player movement trails
 * - Formation overlays
 */

// Type definitions for D3 visualizations
export interface PitchDimensions {
  width: number;
  height: number;
  padding: number;
  pitchLength: number;  // Standard: 105m
  pitchWidth: number;   // Standard: 68m
}

export interface PassData {
  id: string;
  from: { x: number; y: number; playerId: string };
  to: { x: number; y: number; playerId: string };
  successful: boolean;
  progressive: boolean;
  type: 'ground' | 'lofted' | 'through' | 'cross' | 'switch';
  timestamp: number;
}

export interface ShotData {
  id: string;
  x: number;
  y: number;
  xG: number;
  outcome: 'goal' | 'saved' | 'blocked' | 'off_target' | 'post';
  playerId: string;
  bodyPart: 'right_foot' | 'left_foot' | 'head' | 'other';
  situation: 'open_play' | 'set_piece' | 'penalty' | 'counter';
  timestamp: number;
}

export interface HeatmapCell {
  x: number;
  y: number;
  value: number;
  normalizedValue: number;
}

export interface PressureEvent {
  x: number;
  y: number;
  intensity: number;
  successful: boolean;
  playerId: string;
  timestamp: number;
}

export interface PlayerPosition {
  playerId: string;
  x: number;
  y: number;
  timestamp: number;
}

export interface MovementTrail {
  playerId: string;
  positions: Array<{ x: number; y: number; timestamp: number; speed: number }>;
}

export interface PassNetworkNode {
  playerId: string;
  name: string;
  position: string;
  avgX: number;
  avgY: number;
  totalPasses: number;
  totalReceived: number;
}

export interface PassNetworkLink {
  source: string;
  target: string;
  passes: number;
  successful: number;
  weight: number;
}

export interface ZoneData {
  zoneId: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  value: number;
  label?: string;
}

// Color schemes for different visualization types
export const COLOR_SCHEMES = {
  heatmap: {
    cold: '#1a1a2e',
    mid: '#e94560',
    hot: '#ffed00',
  },
  passes: {
    successful: '#4ade80',
    unsuccessful: '#ef4444',
    progressive: '#3b82f6',
  },
  shots: {
    goal: '#22c55e',
    saved: '#f59e0b',
    blocked: '#6b7280',
    off_target: '#ef4444',
    post: '#a855f7',
  },
  pressure: {
    low: '#1e3a5f',
    medium: '#3b82f6',
    high: '#ef4444',
  },
  formation: {
    home: '#00d4ff',
    away: '#ff6b6b',
    ball: '#ffed00',
  },
  zones: {
    defensive: '#1e40af',
    midfield: '#6b21a8',
    attacking: '#dc2626',
  },
};

// Standard pitch configuration
export const PITCH_CONFIG: PitchDimensions = {
  width: 840,
  height: 544,
  padding: 20,
  pitchLength: 105,
  pitchWidth: 68,
};

/**
 * Pitch coordinate utilities
 */
export class PitchCoordinates {
  private config: PitchDimensions;
  private scaleX: number;
  private scaleY: number;

  constructor(config: PitchDimensions = PITCH_CONFIG) {
    this.config = config;
    this.scaleX = (config.width - 2 * config.padding) / config.pitchLength;
    this.scaleY = (config.height - 2 * config.padding) / config.pitchWidth;
  }

  /**
   * Convert pitch coordinates (0-100) to SVG coordinates
   */
  toSVG(x: number, y: number): { x: number; y: number } {
    return {
      x: this.config.padding + (x / 100) * (this.config.width - 2 * this.config.padding),
      y: this.config.padding + (y / 100) * (this.config.height - 2 * this.config.padding),
    };
  }

  /**
   * Convert real-world meters to SVG coordinates
   */
  metersToSVG(x: number, y: number): { x: number; y: number } {
    return {
      x: this.config.padding + x * this.scaleX,
      y: this.config.padding + y * this.scaleY,
    };
  }

  /**
   * Get pitch dimensions for SVG
   */
  getDimensions(): PitchDimensions {
    return { ...this.config };
  }
}

/**
 * SVG path generator for pitch markings
 */
export function generatePitchMarkings(coords: PitchCoordinates): string {
  const dim = coords.getDimensions();
  const w = dim.width - 2 * dim.padding;
  const h = dim.height - 2 * dim.padding;
  const p = dim.padding;

  // Pitch outline
  let path = `M ${p} ${p} L ${p + w} ${p} L ${p + w} ${p + h} L ${p} ${p + h} Z `;

  // Center line
  path += `M ${p + w / 2} ${p} L ${p + w / 2} ${p + h} `;

  // Center circle (radius ~9.15m, scaled)
  const centerRadius = (9.15 / dim.pitchLength) * w;
  path += `M ${p + w / 2 + centerRadius} ${p + h / 2} `;
  path += `A ${centerRadius} ${centerRadius} 0 1 1 ${p + w / 2 - centerRadius} ${p + h / 2} `;
  path += `A ${centerRadius} ${centerRadius} 0 1 1 ${p + w / 2 + centerRadius} ${p + h / 2} `;

  // Center spot
  const spotRadius = 2;
  path += `M ${p + w / 2 + spotRadius} ${p + h / 2} `;
  path += `A ${spotRadius} ${spotRadius} 0 1 1 ${p + w / 2 - spotRadius} ${p + h / 2} `;
  path += `A ${spotRadius} ${spotRadius} 0 1 1 ${p + w / 2 + spotRadius} ${p + h / 2} `;

  // Penalty areas (16.5m x 40.32m)
  const penAreaWidth = (16.5 / dim.pitchLength) * w;
  const penAreaHeight = (40.32 / dim.pitchWidth) * h;
  const penAreaTop = (h - penAreaHeight) / 2;

  // Left penalty area
  path += `M ${p} ${p + penAreaTop} L ${p + penAreaWidth} ${p + penAreaTop} `;
  path += `L ${p + penAreaWidth} ${p + penAreaTop + penAreaHeight} L ${p} ${p + penAreaTop + penAreaHeight} `;

  // Right penalty area
  path += `M ${p + w} ${p + penAreaTop} L ${p + w - penAreaWidth} ${p + penAreaTop} `;
  path += `L ${p + w - penAreaWidth} ${p + penAreaTop + penAreaHeight} L ${p + w} ${p + penAreaTop + penAreaHeight} `;

  // Goal areas (5.5m x 18.32m)
  const goalAreaWidth = (5.5 / dim.pitchLength) * w;
  const goalAreaHeight = (18.32 / dim.pitchWidth) * h;
  const goalAreaTop = (h - goalAreaHeight) / 2;

  // Left goal area
  path += `M ${p} ${p + goalAreaTop} L ${p + goalAreaWidth} ${p + goalAreaTop} `;
  path += `L ${p + goalAreaWidth} ${p + goalAreaTop + goalAreaHeight} L ${p} ${p + goalAreaTop + goalAreaHeight} `;

  // Right goal area
  path += `M ${p + w} ${p + goalAreaTop} L ${p + w - goalAreaWidth} ${p + goalAreaTop} `;
  path += `L ${p + w - goalAreaWidth} ${p + goalAreaTop + goalAreaHeight} L ${p + w} ${p + goalAreaTop + goalAreaHeight} `;

  // Penalty spots (11m from goal)
  const penSpotX = (11 / dim.pitchLength) * w;
  // Left penalty spot
  path += `M ${p + penSpotX + spotRadius} ${p + h / 2} `;
  path += `A ${spotRadius} ${spotRadius} 0 1 1 ${p + penSpotX - spotRadius} ${p + h / 2} `;
  path += `A ${spotRadius} ${spotRadius} 0 1 1 ${p + penSpotX + spotRadius} ${p + h / 2} `;

  // Right penalty spot
  path += `M ${p + w - penSpotX + spotRadius} ${p + h / 2} `;
  path += `A ${spotRadius} ${spotRadius} 0 1 1 ${p + w - penSpotX - spotRadius} ${p + h / 2} `;
  path += `A ${spotRadius} ${spotRadius} 0 1 1 ${p + w - penSpotX + spotRadius} ${p + h / 2} `;

  // Penalty arcs
  const penArcRadius = (9.15 / dim.pitchLength) * w;
  const arcStartY = Math.sqrt(penArcRadius ** 2 - (penAreaWidth - penSpotX) ** 2);

  // Left arc
  path += `M ${p + penAreaWidth} ${p + h / 2 - arcStartY} `;
  path += `A ${penArcRadius} ${penArcRadius} 0 0 1 ${p + penAreaWidth} ${p + h / 2 + arcStartY} `;

  // Right arc
  path += `M ${p + w - penAreaWidth} ${p + h / 2 - arcStartY} `;
  path += `A ${penArcRadius} ${penArcRadius} 0 0 0 ${p + w - penAreaWidth} ${p + h / 2 + arcStartY} `;

  // Corner arcs (1m radius)
  const cornerRadius = (1 / dim.pitchLength) * w;
  path += `M ${p} ${p + cornerRadius} A ${cornerRadius} ${cornerRadius} 0 0 1 ${p + cornerRadius} ${p} `;
  path += `M ${p + w} ${p + cornerRadius} A ${cornerRadius} ${cornerRadius} 0 0 0 ${p + w - cornerRadius} ${p} `;
  path += `M ${p} ${p + h - cornerRadius} A ${cornerRadius} ${cornerRadius} 0 0 0 ${p + cornerRadius} ${p + h} `;
  path += `M ${p + w} ${p + h - cornerRadius} A ${cornerRadius} ${cornerRadius} 0 0 1 ${p + w - cornerRadius} ${p + h} `;

  return path;
}

/**
 * Generate heatmap data for visualization
 */
export function generateHeatmap(
  events: Array<{ x: number; y: number; weight?: number }>,
  gridSize: number = 20
): HeatmapCell[] {
  const cells: Map<string, HeatmapCell> = new Map();
  const cellWidth = 100 / gridSize;
  const cellHeight = 100 / gridSize;

  // Initialize grid
  for (let i = 0; i < gridSize; i++) {
    for (let j = 0; j < gridSize; j++) {
      const key = `${i}-${j}`;
      cells.set(key, {
        x: i * cellWidth,
        y: j * cellHeight,
        value: 0,
        normalizedValue: 0,
      });
    }
  }

  // Accumulate values with Gaussian smoothing
  events.forEach(event => {
    const gridX = Math.floor(event.x / cellWidth);
    const gridY = Math.floor(event.y / cellHeight);
    const weight = event.weight ?? 1;

    // Apply Gaussian kernel to neighboring cells
    for (let dx = -2; dx <= 2; dx++) {
      for (let dy = -2; dy <= 2; dy++) {
        const nx = gridX + dx;
        const ny = gridY + dy;
        if (nx >= 0 && nx < gridSize && ny >= 0 && ny < gridSize) {
          const key = `${nx}-${ny}`;
          const cell = cells.get(key);
          if (cell) {
            const distance = Math.sqrt(dx * dx + dy * dy);
            const kernelValue = Math.exp(-distance * distance / 2) * weight;
            cell.value += kernelValue;
          }
        }
      }
    }
  });

  // Normalize values
  const values = Array.from(cells.values());
  const maxValue = Math.max(...values.map(c => c.value), 1);

  values.forEach(cell => {
    cell.normalizedValue = cell.value / maxValue;
  });

  return values;
}

/**
 * Generate pass network graph data
 */
export function generatePassNetwork(
  passes: PassData[],
  players: Array<{ id: string; name: string; position: string }>
): { nodes: PassNetworkNode[]; links: PassNetworkLink[] } {
  const nodeMap = new Map<string, PassNetworkNode>();
  const linkMap = new Map<string, PassNetworkLink>();

  // Initialize nodes
  players.forEach(player => {
    nodeMap.set(player.id, {
      playerId: player.id,
      name: player.name,
      position: player.position,
      avgX: 0,
      avgY: 0,
      totalPasses: 0,
      totalReceived: 0,
    });
  });

  // Calculate positions and pass counts
  const positionAccum = new Map<string, { x: number; y: number; count: number }>();

  passes.forEach(pass => {
    // Track passer position
    if (!positionAccum.has(pass.from.playerId)) {
      positionAccum.set(pass.from.playerId, { x: 0, y: 0, count: 0 });
    }
    const fromAccum = positionAccum.get(pass.from.playerId)!;
    fromAccum.x += pass.from.x;
    fromAccum.y += pass.from.y;
    fromAccum.count++;

    // Track receiver position
    if (!positionAccum.has(pass.to.playerId)) {
      positionAccum.set(pass.to.playerId, { x: 0, y: 0, count: 0 });
    }
    const toAccum = positionAccum.get(pass.to.playerId)!;
    toAccum.x += pass.to.x;
    toAccum.y += pass.to.y;
    toAccum.count++;

    // Update node stats
    const fromNode = nodeMap.get(pass.from.playerId);
    const toNode = nodeMap.get(pass.to.playerId);

    if (fromNode) fromNode.totalPasses++;
    if (toNode) toNode.totalReceived++;

    // Create/update link
    const linkKey = `${pass.from.playerId}-${pass.to.playerId}`;
    if (!linkMap.has(linkKey)) {
      linkMap.set(linkKey, {
        source: pass.from.playerId,
        target: pass.to.playerId,
        passes: 0,
        successful: 0,
        weight: 0,
      });
    }
    const link = linkMap.get(linkKey)!;
    link.passes++;
    if (pass.successful) link.successful++;
  });

  // Calculate average positions
  positionAccum.forEach((accum, playerId) => {
    const node = nodeMap.get(playerId);
    if (node && accum.count > 0) {
      node.avgX = accum.x / accum.count;
      node.avgY = accum.y / accum.count;
    }
  });

  // Calculate link weights
  const maxPasses = Math.max(...Array.from(linkMap.values()).map(l => l.passes), 1);
  linkMap.forEach(link => {
    link.weight = link.passes / maxPasses;
  });

  return {
    nodes: Array.from(nodeMap.values()).filter(n => n.totalPasses > 0 || n.totalReceived > 0),
    links: Array.from(linkMap.values()).filter(l => l.passes >= 2),
  };
}

/**
 * Generate shot map data with xG visualization
 */
export function processShotMap(shots: ShotData[]): {
  shots: ShotData[];
  totalXG: number;
  goals: number;
  xGPerShot: number;
  conversionRate: number;
  shotsByZone: Record<string, number>;
} {
  const goals = shots.filter(s => s.outcome === 'goal').length;
  const totalXG = shots.reduce((sum, s) => sum + s.xG, 0);

  // Categorize shots by zone
  const shotsByZone: Record<string, number> = {
    'box': 0,
    'edge_of_box': 0,
    'outside_box': 0,
    'long_range': 0,
  };

  shots.forEach(shot => {
    const distanceFromGoal = Math.sqrt((100 - shot.x) ** 2 + (50 - shot.y) ** 2);
    if (shot.x >= 83) {
      shotsByZone['box']++;
    } else if (shot.x >= 75) {
      shotsByZone['edge_of_box']++;
    } else if (distanceFromGoal < 35) {
      shotsByZone['outside_box']++;
    } else {
      shotsByZone['long_range']++;
    }
  });

  return {
    shots,
    totalXG: Math.round(totalXG * 100) / 100,
    goals,
    xGPerShot: shots.length > 0 ? Math.round((totalXG / shots.length) * 100) / 100 : 0,
    conversionRate: shots.length > 0 ? Math.round((goals / shots.length) * 100) : 0,
    shotsByZone,
  };
}

/**
 * Generate pressure map visualization data
 */
export function generatePressureMap(
  pressures: PressureEvent[],
  gridSize: number = 15
): {
  heatmap: HeatmapCell[];
  metrics: {
    totalPressures: number;
    successRate: number;
    highIntensityZones: string[];
    ppda: number;
  };
} {
  const heatmap = generateHeatmap(
    pressures.map(p => ({ x: p.x, y: p.y, weight: p.intensity })),
    gridSize
  );

  const successfulPressures = pressures.filter(p => p.successful).length;

  // Find high intensity zones
  const threshold = 0.7;
  const highIntensityCells = heatmap.filter(c => c.normalizedValue > threshold);
  const highIntensityZones = highIntensityCells.map(cell => {
    if (cell.x < 33) return 'defensive_third';
    if (cell.x < 67) return 'middle_third';
    return 'attacking_third';
  });

  const uniqueZones = [...new Set(highIntensityZones)];

  return {
    heatmap,
    metrics: {
      totalPressures: pressures.length,
      successRate: pressures.length > 0
        ? Math.round((successfulPressures / pressures.length) * 100)
        : 0,
      highIntensityZones: uniqueZones,
      ppda: pressures.length > 0 ? Math.round(10 / (pressures.length / 90) * 10) / 10 : 0,
    },
  };
}

/**
 * Generate movement trail visualization data
 */
export function processMovementTrails(
  trails: MovementTrail[]
): {
  trails: Array<{
    playerId: string;
    path: string;
    totalDistance: number;
    avgSpeed: number;
    maxSpeed: number;
    sprintSegments: Array<{ start: number; end: number }>;
  }>;
} {
  return {
    trails: trails.map(trail => {
      let totalDistance = 0;
      let maxSpeed = 0;
      const sprintSegments: Array<{ start: number; end: number }> = [];
      let sprintStart: number | null = null;

      // Generate SVG path and calculate metrics
      const pathParts: string[] = [];
      const coords = new PitchCoordinates();

      trail.positions.forEach((pos, i) => {
        const svg = coords.toSVG(pos.x, pos.y);

        if (i === 0) {
          pathParts.push(`M ${svg.x} ${svg.y}`);
        } else {
          pathParts.push(`L ${svg.x} ${svg.y}`);

          // Calculate distance
          const prev = trail.positions[i - 1];
          const dx = pos.x - prev.x;
          const dy = pos.y - prev.y;
          totalDistance += Math.sqrt(dx * dx + dy * dy);
        }

        // Track max speed and sprints
        maxSpeed = Math.max(maxSpeed, pos.speed);

        // Detect sprint segments (>25 km/h)
        if (pos.speed > 25) {
          if (sprintStart === null) sprintStart = i;
        } else if (sprintStart !== null) {
          sprintSegments.push({ start: sprintStart, end: i - 1 });
          sprintStart = null;
        }
      });

      if (sprintStart !== null) {
        sprintSegments.push({ start: sprintStart, end: trail.positions.length - 1 });
      }

      const avgSpeed = trail.positions.length > 0
        ? trail.positions.reduce((sum, p) => sum + p.speed, 0) / trail.positions.length
        : 0;

      return {
        playerId: trail.playerId,
        path: pathParts.join(' '),
        totalDistance: Math.round(totalDistance * 100) / 100,
        avgSpeed: Math.round(avgSpeed * 10) / 10,
        maxSpeed: Math.round(maxSpeed * 10) / 10,
        sprintSegments,
      };
    }),
  };
}

/**
 * Generate zone control visualization
 */
export function calculateZoneControl(
  homePositions: PlayerPosition[],
  awayPositions: PlayerPosition[],
  gridSize: number = 10
): ZoneData[] {
  const zones: ZoneData[] = [];
  const cellWidth = 100 / gridSize;
  const cellHeight = 100 / gridSize;

  for (let i = 0; i < gridSize; i++) {
    for (let j = 0; j < gridSize; j++) {
      const x1 = i * cellWidth;
      const y1 = j * cellHeight;
      const x2 = x1 + cellWidth;
      const y2 = y1 + cellHeight;

      // Count players in zone
      const homeCount = homePositions.filter(
        p => p.x >= x1 && p.x < x2 && p.y >= y1 && p.y < y2
      ).length;

      const awayCount = awayPositions.filter(
        p => p.x >= x1 && p.x < x2 && p.y >= y1 && p.y < y2
      ).length;

      // Value: positive = home control, negative = away control
      const total = homeCount + awayCount;
      const value = total > 0 ? (homeCount - awayCount) / total : 0;

      zones.push({
        zoneId: `zone-${i}-${j}`,
        x1,
        y1,
        x2,
        y2,
        value,
      });
    }
  }

  return zones;
}

/**
 * Formation template generator
 */
export function getFormationTemplate(
  formation: string
): Array<{ position: string; x: number; y: number }> {
  const formations: Record<string, Array<{ position: string; x: number; y: number }>> = {
    '4-3-3': [
      { position: 'GK', x: 5, y: 50 },
      { position: 'RB', x: 20, y: 85 },
      { position: 'RCB', x: 18, y: 65 },
      { position: 'LCB', x: 18, y: 35 },
      { position: 'LB', x: 20, y: 15 },
      { position: 'RCM', x: 40, y: 70 },
      { position: 'CDM', x: 35, y: 50 },
      { position: 'LCM', x: 40, y: 30 },
      { position: 'RW', x: 75, y: 85 },
      { position: 'ST', x: 85, y: 50 },
      { position: 'LW', x: 75, y: 15 },
    ],
    '4-4-2': [
      { position: 'GK', x: 5, y: 50 },
      { position: 'RB', x: 20, y: 85 },
      { position: 'RCB', x: 18, y: 65 },
      { position: 'LCB', x: 18, y: 35 },
      { position: 'LB', x: 20, y: 15 },
      { position: 'RM', x: 45, y: 85 },
      { position: 'RCM', x: 40, y: 60 },
      { position: 'LCM', x: 40, y: 40 },
      { position: 'LM', x: 45, y: 15 },
      { position: 'RST', x: 80, y: 60 },
      { position: 'LST', x: 80, y: 40 },
    ],
    '4-2-3-1': [
      { position: 'GK', x: 5, y: 50 },
      { position: 'RB', x: 20, y: 85 },
      { position: 'RCB', x: 18, y: 65 },
      { position: 'LCB', x: 18, y: 35 },
      { position: 'LB', x: 20, y: 15 },
      { position: 'RDM', x: 35, y: 60 },
      { position: 'LDM', x: 35, y: 40 },
      { position: 'RAM', x: 55, y: 80 },
      { position: 'CAM', x: 60, y: 50 },
      { position: 'LAM', x: 55, y: 20 },
      { position: 'ST', x: 85, y: 50 },
    ],
    '3-5-2': [
      { position: 'GK', x: 5, y: 50 },
      { position: 'RCB', x: 18, y: 70 },
      { position: 'CB', x: 15, y: 50 },
      { position: 'LCB', x: 18, y: 30 },
      { position: 'RWB', x: 40, y: 90 },
      { position: 'RCM', x: 40, y: 65 },
      { position: 'CDM', x: 35, y: 50 },
      { position: 'LCM', x: 40, y: 35 },
      { position: 'LWB', x: 40, y: 10 },
      { position: 'RST', x: 80, y: 60 },
      { position: 'LST', x: 80, y: 40 },
    ],
    '5-3-2': [
      { position: 'GK', x: 5, y: 50 },
      { position: 'RWB', x: 25, y: 90 },
      { position: 'RCB', x: 15, y: 70 },
      { position: 'CB', x: 12, y: 50 },
      { position: 'LCB', x: 15, y: 30 },
      { position: 'LWB', x: 25, y: 10 },
      { position: 'RCM', x: 45, y: 65 },
      { position: 'CM', x: 40, y: 50 },
      { position: 'LCM', x: 45, y: 35 },
      { position: 'RST', x: 80, y: 60 },
      { position: 'LST', x: 80, y: 40 },
    ],
  };

  return formations[formation] || formations['4-3-3'];
}

/**
 * Calculate team shape metrics
 */
export function calculateTeamShape(
  positions: PlayerPosition[]
): {
  width: number;
  depth: number;
  compactness: number;
  centroid: { x: number; y: number };
  defensiveLineHeight: number;
} {
  if (positions.length === 0) {
    return {
      width: 0,
      depth: 0,
      compactness: 0,
      centroid: { x: 50, y: 50 },
      defensiveLineHeight: 0,
    };
  }

  // Calculate centroid
  const centroid = {
    x: positions.reduce((sum, p) => sum + p.x, 0) / positions.length,
    y: positions.reduce((sum, p) => sum + p.y, 0) / positions.length,
  };

  // Calculate width (Y spread)
  const yValues = positions.map(p => p.y);
  const width = Math.max(...yValues) - Math.min(...yValues);

  // Calculate depth (X spread)
  const xValues = positions.map(p => p.x);
  const depth = Math.max(...xValues) - Math.min(...xValues);

  // Calculate compactness (average distance to centroid)
  const avgDistance = positions.reduce((sum, p) => {
    const dx = p.x - centroid.x;
    const dy = p.y - centroid.y;
    return sum + Math.sqrt(dx * dx + dy * dy);
  }, 0) / positions.length;

  // Compactness: inverse of spread (higher = more compact)
  const maxPossibleDistance = Math.sqrt(50 * 50 + 34 * 34);
  const compactness = Math.round((1 - avgDistance / maxPossibleDistance) * 100);

  // Defensive line height (average of 4 deepest outfield players)
  const sortedByX = [...positions].sort((a, b) => a.x - b.x);
  const defenderPositions = sortedByX.slice(1, 5); // Exclude GK
  const defensiveLineHeight = defenderPositions.length > 0
    ? defenderPositions.reduce((sum, p) => sum + p.x, 0) / defenderPositions.length
    : 0;

  return {
    width: Math.round(width * 10) / 10,
    depth: Math.round(depth * 10) / 10,
    compactness,
    centroid: {
      x: Math.round(centroid.x * 10) / 10,
      y: Math.round(centroid.y * 10) / 10,
    },
    defensiveLineHeight: Math.round(defensiveLineHeight * 10) / 10,
  };
}

// Export all utilities
export const D3Visualizations = {
  PitchCoordinates,
  generatePitchMarkings,
  generateHeatmap,
  generatePassNetwork,
  processShotMap,
  generatePressureMap,
  processMovementTrails,
  calculateZoneControl,
  getFormationTemplate,
  calculateTeamShape,
  COLOR_SCHEMES,
  PITCH_CONFIG,
};
