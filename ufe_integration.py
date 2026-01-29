"""
UFE Integration for Football Tactical Modeling (The Big Dunc)

Maps actual game-model data structures to UFE's 96-dimensional feature vector.
Provides analysis through the Undercurrent Flux Engine for tactical insights.

Feature Vector Layout (96 dimensions):
  [0-6]   Distance metrics: total, per_min, high_speed, sprint, walk, jog, run
  [7-15]  Speed metrics: current, avg, max, zones 1-6
  [16-25] Acceleration: accel low/med/high/total, decel low/med/high/total, max_accel, max_decel
  [26-29] Load metrics: player_load, load_per_min, metabolic_power, high_metabolic_dist
  [30-34] Position: x, y, zone_encoded, ball_dist, goal_dist
  [35-43] Heart rate: current, avg, max, min, zones 1-5
  [44-49] Twin state: fatigue, readiness, confidence, work_rate, pos_adherence, tact_compliance
  [50-59] Tactical style: possession, passing_len, tempo, width, creativity, def_line, press, compact, counter, risk
  [60-66] Match state: minute, phase, possession_pct, momentum, intensity, pressing_intensity, ball_possession
  [67-74] Formation: def_line_x, mid_line_x, fwd_line_x, block_type, compact_v, compact_h, team_spread, depth
  [75-81] Coherence: overall_score, deviation_count, critical_flag, dev_position, dev_movement, dev_intensity, dev_timing
  [82-87] Ball dynamics: ball_x, ball_y, ball_zone, last_pass_time, possession_time, counter_active
  [88-95] Player state: injury_risk, recovery_rate, sub_risk, sprint_capacity_remaining, stamina, muscle_load, body_temp, hydration

Friction terms: coherence_dev, fatigue_energy, overpress
"""

import math
from typing import List, Dict, Any, Optional
from dataclasses import dataclass

from ufe_client import UFEClient


@dataclass
class PlayerState:
    """Represents a player's state at a moment in time."""
    # Position
    x: float = 0.0  # -52.5 to 52.5 (pitch width)
    y: float = 0.0  # -34 to 34 (pitch height)

    # Movement
    speed: float = 0.0  # km/h
    max_speed: float = 35.0  # km/h
    acceleration: float = 0.0  # m/s²

    # Distances (cumulative meters)
    total_distance: float = 0.0
    sprint_distance: float = 0.0
    high_speed_distance: float = 0.0

    # Physical state
    fatigue: float = 0.0  # 0-100
    stamina: float = 100.0  # 0-100
    heart_rate: float = 120.0  # bpm

    # Tactical
    position_adherence: float = 100.0  # 0-100
    tactical_compliance: float = 100.0  # 0-100
    work_rate: float = 50.0  # 0-100

    # Profile
    role: str = "CM"
    has_ball: bool = False


@dataclass
class MatchState:
    """Represents the match state at a moment in time."""
    minute: int = 0
    phase: str = "first_half"  # pre_match, first_half, half_time, second_half, full_time
    current_phase: str = "buildUp"  # buildUp, progression, finalThird, pressing, defensiveBlock, transition

    # Score and possession
    home_score: int = 0
    away_score: int = 0
    possession_home: float = 50.0
    possession_away: float = 50.0

    # Ball state
    ball_x: float = 0.0
    ball_y: float = 0.0
    ball_possession: str = "home"  # home, away

    # Match dynamics
    momentum: str = "neutral"  # home, away, neutral
    intensity: float = 0.5  # 0-1
    pressing_intensity: float = 50.0  # 0-100

    # Defensive block
    block_type: str = "mid"  # high, mid, low
    defensive_line_x: float = -30.0
    midfield_line_x: float = 0.0
    forward_line_x: float = 30.0


@dataclass
class TacticalStyle:
    """Tactical style configuration (0-100 for each)."""
    possession: float = 50.0
    passing_length: float = 50.0
    tempo: float = 50.0
    width: float = 50.0
    creativity: float = 50.0
    defensive_line: float = 50.0
    pressing_intensity: float = 50.0
    compactness: float = 50.0
    counter_speed: float = 50.0
    risk_taking: float = 50.0


