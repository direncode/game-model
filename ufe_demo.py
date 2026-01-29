#!/usr/bin/env python3
"""
UFE Demo for Football Tactical Modeling (The Big Dunc)

Demonstrates the Undercurrent Flux Engine integration with realistic
football match scenarios. Analyzes tactical states and outputs energy
metrics, friction terms, and predictions.

Usage:
    python ufe_demo.py
    python ufe_demo.py --mock  # Use mock data if API unavailable
"""

import sys
import random
import math

from ufe_integration import (
    UFEIntegration,
    PlayerState,
    MatchState,
    TacticalStyle,
    CoherenceReport,
    create_match_scenario
)


# Mock API responses for when real API is unavailable
def generate_mock_energy(features: list, scenario: str = "balanced") -> dict:
    """Generate realistic mock energy response based on feature vector."""
    # Base energy from feature analysis
    if features:
        avg_fatigue = features[44] if len(features) > 44 else 0.3
        coherence = features[75] if len(features) > 75 else 0.8
        pressing = features[56] if len(features) > 56 else 0.5
    else:
        avg_fatigue = 0.3
        coherence = 0.8
        pressing = 0.5

    # Scenario-specific adjustments
    scenario_mods = {
        "balanced": {"energy": 0.0, "coherence": 0.0, "fatigue": 0.0, "overpress": 0.0},
        "high_press": {"energy": 0.15, "coherence": 0.1, "fatigue": 0.2, "overpress": 0.35},
        "deep_block": {"energy": -0.1, "coherence": -0.05, "fatigue": 0.05, "overpress": -0.2},
        "fatigue_crisis": {"energy": 0.3, "coherence": 0.25, "fatigue": 0.4, "overpress": 0.15},
        "counter_attack": {"energy": 0.1, "coherence": 0.08, "fatigue": 0.1, "overpress": 0.05},
    }
    mods = scenario_mods.get(scenario, scenario_mods["balanced"])

    # Calculate energy components
    trajectory_deviation = max(0, min(1, 0.25 + (1 - coherence) * 0.4 + mods["energy"] + random.uniform(-0.05, 0.05)))
    undercurrent_friction = max(0, min(1, 0.20 + avg_fatigue * 0.3 + pressing * 0.2 + mods["fatigue"] + random.uniform(-0.03, 0.03)))
    self_prediction_error = max(0, min(1, 0.15 + (1 - coherence) * 0.2 + random.uniform(-0.04, 0.04)))

    total_energy = 0.4 * trajectory_deviation + 0.35 * undercurrent_friction + 0.25 * self_prediction_error

    # Friction breakdown
    coherence_dev = max(0, min(1, (1 - coherence) * 0.8 + mods["coherence"] + random.uniform(-0.02, 0.02)))
    fatigue_energy = max(0, min(1, avg_fatigue * 0.7 + mods["fatigue"] + random.uniform(-0.02, 0.02)))
    overpress = max(0, min(1, pressing * 0.5 + mods["overpress"] + random.uniform(-0.02, 0.02)))

    return {
        "total_energy": total_energy,
        "trajectory_deviation": trajectory_deviation,
        "undercurrent_friction": undercurrent_friction,
        "self_prediction_error": self_prediction_error,
        "friction_breakdown": {
            "coherence_dev": coherence_dev,
            "fatigue_energy": fatigue_energy,
            "overpress": overpress,
            "total": coherence_dev + fatigue_energy + overpress
        }
    }


def generate_mock_encode(num_timesteps: int) -> dict:
    """Generate mock latent encoding response."""
    return {
        "latent": [[[random.gauss(0, 1) for _ in range(256)] for _ in range(num_timesteps)]],
        "shape": [1, num_timesteps, 256]
    }


def generate_mock_predict(num_steps: int) -> dict:
    """Generate mock prediction response."""
    return {
        "predicted": [[[random.gauss(0, 0.5) for _ in range(96)] for _ in range(num_steps)]],
        "shape": [1, num_steps, 96]
    }


