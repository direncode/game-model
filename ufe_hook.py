#!/usr/bin/env python3
"""
UFE Hook - Real-time data sync to Undercurrent Flux Engine

Connects real Premier League player data and live match simulation
to the UFE API for tactical modeling and energy analysis.

Usage:
    from ufe_hook import hook
    hook.start()  # Start background sync
    hook.push()   # Manual push
"""

import threading
import time
import random
import math
from typing import List, Dict, Any
from dataclasses import dataclass

from ufe_integration import (
    UFEIntegration,
    PlayerState,
    MatchState,
    TacticalStyle,
    CoherenceReport
)

# Import mock support from demo
try:
    from ufe_demo import MockUFEIntegration
    HAS_MOCK = True
except ImportError:
    HAS_MOCK = False


# Real Premier League player data from 2024/25 season
# Source: src/lib/premier-league-api.ts
REAL_SQUAD_DATA = {
    "MCI": [
        {"name": "Ederson", "position": "GK", "maxSpeed": 26, "acceleration": 3.2, "sprintCapacity": 180},
        {"name": "Kyle Walker", "position": "RB", "maxSpeed": 35.2, "acceleration": 4.5, "sprintCapacity": 450},
        {"name": "Ruben Dias", "position": "CB", "maxSpeed": 31, "acceleration": 3.9, "sprintCapacity": 320},
        {"name": "John Stones", "position": "CB", "maxSpeed": 31.5, "acceleration": 4.0, "sprintCapacity": 330},
        {"name": "Josko Gvardiol", "position": "LB", "maxSpeed": 32, "acceleration": 4.1, "sprintCapacity": 380},
        {"name": "Rodri", "position": "CDM", "maxSpeed": 29, "acceleration": 3.6, "sprintCapacity": 280},
        {"name": "Kevin De Bruyne", "position": "CM", "maxSpeed": 31, "acceleration": 4.0, "sprintCapacity": 350},
        {"name": "Bernardo Silva", "position": "CM", "maxSpeed": 29.5, "acceleration": 3.7, "sprintCapacity": 320},
        {"name": "Phil Foden", "position": "LW", "maxSpeed": 33, "acceleration": 4.3, "sprintCapacity": 420},
        {"name": "Jeremy Doku", "position": "RW", "maxSpeed": 34.5, "acceleration": 4.5, "sprintCapacity": 460},
        {"name": "Erling Haaland", "position": "ST", "maxSpeed": 36, "acceleration": 4.6, "sprintCapacity": 480},
    ],
    "MUN": [
        {"name": "Onana", "position": "GK", "maxSpeed": 26, "acceleration": 3.2, "sprintCapacity": 185},
        {"name": "Diogo Dalot", "position": "RB", "maxSpeed": 32.5, "acceleration": 4.1, "sprintCapacity": 390},
        {"name": "Matthijs de Ligt", "position": "CB", "maxSpeed": 31, "acceleration": 3.9, "sprintCapacity": 330},
        {"name": "Lisandro Martinez", "position": "CB", "maxSpeed": 30.5, "acceleration": 3.8, "sprintCapacity": 320},
        {"name": "Patrick Dorgu", "position": "LB", "maxSpeed": 33, "acceleration": 4.2, "sprintCapacity": 400},
        {"name": "Manuel Ugarte", "position": "CDM", "maxSpeed": 30, "acceleration": 3.7, "sprintCapacity": 310},
        {"name": "Kobbie Mainoo", "position": "CM", "maxSpeed": 31, "acceleration": 3.9, "sprintCapacity": 350},
        {"name": "Bruno Fernandes", "position": "CAM", "maxSpeed": 30.5, "acceleration": 3.8, "sprintCapacity": 340},
        {"name": "Amad Diallo", "position": "RW", "maxSpeed": 33.5, "acceleration": 4.3, "sprintCapacity": 420},
        {"name": "Alejandro Garnacho", "position": "LW", "maxSpeed": 34, "acceleration": 4.4, "sprintCapacity": 440},
        {"name": "Rasmus Hojlund", "position": "ST", "maxSpeed": 34.5, "acceleration": 4.4, "sprintCapacity": 450},
    ]
}

# Base formation positions (4-3-3)
FORMATION_433 = [
    (-45, 0),    # GK
    (-35, 25),   # RB
    (-35, 8),    # CB
    (-35, -8),   # CB
    (-35, -25),  # LB
    (-15, 0),    # CDM
    (-5, 15),    # CM
    (-5, -15),   # CM
    (20, 25),    # RW
    (25, 0),     # ST
    (20, -25),   # LW
]