@dataclass
class CoherenceReport:
    """Tactical coherence analysis."""
    overall_score: float = 100.0  # 0-100
    deviation_count: int = 0
    critical_deviation: bool = False
    # Deviation types (0 or 1)
    dev_position: float = 0.0
    dev_movement: float = 0.0
    dev_intensity: float = 0.0
    dev_timing: float = 0.0


class UFEIntegration:
    """
    Integrates game-model football data with the UFE API.

    Converts match states, player positions, and tactical configurations
    to 96-dimensional feature vectors for latent space analysis.
    """

    DOMAIN = "football"
    FEATURE_DIM = 96

    # Normalization constants
    PITCH_LENGTH = 105.0  # meters
    PITCH_WIDTH = 68.0  # meters
    MAX_SPEED = 40.0  # km/h
    MAX_DISTANCE = 15000.0  # meters (full match)
    MAX_HEART_RATE = 200.0  # bpm
    MAX_ACCELERATION = 5.0  # m/s²

    def __init__(self):
        self.client = UFEClient()

    def close(self):
        """Close the UFE client connection."""
        self.client.close()

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        self.close()

    def _normalize(self, value: float, min_val: float, max_val: float) -> float:
        """Normalize a value to 0-1 range."""
        if max_val == min_val:
            return 0.5
        return max(0.0, min(1.0, (value - min_val) / (max_val - min_val)))

    def _encode_phase(self, phase: str) -> float:
        """Encode match phase to numeric value."""
        phases = {
            "pre_match": 0.0,
            "first_half": 0.25,
            "half_time": 0.5,
            "second_half": 0.75,
            "full_time": 1.0,
            "extra_time": 0.9,
            "penalties": 0.95
        }
        return phases.get(phase, 0.5)

    def _encode_current_phase(self, phase: str) -> float:
        """Encode current tactical phase."""
        phases = {
            "buildUp": 0.0,
            "progression": 0.2,
            "finalThird": 0.4,
            "pressing": 0.6,
            "defensiveBlock": 0.8,
            "transition": 1.0
        }
        return phases.get(phase, 0.5)

    def _encode_momentum(self, momentum: str) -> float:
        """Encode momentum to numeric value."""
        return {"home": 1.0, "neutral": 0.5, "away": 0.0}.get(momentum, 0.5)

    def _encode_block_type(self, block_type: str) -> float:
        """Encode defensive block type."""
        return {"high": 1.0, "mid": 0.5, "low": 0.0}.get(block_type, 0.5)

    def _encode_zone(self, x: float) -> float:
        """Encode pitch zone based on x position."""
        # Defensive third: x < -35, Middle: -35 to 35, Attacking: x > 35
        if x < -35:
            return 0.0  # defensive
        elif x > 35:
            return 1.0  # attacking
        return 0.5  # middle

    def to_features(
        self,
        players: List[PlayerState],
        match: MatchState,
        tactics: TacticalStyle,
        coherence: CoherenceReport
    ) -> List[float]:
        """
        Convert game state to 96-dimensional UFE feature vector.

        Args:
            players: List of player states (typically 11 for one team)
            match: Current match state
            tactics: Tactical style configuration
            coherence: Coherence analysis report

        Returns:
            96-element feature vector normalized to 0-1 range
        """
        features = [0.0] * self.FEATURE_DIM

        # Aggregate player metrics (average across team)
        if players:
            n = len(players)
            avg_x = sum(p.x for p in players) / n
            avg_y = sum(p.y for p in players) / n
            avg_speed = sum(p.speed for p in players) / n
            max_speed = max(p.max_speed for p in players)
            avg_fatigue = sum(p.fatigue for p in players) / n
            avg_stamina = sum(p.stamina for p in players) / n
            avg_hr = sum(p.heart_rate for p in players) / n
            total_distance = sum(p.total_distance for p in players)
            sprint_distance = sum(p.sprint_distance for p in players)
            high_speed_dist = sum(p.high_speed_distance for p in players)
            avg_pos_adherence = sum(p.position_adherence for p in players) / n
            avg_tact_compliance = sum(p.tactical_compliance for p in players) / n
            avg_work_rate = sum(p.work_rate for p in players) / n
            max_acceleration = max(p.acceleration for p in players)

            # Calculate team spread and depth
            min_x = min(p.x for p in players)
            max_x = max(p.x for p in players)
            min_y = min(p.y for p in players)
            max_y = max(p.y for p in players)
            team_spread = max_y - min_y
            team_depth = max_x - min_x
        else:
            # Defaults if no players
            avg_x = avg_y = 0.0
            avg_speed = 10.0
            max_speed = 35.0
            avg_fatigue = 20.0
            avg_stamina = 80.0
            avg_hr = 140.0
            total_distance = 5000.0
            sprint_distance = 500.0
            high_speed_dist = 1500.0
            avg_pos_adherence = 80.0
            avg_tact_compliance = 80.0
            avg_work_rate = 60.0
            max_acceleration = 3.0
            team_spread = 50.0
            team_depth = 40.0

        # [0-6] Distance metrics
        features[0] = self._normalize(total_distance, 0, self.MAX_DISTANCE)
        features[1] = self._normalize(total_distance / max(1, match.minute), 0, 150)  # dist per min
        features[2] = self._normalize(high_speed_dist, 0, 3000)  # high speed
        features[3] = self._normalize(sprint_distance, 0, 1500)  # sprint
        features[4] = self._normalize(total_distance * 0.3, 0, 5000)  # walking estimate
        features[5] = self._normalize(total_distance * 0.25, 0, 4000)  # jogging estimate
        features[6] = self._normalize(total_distance * 0.25, 0, 4000)  # running estimate

        # [7-15] Speed metrics
        features[7] = self._normalize(avg_speed, 0, self.MAX_SPEED)
        features[8] = self._normalize(avg_speed * 0.8, 0, self.MAX_SPEED)  # avg speed estimate
        features[9] = self._normalize(max_speed, 0, self.MAX_SPEED)
        # Speed zones (estimated time distribution)
        features[10] = 0.35  # zone 1 (0-6 km/h)
        features[11] = 0.25  # zone 2 (6-12 km/h)
        features[12] = 0.20  # zone 3 (12-18 km/h)
        features[13] = 0.12  # zone 4 (18-21 km/h)
        features[14] = 0.05  # zone 5 (21-24 km/h)
        features[15] = 0.03  # zone 6 (24+ km/h)

        # [16-25] Acceleration metrics
        features[16] = self._normalize(max_acceleration * 0.5, 0, 3)  # low accel count proxy
        features[17] = self._normalize(max_acceleration * 0.3, 0, 3)  # medium
        features[18] = self._normalize(max_acceleration * 0.2, 0, 3)  # high
        features[19] = self._normalize(max_acceleration, 0, 5)  # total proxy
        features[20] = self._normalize(max_acceleration * 0.5, 0, 3)  # low decel
        features[21] = self._normalize(max_acceleration * 0.3, 0, 3)  # medium decel
        features[22] = self._normalize(max_acceleration * 0.2, 0, 3)  # high decel
        features[23] = self._normalize(max_acceleration * 0.8, 0, 5)  # total decel proxy
        features[24] = self._normalize(max_acceleration, 0, self.MAX_ACCELERATION)
        features[25] = self._normalize(max_acceleration * 0.9, 0, self.MAX_ACCELERATION)

        # [26-29] Load metrics
        player_load = total_distance / 100 + max_acceleration * 20 + avg_fatigue * 2
        features[26] = self._normalize(player_load, 0, 500)  # player load
        features[27] = self._normalize(player_load / max(1, match.minute), 0, 10)  # load per min
        features[28] = self._normalize(avg_speed * 0.5, 0, 20)  # metabolic power estimate
        features[29] = self._normalize(high_speed_dist, 0, 3000)  # high metabolic dist

        # [30-34] Position metrics
        features[30] = self._normalize(avg_x, -self.PITCH_LENGTH/2, self.PITCH_LENGTH/2)
        features[31] = self._normalize(avg_y, -self.PITCH_WIDTH/2, self.PITCH_WIDTH/2)
        features[32] = self._encode_zone(avg_x)
        ball_dist = math.sqrt((avg_x - match.ball_x)**2 + (avg_y - match.ball_y)**2)
        features[33] = self._normalize(ball_dist, 0, 50)  # dist to ball
        goal_dist = math.sqrt((avg_x - 52.5)**2 + avg_y**2)
        features[34] = self._normalize(goal_dist, 0, 105)  # dist to goal

        # [35-43] Heart rate metrics
        features[35] = self._normalize(avg_hr, 60, self.MAX_HEART_RATE)  # current
        features[36] = self._normalize(avg_hr * 0.9, 60, self.MAX_HEART_RATE)  # avg
        features[37] = self._normalize(avg_hr * 1.2, 60, self.MAX_HEART_RATE)  # max
        features[38] = self._normalize(avg_hr * 0.7, 60, self.MAX_HEART_RATE)  # min
        # HR zones (estimated)
        features[39] = 0.15  # zone 1
        features[40] = 0.25  # zone 2
        features[41] = 0.30  # zone 3
        features[42] = 0.20  # zone 4
        features[43] = 0.10  # zone 5

        # [44-49] Twin state (digital twin metrics)
        features[44] = self._normalize(avg_fatigue, 0, 100)
        features[45] = self._normalize(100 - avg_fatigue, 0, 100)  # readiness
        features[46] = self._normalize(avg_tact_compliance, 0, 100)  # confidence proxy
        features[47] = self._normalize(avg_work_rate, 0, 100)
        features[48] = self._normalize(avg_pos_adherence, 0, 100)
        features[49] = self._normalize(avg_tact_compliance, 0, 100)

        # [50-59] Tactical style
        features[50] = self._normalize(tactics.possession, 0, 100)
        features[51] = self._normalize(tactics.passing_length, 0, 100)
        features[52] = self._normalize(tactics.tempo, 0, 100)
        features[53] = self._normalize(tactics.width, 0, 100)
        features[54] = self._normalize(tactics.creativity, 0, 100)
        features[55] = self._normalize(tactics.defensive_line, 0, 100)
        features[56] = self._normalize(tactics.pressing_intensity, 0, 100)
        features[57] = self._normalize(tactics.compactness, 0, 100)
        features[58] = self._normalize(tactics.counter_speed, 0, 100)
        features[59] = self._normalize(tactics.risk_taking, 0, 100)

        # [60-66] Match state
        features[60] = self._normalize(match.minute, 0, 90)
        features[61] = self._encode_phase(match.phase)
        features[62] = self._normalize(match.possession_home, 0, 100)
        features[63] = self._encode_momentum(match.momentum)
        features[64] = match.intensity
        features[65] = self._normalize(match.pressing_intensity, 0, 100)
        features[66] = 1.0 if match.ball_possession == "home" else 0.0

        # [67-74] Formation metrics
        features[67] = self._normalize(match.defensive_line_x, -52.5, 52.5)
        features[68] = self._normalize(match.midfield_line_x, -52.5, 52.5)
        features[69] = self._normalize(match.forward_line_x, -52.5, 52.5)
        features[70] = self._encode_block_type(match.block_type)
        features[71] = self._normalize(team_depth, 0, 80)  # vertical compactness
        features[72] = self._normalize(team_spread, 0, 60)  # horizontal compactness
        features[73] = self._normalize(team_spread, 0, 60)  # spread
        features[74] = self._normalize(team_depth, 0, 80)  # depth

        # [75-81] Coherence metrics
        features[75] = self._normalize(coherence.overall_score, 0, 100)
        features[76] = self._normalize(coherence.deviation_count, 0, 20)
        features[77] = 1.0 if coherence.critical_deviation else 0.0
        features[78] = coherence.dev_position
        features[79] = coherence.dev_movement
        features[80] = coherence.dev_intensity
        features[81] = coherence.dev_timing

        # [82-87] Ball dynamics
        features[82] = self._normalize(match.ball_x, -52.5, 52.5)
        features[83] = self._normalize(match.ball_y, -34, 34)
        features[84] = self._encode_zone(match.ball_x)
        features[85] = 0.3  # last pass time (normalized estimate)
        features[86] = self._normalize(match.minute * 0.5, 0, 45)  # possession time proxy
        features[87] = 1.0 if match.current_phase == "transition" else 0.0

        # [88-95] Player physical state
        features[88] = self._normalize(avg_fatigue * 0.3, 0, 100)  # injury risk
        features[89] = self._normalize(100 - avg_fatigue, 0, 100)  # recovery rate
        features[90] = self._normalize(avg_fatigue * 0.2, 0, 100)  # substitution risk
        features[91] = self._normalize(100 - sprint_distance / 30, 0, 100)  # sprint capacity remaining
        features[92] = self._normalize(avg_stamina, 0, 100)
        features[93] = self._normalize(avg_fatigue * 0.8, 0, 100)  # muscle load
        features[94] = self._normalize(37.5 + avg_fatigue * 0.03, 36, 40)  # body temp
        features[95] = self._normalize(100 - avg_fatigue * 0.5, 0, 100)  # hydration

        return features

    def analyze(self, states: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Analyze a sequence of game states through UFE.

        Args:
            states: List of state dictionaries, each containing:
                   - players: List[PlayerState]
                   - match: MatchState
                   - tactics: TacticalStyle
                   - coherence: CoherenceReport

        Returns:
            Analysis results including energy, latent shape, and friction breakdown.
        """
        # Convert states to feature trajectories
        trajectory = []
        for state in states:
            features = self.to_features(
                state.get("players", []),
                state.get("match", MatchState()),
                state.get("tactics", TacticalStyle()),
                state.get("coherence", CoherenceReport())
            )
            trajectory.append(features)

        # Wrap in batch dimension: [1, timesteps, 96]
        data = [trajectory]

        # Call UFE API
        energy = self.client.energy(data, self.DOMAIN)
        encoded = self.client.encode(data, self.DOMAIN)

        # Get prediction from last latent state
        latent = encoded.get("latent", [[]])
        if latent and latent[0]:
            last_latent = [latent[0][-1]] if isinstance(latent[0][-1], list) else [latent[0]]
            prediction = self.client.predict(last_latent, num_steps=10)
        else:
            prediction = {"shape": "N/A"}

        return {
            "energy": energy,
            "latent_shape": encoded.get("shape", "N/A"),
            "prediction_shape": prediction.get("shape", "N/A"),
            "friction": energy.get("friction_breakdown", {})
        }

    def analyze_simple(self, feature_trajectory: List[List[float]]) -> Dict[str, Any]:
        """
        Analyze a pre-computed feature trajectory.

        Args:
            feature_trajectory: List of 96-dim feature vectors (one per timestep)

        Returns:
            Analysis results from UFE.
        """
        data = [feature_trajectory]
        energy = self.client.energy(data, self.DOMAIN)
        encoded = self.client.encode(data, self.DOMAIN)

        latent = encoded.get("latent", [[]])
        if latent and latent[0]:
            last_latent = [latent[0][-1]] if isinstance(latent[0][-1], list) else [latent[0]]
            prediction = self.client.predict(last_latent, num_steps=10)
        else:
            prediction = {"shape": "N/A"}

        return {
            "energy": energy,
            "latent_shape": encoded.get("shape", "N/A"),
            "prediction_shape": prediction.get("shape", "N/A"),
            "friction": energy.get("friction_breakdown", {})
        }


def create_match_scenario(
    scenario: str = "balanced"
) -> tuple[List[PlayerState], MatchState, TacticalStyle, CoherenceReport]:
    """
    Create a realistic match scenario for testing.

    Args:
        scenario: One of "balanced", "high_press", "deep_block", "fatigue_crisis", "counter_attack"

    Returns:
        Tuple of (players, match, tactics, coherence)
    """
    # Base player positions for 4-3-3
    base_positions = [
        (-45, 0),    # GK
        (-35, -25),  # LB
        (-35, -8),   # CB
        (-35, 8),    # CB
        (-35, 25),   # RB
        (-15, -20),  # LM
        (-10, 0),    # CM
        (-15, 20),   # RM
        (15, -25),   # LW
        (25, 0),     # ST
        (15, 25),    # RW
    ]

    players = []
    for i, (x, y) in enumerate(base_positions):
        player = PlayerState(x=x, y=y)
        player.speed = 8.0 + i * 0.5
        player.total_distance = 3000 + i * 200
        player.sprint_distance = 200 + i * 30
        player.high_speed_distance = 800 + i * 50
        player.heart_rate = 130 + i * 3
        players.append(player)

    match = MatchState(minute=35, phase="first_half", current_phase="buildUp")
    tactics = TacticalStyle()
    coherence = CoherenceReport(overall_score=85.0)

    if scenario == "high_press":
        # High pressing scenario
        for p in players:
            p.x += 20  # Push up
            p.fatigue += 25
            p.stamina -= 20
            p.work_rate = 85
            p.speed += 3
        match.pressing_intensity = 90
        match.current_phase = "pressing"
        match.block_type = "high"
        match.defensive_line_x = -10
        tactics.pressing_intensity = 95
        tactics.defensive_line = 85
        tactics.tempo = 80
        coherence.overall_score = 75  # High press is harder to maintain
        coherence.dev_intensity = 0.3

    elif scenario == "deep_block":
        # Low block defensive scenario
        for p in players:
            p.x -= 15  # Drop deep
            p.fatigue += 10
            p.work_rate = 40
            p.speed -= 2
        match.pressing_intensity = 20
        match.current_phase = "defensiveBlock"
        match.block_type = "low"
        match.defensive_line_x = -40
        match.momentum = "away"
        tactics.defensive_line = 20
        tactics.pressing_intensity = 15
        tactics.compactness = 90
        coherence.overall_score = 92  # Easier to maintain shape

    elif scenario == "fatigue_crisis":
        # Late game fatigue
        match.minute = 82
        for p in players:
            p.fatigue = 70 + i * 2
            p.stamina = 25 - i * 1.5
            p.work_rate = 35
            p.position_adherence = 60
            p.tactical_compliance = 55
            p.speed -= 4
            p.heart_rate = 175 + i
        match.intensity = 0.4
        match.pressing_intensity = 30
        coherence.overall_score = 55
        coherence.deviation_count = 8
        coherence.dev_movement = 0.6
        coherence.dev_intensity = 0.7

    elif scenario == "counter_attack":
        # Fast transition scenario
        for i, p in enumerate(players):
            if i > 6:  # Attackers sprint forward
                p.x += 30
                p.speed = 28 + i
                p.acceleration = 3.5
            else:  # Defenders recover
                p.speed = 22
        match.current_phase = "transition"
        match.ball_x = 35
        match.momentum = "home"
        match.intensity = 0.95
        tactics.counter_speed = 95
        tactics.tempo = 90
        coherence.dev_timing = 0.2

    return players, match, tactics, coherence


if __name__ == "__main__":
    # Quick test
    with UFEIntegration() as ufe:
        players, match, tactics, coherence = create_match_scenario("balanced")
        features = ufe.to_features(players, match, tactics, coherence)
        print(f"Feature vector length: {len(features)}")
        print(f"Sample features: {features[:10]}")