class MockUFEIntegration(UFEIntegration):
    """UFE Integration with mock fallback for testing."""

    def __init__(self, use_mock: bool = False):
        self.use_mock = use_mock
        self._mock_scenario = "balanced"
        if not use_mock:
            try:
                super().__init__()
            except Exception:
                self.use_mock = True
                self.client = None

    def set_scenario(self, scenario: str):
        """Set the current scenario for mock responses."""
        self._mock_scenario = scenario

    def analyze(self, states: list) -> dict:
        """Analyze states, falling back to mock if needed."""
        if self.use_mock:
            return self._mock_analyze(states)
        try:
            return super().analyze(states)
        except Exception as e:
            print(f"  [API unavailable: {e}]")
            print("  [Using mock data for demonstration]")
            self.use_mock = True
            return self._mock_analyze(states)

    def _mock_analyze(self, states: list) -> dict:
        """Generate mock analysis response."""
        # Convert first state to features for analysis
        if states:
            first_state = states[0]
            features = self.to_features(
                first_state.get("players", []),
                first_state.get("match", MatchState()),
                first_state.get("tactics", TacticalStyle()),
                first_state.get("coherence", CoherenceReport())
            )
        else:
            features = [0.5] * 96

        energy = generate_mock_energy(features, self._mock_scenario)
        encoded = generate_mock_encode(len(states))
        prediction = generate_mock_predict(10)

        return {
            "energy": energy,
            "latent_shape": encoded["shape"],
            "prediction_shape": prediction["shape"],
            "friction": energy["friction_breakdown"]
        }

    def close(self):
        if hasattr(self, 'client') and self.client:
            self.client.close()


def print_header(title: str):
    """Print a formatted header."""
    print("\n" + "=" * 60)
    print(f"  {title}")
    print("=" * 60)


def print_energy_report(energy: dict, scenario_name: str):
    """Print formatted energy analysis."""
    print(f"\n  Scenario: {scenario_name.upper()}")
    print("-" * 40)
    print(f"  Total Energy:          {energy.get('total_energy', 0):.4f}")
    print(f"  Trajectory Deviation:  {energy.get('trajectory_deviation', 0):.4f}")
    print(f"  Undercurrent Friction: {energy.get('undercurrent_friction', 0):.4f}")
    print(f"  Self-Prediction Error: {energy.get('self_prediction_error', 0):.4f}")


def print_friction_breakdown(friction: dict):
    """Print friction term breakdown."""
    print("\n  Friction Breakdown:")
    for term, value in friction.items():
        if term != 'total':
            # Map friction terms to football concepts
            label = {
                'coherence_dev': 'Coherence Deviation (tactical breakdown)',
                'fatigue_energy': 'Fatigue Energy (stamina drain)',
                'overpress': 'Overpress Risk (pressing sustainability)'
            }.get(term, term)
            print(f"    - {label}: {value:.4f}")
    if 'total' in friction:
        print(f"    - TOTAL FRICTION: {friction['total']:.4f}")


def interpret_energy(energy: float, friction: dict) -> str:
    """Generate tactical interpretation of energy state."""
    interpretations = []

    # Overall energy interpretation
    if energy < 0.3:
        interpretations.append("STABLE - System in equilibrium, tactics executing well")
    elif energy < 0.5:
        interpretations.append("BALANCED - Minor adjustments may help optimization")
    elif energy < 0.7:
        interpretations.append("TRANSITIONING - Tactical adaptations occurring")
    elif energy < 0.85:
        interpretations.append("STRESSED - Consider tactical substitution or formation change")
    else:
        interpretations.append("CRITICAL - Immediate intervention recommended")

    # Friction-specific interpretations
    coherence = friction.get('coherence_dev', 0)
    fatigue = friction.get('fatigue_energy', 0)
    overpress = friction.get('overpress', 0)

    if coherence > 0.6:
        interpretations.append("  ! High coherence deviation - players out of position")
    if fatigue > 0.6:
        interpretations.append("  ! Fatigue accumulating - consider rotation")
    if overpress > 0.6:
        interpretations.append("  ! Over-pressing detected - risk of gaps behind midfield")

    return "\n".join(interpretations)