@dataclass
class LiveMatchState:
    """Tracks live match simulation state."""
    minute: int = 0
    home_score: int = 0
    away_score: int = 0
    phase: str = "first_half"
    possession_home: float = 50.0
    momentum: str = "neutral"
    last_event: str = ""
    tactical_phase: str = "buildUp"


class RealDataGenerator:
    """Generates realistic match data using real Premier League player profiles."""

    def __init__(self, home_team: str = "MCI", away_team: str = "MUN"):
        self.home_squad = REAL_SQUAD_DATA.get(home_team, REAL_SQUAD_DATA["MCI"])
        self.away_squad = REAL_SQUAD_DATA.get(away_team, REAL_SQUAD_DATA["MUN"])
        self.match_state = LiveMatchState()
        self.history: List[Dict] = []

    def _position_offset(self, base_x: float, base_y: float, minute: int) -> tuple:
        """Add realistic position variance based on match flow."""
        # Time-based drift
        time_factor = minute / 90.0

        # Random movement within bounds
        x_offset = random.gauss(0, 3 + time_factor * 2)
        y_offset = random.gauss(0, 2)

        # Tactical phase adjustments
        if self.match_state.tactical_phase == "pressing":
            x_offset += 8
        elif self.match_state.tactical_phase == "defensiveBlock":
            x_offset -= 10

        return (
            max(-50, min(50, base_x + x_offset)),
            max(-32, min(32, base_y + y_offset))
        )

    def _calculate_fatigue(self, player_data: dict, minute: int) -> float:
        """Calculate fatigue based on player profile and match time."""
        base_fatigue = (minute / 90.0) * 60  # Base fatigue increases over time
        sprint_drain = (480 - player_data["sprintCapacity"]) / 480 * 20
        intensity_factor = random.uniform(0.8, 1.2)
        return min(95, base_fatigue + sprint_drain) * intensity_factor

    def _generate_player_states(self, minute: int) -> List[PlayerState]:
        """Generate player states from real squad data."""
        players = []

        for i, (base_pos, player_data) in enumerate(zip(FORMATION_433, self.home_squad)):
            x, y = self._position_offset(base_pos[0], base_pos[1], minute)
            fatigue = self._calculate_fatigue(player_data, minute)

            player = PlayerState(
                x=x,
                y=y,
                speed=player_data["maxSpeed"] * (1 - fatigue / 200) * random.uniform(0.3, 0.8),
                max_speed=player_data["maxSpeed"],
                acceleration=player_data["acceleration"],
                total_distance=minute * 110 + random.randint(-200, 200),
                sprint_distance=minute * 5 + random.randint(-50, 50),
                high_speed_distance=minute * 25 + random.randint(-100, 100),
                fatigue=fatigue,
                stamina=max(10, 100 - fatigue),
                heart_rate=130 + fatigue * 0.6 + random.randint(-5, 10),
                position_adherence=max(50, 95 - fatigue * 0.4 + random.uniform(-5, 5)),
                tactical_compliance=max(45, 90 - fatigue * 0.35 + random.uniform(-5, 5)),
                work_rate=max(30, 75 - fatigue * 0.4 + random.uniform(-10, 10)),
                role=player_data["position"],
                has_ball=(i == 9 and random.random() < 0.15)  # Striker sometimes has ball
            )
            players.append(player)

        return players

    def _update_match_dynamics(self, minute: int):
        """Update match state based on simulation."""
        self.match_state.minute = minute

        # Phase transitions
        if minute <= 45:
            self.match_state.phase = "first_half"
        elif minute <= 60:
            self.match_state.phase = "second_half"
        else:
            self.match_state.phase = "second_half"

        # Tactical phase evolution
        phase_roll = random.random()
        if minute < 20:
            if phase_roll < 0.4:
                self.match_state.tactical_phase = "pressing"
            else:
                self.match_state.tactical_phase = "buildUp"
        elif minute < 60:
            if phase_roll < 0.3:
                self.match_state.tactical_phase = "pressing"
            elif phase_roll < 0.6:
                self.match_state.tactical_phase = "progression"
            else:
                self.match_state.tactical_phase = "buildUp"
        else:
            # Late game - more defensive
            if phase_roll < 0.2:
                self.match_state.tactical_phase = "pressing"
            elif phase_roll < 0.5:
                self.match_state.tactical_phase = "defensiveBlock"
            else:
                self.match_state.tactical_phase = "buildUp"

        # Possession swings
        self.match_state.possession_home = max(35, min(70, 55 + random.gauss(0, 8)))

        # Momentum
        if self.match_state.possession_home > 58:
            self.match_state.momentum = "home"
        elif self.match_state.possession_home < 45:
            self.match_state.momentum = "away"
        else:
            self.match_state.momentum = "neutral"

        # Random events (goals, cards)
        if random.random() < 0.02:  # 2% chance per tick
            if random.random() < 0.6:
                self.match_state.home_score += 1
                self.match_state.last_event = "GOAL - Manchester City!"
            else:
                self.match_state.away_score += 1
                self.match_state.last_event = "GOAL - Manchester United!"

    def generate_state(self, minute: int) -> Dict[str, Any]:
        """Generate a complete state snapshot at given minute."""
        self._update_match_dynamics(minute)

        players = self._generate_player_states(minute)

        match = MatchState(
            minute=minute,
            phase=self.match_state.phase,
            current_phase=self.match_state.tactical_phase,
            home_score=self.match_state.home_score,
            away_score=self.match_state.away_score,
            possession_home=self.match_state.possession_home,
            possession_away=100 - self.match_state.possession_home,
            ball_x=random.uniform(-40, 40),
            ball_y=random.uniform(-25, 25),
            ball_possession="home" if random.random() < self.match_state.possession_home / 100 else "away",
            momentum=self.match_state.momentum,
            intensity=0.7 + random.uniform(-0.15, 0.15),
            pressing_intensity=70 if self.match_state.tactical_phase == "pressing" else 40,
            block_type="high" if self.match_state.tactical_phase == "pressing" else "mid"
        )

        # Tactical style based on City's real approach
        tactics = TacticalStyle(
            possession=85,  # City's possession game
            passing_length=35,  # Short passing
            tempo=70,
            width=75,
            creativity=65,
            defensive_line=70,  # High line
            pressing_intensity=80 if minute < 60 else 55,
            compactness=70,
            counter_speed=60,
            risk_taking=55
        )

        # Coherence based on fatigue
        avg_fatigue = sum(p.fatigue for p in players) / len(players)
        coherence = CoherenceReport(
            overall_score=max(50, 92 - avg_fatigue * 0.5),
            deviation_count=int(avg_fatigue / 20),
            critical_deviation=avg_fatigue > 70,
            dev_position=min(1.0, avg_fatigue / 120),
            dev_movement=min(1.0, avg_fatigue / 100),
            dev_intensity=min(1.0, avg_fatigue / 90),
            dev_timing=min(1.0, avg_fatigue / 110)
        )

        return {
            "players": players,
            "match": match,
            "tactics": tactics,
            "coherence": coherence
        }

    def generate_trajectory(self, start_minute: int = 0, num_steps: int = 10, step_size: int = 3) -> List[Dict]:
        """Generate a trajectory of states over time."""
        trajectory = []
        for i in range(num_steps):
            minute = start_minute + i * step_size
            if minute > 90:
                minute = 90
            state = self.generate_state(minute)
            trajectory.append(state)
        return trajectory