def create_match_trajectory(num_timesteps: int = 20):
    """
    Create a realistic match trajectory showing tactical evolution.

    Simulates a match segment where the team transitions from
    balanced play to high press to fatigue.
    """
    trajectory_states = []

    for t in range(num_timesteps):
        minute = 30 + t * 2  # 30-minute to 70-minute segment
        phase_progress = t / num_timesteps

        # Create evolving player states
        players = []
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

        for i, (base_x, base_y) in enumerate(base_positions):
            player = PlayerState()

            # Push forward in early phase, then drop back as fatigue sets in
            if phase_progress < 0.4:  # Early: High press
                x_offset = 15 * (1 - phase_progress)
            elif phase_progress < 0.7:  # Mid: Balanced
                x_offset = 5
            else:  # Late: Deep block due to fatigue
                x_offset = -10 * (phase_progress - 0.7) / 0.3

            player.x = base_x + x_offset
            player.y = base_y + (2 * (i % 3) - 2)  # slight lateral movement

            # Evolving fatigue
            base_fatigue = 15 + minute * 0.5 + i * 2
            player.fatigue = min(90, base_fatigue)
            player.stamina = max(15, 100 - base_fatigue)

            # Speed decreases with fatigue
            player.speed = max(5, 12 - player.fatigue * 0.08)
            player.max_speed = 35 - player.fatigue * 0.1

            # Cumulative distances
            player.total_distance = minute * 100 + i * 50
            player.sprint_distance = minute * 5 + i * 3
            player.high_speed_distance = minute * 20 + i * 10

            # Heart rate increases with fatigue
            player.heart_rate = 130 + player.fatigue * 0.5 + i

            # Tactical metrics degrade with fatigue
            player.position_adherence = max(50, 95 - player.fatigue * 0.4)
            player.tactical_compliance = max(45, 90 - player.fatigue * 0.35)
            player.work_rate = max(30, 80 - player.fatigue * 0.5)

            players.append(player)

        # Match state evolution
        match = MatchState()
        match.minute = minute
        match.phase = "first_half" if minute <= 45 else "second_half"

        if phase_progress < 0.3:
            match.current_phase = "pressing"
            match.pressing_intensity = 85 - phase_progress * 50
            match.block_type = "high"
            match.momentum = "home"
        elif phase_progress < 0.6:
            match.current_phase = "buildUp"
            match.pressing_intensity = 55
            match.block_type = "mid"
            match.momentum = "neutral"
        else:
            match.current_phase = "defensiveBlock"
            match.pressing_intensity = 30
            match.block_type = "low"
            match.momentum = "away"

        match.intensity = 0.8 - phase_progress * 0.3
        match.ball_x = 10 - phase_progress * 30
        match.ball_y = 5 * (t % 5 - 2)
        match.possession_home = 55 - phase_progress * 15

        # Tactical style adapts
        tactics = TacticalStyle()
        if phase_progress < 0.3:
            tactics.pressing_intensity = 90
            tactics.defensive_line = 75
            tactics.tempo = 80
            tactics.compactness = 60
        elif phase_progress < 0.6:
            tactics.pressing_intensity = 60
            tactics.defensive_line = 55
            tactics.tempo = 60
            tactics.compactness = 70
        else:
            tactics.pressing_intensity = 30
            tactics.defensive_line = 30
            tactics.tempo = 45
            tactics.compactness = 90

        # Coherence degrades
        coherence = CoherenceReport()
        avg_fatigue = sum(p.fatigue for p in players) / len(players)
        coherence.overall_score = max(50, 95 - avg_fatigue * 0.6)
        coherence.deviation_count = int(avg_fatigue / 15)
        coherence.critical_deviation = avg_fatigue > 70
        coherence.dev_position = min(1.0, avg_fatigue / 100)
        coherence.dev_movement = min(1.0, avg_fatigue / 90)
        coherence.dev_intensity = min(1.0, avg_fatigue / 80)

        trajectory_states.append({
            "players": players,
            "match": match,
            "tactics": tactics,
            "coherence": coherence
        })

    return trajectory_states


def main():
    """Run the UFE demo with realistic football scenarios."""
    use_mock = "--mock" in sys.argv

    print_header("UFE CONNECTION TEST")

    ufe = MockUFEIntegration(use_mock=use_mock)

    try:
        # Test API connection
        if not ufe.use_mock:
            try:
                health = ufe.client.health()
                print(f"  Status: {health['status']}")
                print(f"  Latent Dim: {health['latent_dim']}")
                print(f"  Domains: {health['domains']}")
            except Exception as e:
                print(f"  API connection failed: {e}")
                print("  Falling back to mock mode for demonstration...")
                ufe.use_mock = True

        if ufe.use_mock:
            print("  Mode: MOCK (demonstrating expected output)")
            print("  Status: healthy (simulated)")
            print("  Latent Dim: 256")
            print("  Domains: ['macro', 'agents', 'capsules', 'governance', 'football']")

        print_header("FOOTBALL DOMAIN ANALYSIS")
        print(f"  Domain: {ufe.DOMAIN}")
        print(f"  Feature Dimensions: {ufe.FEATURE_DIM}")
        print(f"  Friction Terms: coherence_dev, fatigue_energy, overpress")

        # Analyze different tactical scenarios
        print_header("TACTICAL SCENARIO ANALYSIS")

        scenarios = [
            ("balanced", "Standard balanced formation and tactics"),
            ("high_press", "Gegenpressing - high intensity pressing"),
            ("deep_block", "Low block defensive structure"),
            ("fatigue_crisis", "Late game fatigue accumulation"),
            ("counter_attack", "Fast transition counter-attack"),
        ]

        scenario_results = {}

        for scenario_name, description in scenarios:
            players, match, tactics, coherence = create_match_scenario(scenario_name)

            # Create short trajectory (5 timesteps of same state)
            states = [
                {"players": players, "match": match, "tactics": tactics, "coherence": coherence}
                for _ in range(5)
            ]

            ufe.set_scenario(scenario_name)  # For mock mode
            result = ufe.analyze(states)
            scenario_results[scenario_name] = result

            print_energy_report(result['energy'], f"{scenario_name} - {description}")
            print_friction_breakdown(result['friction'])
            print(f"\n  Latent Shape: {result['latent_shape']}")
            print(f"  Prediction Shape: {result['prediction_shape']}")

        # Match trajectory analysis
        print_header("MATCH TRAJECTORY ANALYSIS (30-min segment)")
        print("  Simulating: High Press → Balanced → Fatigue/Deep Block")

        trajectory_states = create_match_trajectory(num_timesteps=20)
        ufe.set_scenario("fatigue_crisis")  # Trajectory ends in fatigue
        trajectory_result = ufe.analyze(trajectory_states)

        print(f"\n  Timesteps analyzed: {len(trajectory_states)}")
        print(f"  Minutes covered: {trajectory_states[0]['match'].minute} - {trajectory_states[-1]['match'].minute}")

        print_energy_report(trajectory_result['energy'], "FULL TRAJECTORY")
        print_friction_breakdown(trajectory_result['friction'])
        print(f"\n  Latent Shape: {trajectory_result['latent_shape']}")
        print(f"  Prediction Shape: {trajectory_result['prediction_shape']}")

        # Interpretation
        print_header("TACTICAL INTERPRETATION")

        total_energy = trajectory_result['energy'].get('total_energy', 0)
        friction = trajectory_result['friction']

        interpretation = interpret_energy(total_energy, friction)
        print(f"\n{interpretation}")

        # Comparison summary
        print_header("SCENARIO COMPARISON SUMMARY")
        print("\n  Scenario              | Energy  | Friction | Stability")
        print("  " + "-" * 56)

        for name, result in scenario_results.items():
            energy = result['energy'].get('total_energy', 0)
            friction_total = result['friction'].get('total', 0)

            if energy < 0.4:
                stability = "STABLE"
            elif energy < 0.7:
                stability = "MODERATE"
            else:
                stability = "UNSTABLE"

            print(f"  {name:<21} | {energy:>6.3f} | {friction_total:>8.3f} | {stability}")

        # Recommendations
        print_header("UFE RECOMMENDATIONS")

        highest_energy = max(scenario_results.items(), key=lambda x: x[1]['energy'].get('total_energy', 0))
        lowest_energy = min(scenario_results.items(), key=lambda x: x[1]['energy'].get('total_energy', 0))

        print(f"\n  Highest energy state: {highest_energy[0]}")
        print(f"    → Consider: Tactical adjustment, substitution, or formation change")

        print(f"\n  Lowest energy state: {lowest_energy[0]}")
        print(f"    → This is the most stable tactical configuration")

        # Check specific friction concerns
        for name, result in scenario_results.items():
            friction = result['friction']
            concerns = []
            if friction.get('coherence_dev', 0) > 0.5:
                concerns.append("coherence breakdown")
            if friction.get('fatigue_energy', 0) > 0.5:
                concerns.append("fatigue accumulation")
            if friction.get('overpress', 0) > 0.5:
                concerns.append("over-pressing risk")

            if concerns:
                print(f"\n  {name}: Watch for {', '.join(concerns)}")

        print("\n" + "=" * 60)
        print("  UFE DEMO COMPLETE")
        print("=" * 60 + "\n")

    finally:
        ufe.close()


if __name__ == "__main__":
    main()