class UFEHook:
    """
    Real-time hook for pushing match data to UFE.

    Fetches real Premier League player data and simulates live match
    state for continuous UFE analysis.
    """

    def __init__(self, interval: int = 60, home_team: str = "MCI", away_team: str = "MUN"):
        """
        Initialize UFE Hook.

        Args:
            interval: Seconds between pushes (default 60)
            home_team: Home team code (MCI, MUN, ARS, LIV)
            away_team: Away team code
        """
        self.interval = interval
        self.running = False
        self.data_generator = RealDataGenerator(home_team, away_team)
        self.current_minute = 0
        self.push_count = 0
        self.last_result = None

        # Initialize UFE integration with mock fallback
        self.use_mock = False
        try:
            if HAS_MOCK:
                self.ufe = MockUFEIntegration(use_mock=False)
            else:
                self.ufe = UFEIntegration()
        except Exception:
            self.ufe = None

    def _fetch_real_data(self) -> List[Dict[str, Any]]:
        """
        Fetch real match data from Premier League player profiles.

        Returns list of state dictionaries with real player data.
        """
        # Generate trajectory from current minute
        trajectory = self.data_generator.generate_trajectory(
            start_minute=self.current_minute,
            num_steps=5,
            step_size=2
        )

        # Advance match time
        self.current_minute = min(90, self.current_minute + 10)
        if self.current_minute >= 90:
            self.current_minute = 0  # Reset for next "match"
            self.data_generator = RealDataGenerator()  # Fresh match

        return trajectory

    def push(self) -> Dict[str, Any]:
        """
        Push current match data to UFE and return analysis.

        Returns:
            Analysis results with energy, friction, and predictions.
        """
        try:
            states = self._fetch_real_data()
            if not states:
                return {"error": "No data available"}

            if self.ufe is None:
                if HAS_MOCK:
                    self.ufe = MockUFEIntegration(use_mock=True)
                else:
                    self.ufe = UFEIntegration()

            # Set scenario based on tactical phase for mock mode
            if HAS_MOCK and hasattr(self.ufe, 'set_scenario'):
                phase = self.data_generator.match_state.tactical_phase
                scenario_map = {
                    "pressing": "high_press",
                    "defensiveBlock": "deep_block",
                    "buildUp": "balanced",
                    "progression": "balanced",
                    "transition": "counter_attack",
                    "finalThird": "balanced"
                }
                self.ufe.set_scenario(scenario_map.get(phase, "balanced"))

            result = self.ufe.analyze(states)
            self.push_count += 1
            self.last_result = result

            # Log output
            energy = result['energy'].get('total_energy', 0)
            friction = result['friction']
            match_info = self.data_generator.match_state

            mode = "[MOCK]" if (HAS_MOCK and hasattr(self.ufe, 'use_mock') and self.ufe.use_mock) else "[LIVE]"
            print(f"[UFE]{mode} Min {match_info.minute:2d} | "
                  f"Score {match_info.home_score}-{match_info.away_score} | "
                  f"Energy: {energy:.3f} | "
                  f"Friction: coh={friction.get('coherence_dev', 0):.2f} "
                  f"fat={friction.get('fatigue_energy', 0):.2f} "
                  f"ovp={friction.get('overpress', 0):.2f}")

            if match_info.last_event:
                print(f"[UFE] EVENT: {match_info.last_event}")
                match_info.last_event = ""

            return result

        except Exception as e:
            # Try mock fallback on error
            if HAS_MOCK and not self.use_mock:
                self.use_mock = True
                self.ufe = MockUFEIntegration(use_mock=True)
                return self.push()  # Retry with mock
            print(f"[UFE] Error: {e}")
            return {"error": str(e)}

    def start(self):
        """Start background sync thread."""
        if self.running:
            print("[UFE] Already running")
            return

        self.running = True

        def loop():
            print(f"[UFE] Manchester Derby simulation started")
            print(f"[UFE] Home: Manchester City | Away: Manchester United")
            print(f"[UFE] Sync interval: {self.interval}s")
            print("-" * 60)

            while self.running:
                self.push()
                time.sleep(self.interval)

        thread = threading.Thread(target=loop, daemon=True)
        thread.start()
        print(f"[UFE] Background sync started (interval={self.interval}s)")

    def stop(self):
        """Stop background sync."""
        self.running = False
        print("[UFE] Background sync stopped")

    def status(self) -> Dict[str, Any]:
        """Get current hook status."""
        return {
            "running": self.running,
            "push_count": self.push_count,
            "current_minute": self.current_minute,
            "match_state": {
                "home_score": self.data_generator.match_state.home_score,
                "away_score": self.data_generator.match_state.away_score,
                "phase": self.data_generator.match_state.phase,
                "tactical_phase": self.data_generator.match_state.tactical_phase
            },
            "last_result": self.last_result
        }


# Global hook instance for easy import
hook = UFEHook(interval=60)


def main():
    """Run hook demo with fast updates."""
    demo_hook = UFEHook(interval=5)  # 5 second interval for demo

    print("=" * 60)
    print("  UFE HOOK - REAL DATA DEMO")
    print("  Manchester City vs Manchester United")
    print("=" * 60)

    # Run 10 pushes to demonstrate
    for i in range(10):
        print(f"\n--- Push {i+1}/10 ---")
        result = demo_hook.push()

        if 'energy' in result:
            e = result['energy']
            print(f"  Total Energy: {e.get('total_energy', 0):.4f}")
            print(f"  Trajectory Deviation: {e.get('trajectory_deviation', 0):.4f}")
            print(f"  Undercurrent Friction: {e.get('undercurrent_friction', 0):.4f}")

        time.sleep(1)

    print("\n" + "=" * 60)
    print("  HOOK STATUS")
    print("=" * 60)
    status = demo_hook.status()
    print(f"  Pushes: {status['push_count']}")
    print(f"  Match: {status['match_state']['home_score']}-{status['match_state']['away_score']}")
    print(f"  Phase: {status['match_state']['tactical_phase']}")


if __name__ == "__main__":
    main()
