"""Synthetic corpus generators for the 8 defense verticals.

Each generator returns (entities, edges, anomaly_names) where:
  entities: list of {name, type, attributes} dicts (BTUT input shape)
  edges:    list of {source, target, type, weight} dicts (often empty)
  anomaly_names: set of entity names that are ground-truth anomalies

All generators are seeded with seed=42 by default for reproducibility.
Anomalies are designed to be structurally distinct from normal entities
in the joint multi-type embedding space — exactly the regime BTUT targets.
"""
from __future__ import annotations

import numpy as np


# ---------------------------------------------------------------------------
# Vertical 1: All-source / fused intelligence
# ---------------------------------------------------------------------------
def gen_all_source(n_entities: int = 1500, n_anomalies: int = 30, seed: int = 42):
    """Cable messages: text + numeric + categorical fused intel.

    Normal: HUMINT/SIGINT/IMINT/OSINT cables with topic-typical urgency.
    Anomalies: cables whose urgency, actor mix, and topic combination
    don't match any normal pattern (the "novel actor + wrong urgency" signal).
    """
    rng = np.random.default_rng(seed)

    topics = [
        "diplomatic", "kinetic_event", "logistics", "counter_intel",
        "cyber", "humanitarian", "leadership", "energy", "border", "maritime",
    ]
    typical_urgency = {
        "diplomatic": (1, 2), "kinetic_event": (4, 5), "logistics": (1, 3),
        "counter_intel": (3, 5), "cyber": (3, 4), "humanitarian": (2, 3),
        "leadership": (3, 4), "energy": (2, 4), "border": (3, 5), "maritime": (2, 4),
    }
    actors_pool = [f"actor_{c}{i:02d}" for c in "ABCDEFGHIJ" for i in range(8)]
    locations_pool = [f"loc_{i:03d}" for i in range(40)]
    units = [f"unit_{i:02d}" for i in range(15)]
    types_pool = ["HUMINT", "SIGINT", "IMINT", "OSINT"]

    entities = []
    anomaly_names = set()

    n_normal = n_entities - n_anomalies
    for i in range(n_normal):
        topic = topics[int(rng.integers(0, len(topics)))]
        urg_low, urg_high = typical_urgency[topic]
        urgency = float(rng.integers(urg_low, urg_high + 1))
        type_ = types_pool[int(rng.integers(0, len(types_pool)))]
        actor_a = actors_pool[int(rng.integers(0, len(actors_pool)))]
        actor_b = actors_pool[int(rng.integers(0, len(actors_pool)))]
        loc = locations_pool[int(rng.integers(0, len(locations_pool)))]
        unit = units[int(rng.integers(0, len(units)))]
        text = f"{topic} cable mentioning {actor_a} and {actor_b} at {loc}"
        name = f"cable_{i:05d}"
        entities.append({
            "name": name,
            "type": type_,
            "attributes": {
                "topic": topic,
                "urgency": urgency,
                "confidence": float(rng.uniform(0.4, 0.95)),
                "originating_unit": unit,
                "actor_a": actor_a,
                "actor_b": actor_b,
                "location": loc,
                "text": text,
                "day_of_week": int(rng.integers(0, 7)),
            },
        })

    for i in range(n_anomalies):
        # Anomaly: novel actor pair + topic mismatched urgency
        topic = topics[int(rng.integers(0, len(topics)))]
        urg_low, urg_high = typical_urgency[topic]
        # Flip urgency to wrong-end-of-range
        urgency = float(rng.integers(1, urg_low + 1)) if urg_low > 2 else float(rng.integers(urg_high, 6))
        novel_actor_a = f"NOVEL_actor_X{i:02d}"
        novel_actor_b = f"NOVEL_actor_Y{i:02d}"
        text = f"{topic} cable mentioning {novel_actor_a} and {novel_actor_b} EXOTIC_LOCATION"
        name = f"cable_anomaly_{i:03d}"
        entities.append({
            "name": name,
            "type": "MULTI_INT",  # novel type
            "attributes": {
                "topic": topic,
                "urgency": urgency,
                "confidence": float(rng.uniform(0.05, 0.30)),  # low confidence + flipped urgency
                "originating_unit": f"NOVEL_unit_{i:02d}",
                "actor_a": novel_actor_a,
                "actor_b": novel_actor_b,
                "location": f"NOVEL_loc_{i:02d}",
                "text": text,
                "day_of_week": int(rng.integers(0, 7)),
            },
        })
        anomaly_names.add(name)

    edges = []
    return entities, edges, anomaly_names


# ---------------------------------------------------------------------------
# Vertical 2: SIGINT / COMINT
# ---------------------------------------------------------------------------
def gen_sigint(n_entities: int = 2000, n_anomalies: int = 40, seed: int = 42):
    """Emitter events with novel-emitter and spoofed-emitter anomalies."""
    rng = np.random.default_rng(seed)

    n_known = 30
    known_emitters = []
    bands = ["VHF", "UHF", "L_BAND", "S_BAND", "C_BAND", "X_BAND", "K_BAND"]
    mods = ["AM", "FM", "PSK", "QAM", "FSK", "GMSK"]
    for i in range(n_known):
        cf = float(rng.uniform(30, 12000))  # 30 MHz to 12 GHz
        band = bands[min(len(bands) - 1, int(np.log10(cf / 30) * 1.5))]
        known_emitters.append({
            "id": f"E{i:03d}",
            "freq": cf,
            "bw": float(rng.uniform(5, 500)),  # kHz
            "mod": mods[int(rng.integers(0, len(mods)))],
            "dur": float(rng.uniform(50, 5000)),  # ms
            "band": band,
            "power": float(rng.uniform(-80, -50)),  # dBm
        })

    entities = []
    anomaly_names = set()

    n_normal = n_entities - n_anomalies
    for i in range(n_normal):
        em = known_emitters[int(rng.integers(0, n_known))]
        name = f"sig_{i:05d}"
        entities.append({
            "name": name,
            "type": "emitter_event",
            "attributes": {
                "emitter_id": em["id"],
                "freq_mhz": float(em["freq"] + rng.normal(0, em["bw"] / 1000)),
                "bandwidth_khz": float(rng.normal(em["bw"], em["bw"] * 0.1)),
                "modulation": em["mod"],
                "duration_ms": float(rng.normal(em["dur"], em["dur"] * 0.2)),
                "signal_strength_dbm": float(rng.normal(em["power"], 5)),
                "band": em["band"],
            },
        })

    for i in range(n_anomalies):
        anom_kind = "novel" if i % 2 == 0 else "spoofed"
        name = f"sig_anomaly_{anom_kind}_{i:03d}"
        if anom_kind == "novel":
            entities.append({
                "name": name,
                "type": "emitter_event",
                "attributes": {
                    "emitter_id": f"NOVEL_{i:03d}",
                    "freq_mhz": float(rng.uniform(20000, 80000)),  # exotic high band
                    "bandwidth_khz": float(rng.uniform(0.05, 50000)),  # extreme bandwidth
                    "modulation": "WIDEBAND_SS_NOVEL",
                    "duration_ms": float(rng.uniform(0.05, 60000)),
                    "signal_strength_dbm": float(rng.uniform(-30, -10)),
                    "band": "EXOTIC_HIGH",
                },
            })
        else:
            em = known_emitters[int(rng.integers(0, n_known))]
            entities.append({
                "name": name,
                "type": "emitter_event",
                "attributes": {
                    "emitter_id": em["id"],
                    "freq_mhz": float(em["freq"] * 10.0),  # decade-shifted, suspicious
                    "bandwidth_khz": float(em["bw"] * 0.001),  # impossibly narrow
                    "modulation": "SPOOFED_NULL",
                    "duration_ms": float(em["dur"] * 100.0),
                    "signal_strength_dbm": float(rng.uniform(-130, -120)),  # suspicious low
                    "band": "EXOTIC_LOW",
                },
            })
        anomaly_names.add(name)

    edges = []
    return entities, edges, anomaly_names


# ---------------------------------------------------------------------------
# Vertical 3: EW spectrum management
# ---------------------------------------------------------------------------
def gen_ew(n_entities: int = 1800, n_anomalies: int = 36, seed: int = 42):
    """Spectral observations: novel emissions, coordinated jammers."""
    rng = np.random.default_rng(seed)

    # Normal: 5 RF profiles in different bands
    profiles = [
        {"cf_lo": 30, "cf_hi": 300, "hop": (0.5, 2.0), "dwell": (50, 500), "agility": (0.0, 0.2)},
        {"cf_lo": 300, "cf_hi": 1000, "hop": (1.0, 5.0), "dwell": (20, 200), "agility": (0.1, 0.3)},
        {"cf_lo": 1000, "cf_hi": 3000, "hop": (5.0, 20.0), "dwell": (5, 50), "agility": (0.2, 0.5)},
        {"cf_lo": 3000, "cf_hi": 8000, "hop": (10.0, 50.0), "dwell": (1, 20), "agility": (0.3, 0.6)},
        {"cf_lo": 8000, "cf_hi": 12000, "hop": (20.0, 100.0), "dwell": (0.5, 10), "agility": (0.4, 0.7)},
    ]

    entities = []
    anomaly_names = set()

    n_normal = n_entities - n_anomalies
    for i in range(n_normal):
        p = profiles[int(rng.integers(0, len(profiles)))]
        cf = float(rng.uniform(p["cf_lo"], p["cf_hi"]))
        name = f"ew_{i:05d}"
        entities.append({
            "name": name,
            "type": "spectrum_obs",
            "attributes": {
                "center_freq_mhz": cf,
                "bandwidth_mhz": float(rng.uniform(0.1, 20.0)),
                "hop_rate_hz": float(rng.uniform(p["hop"][0], p["hop"][1])),
                "dwell_time_ms": float(rng.uniform(p["dwell"][0], p["dwell"][1])),
                "agility_score": float(rng.uniform(p["agility"][0], p["agility"][1])),
                "power_dbm": float(rng.uniform(-90, -50)),
                "spatial_corr": float(rng.uniform(0.0, 0.2)),
                "band_label": f"band_{int((cf - 30) / 1000)}",
            },
        })

    for i in range(n_anomalies):
        kind = "novel_emission" if i % 2 == 0 else "coordinated_jammer"
        name = f"ew_anomaly_{kind}_{i:03d}"
        if kind == "novel_emission":
            entities.append({
                "name": name,
                "type": "spectrum_obs",
                "attributes": {
                    "center_freq_mhz": float(rng.uniform(15000, 40000)),  # exotic band
                    "bandwidth_mhz": float(rng.uniform(50, 500)),  # extreme width
                    "hop_rate_hz": float(rng.uniform(500, 5000)),  # extreme hop
                    "dwell_time_ms": float(rng.uniform(0.01, 0.1)),  # impossibly short
                    "agility_score": float(rng.uniform(0.9, 1.0)),
                    "power_dbm": float(rng.uniform(-30, -5)),
                    "spatial_corr": float(rng.uniform(0.1, 0.4)),
                    "band_label": "novel_exotic",
                },
            })
        else:
            entities.append({
                "name": name,
                "type": "spectrum_obs",
                "attributes": {
                    "center_freq_mhz": float(rng.uniform(1000, 3000)),
                    "bandwidth_mhz": float(rng.uniform(5, 30)),
                    "hop_rate_hz": float(rng.uniform(5, 50)),
                    "dwell_time_ms": float(rng.uniform(1, 50)),
                    "agility_score": float(rng.uniform(0.4, 0.7)),
                    "power_dbm": float(rng.uniform(-50, -30)),
                    "spatial_corr": float(rng.uniform(0.85, 0.99)),  # high coordination
                    "band_label": "jammer_coord",
                },
            })
        anomaly_names.add(name)

    edges = []
    return entities, edges, anomaly_names


# ---------------------------------------------------------------------------
# Vertical 4: Counter-UAS / counter-MASINT
# ---------------------------------------------------------------------------
def gen_counter_uas(n_entities: int = 1200, n_anomalies: int = 24, seed: int = 42):
    """Multi-modal sensor tracks. Anomalies = low-observable threats + odd behavior."""
    rng = np.random.default_rng(seed)

    profiles = [
        # commercial drones: medium RF, low acoustic, low IR, low altitude, moderate speed
        {"type": "commercial_drone", "rf": (0.5, 0.8), "ac": (0.2, 0.4),
         "ir": (0.2, 0.4), "alt": (50, 400), "vel": (5, 25), "man": (0.1, 0.4)},
        # civilian aircraft: low RF, high acoustic, high IR, high altitude, high speed
        {"type": "civilian_aircraft", "rf": (0.0, 0.2), "ac": (0.7, 1.0),
         "ir": (0.7, 1.0), "alt": (1000, 12000), "vel": (60, 250), "man": (0.0, 0.2)},
        # bird: very low RF, medium acoustic, low IR, low altitude, low speed
        {"type": "bird", "rf": (0.0, 0.05), "ac": (0.3, 0.5),
         "ir": (0.1, 0.3), "alt": (0, 100), "vel": (2, 15), "man": (0.3, 0.7)},
        # weather balloon: very low RF, very low acoustic, low IR, very high altitude, very low speed
        {"type": "weather_balloon", "rf": (0.0, 0.05), "ac": (0.0, 0.1),
         "ir": (0.1, 0.3), "alt": (5000, 30000), "vel": (0, 5), "man": (0.0, 0.1)},
    ]

    entities = []
    anomaly_names = set()

    n_normal = n_entities - n_anomalies
    for i in range(n_normal):
        p = profiles[int(rng.integers(0, len(profiles)))]
        name = f"track_{i:05d}"
        entities.append({
            "name": name,
            "type": p["type"],
            "attributes": {
                "rf_signature": float(rng.uniform(*p["rf"])),
                "acoustic_signature": float(rng.uniform(*p["ac"])),
                "ir_signature": float(rng.uniform(*p["ir"])),
                "altitude_m": float(rng.uniform(*p["alt"])),
                "velocity_mps": float(rng.uniform(*p["vel"])),
                "maneuver_score": float(rng.uniform(*p["man"])),
                "dwell_s": float(rng.uniform(2, 60)),
                "track_quality": float(rng.uniform(0.5, 0.95)),
            },
        })

    for i in range(n_anomalies):
        kind = "low_observable_threat" if i % 2 == 0 else "hover_then_dart"
        name = f"track_anomaly_{kind}_{i:03d}"
        if kind == "low_observable_threat":
            entities.append({
                "name": name,
                "type": "unknown_threat",
                "attributes": {
                    "rf_signature": float(rng.uniform(0.0, 0.1)),  # very low
                    "acoustic_signature": float(rng.uniform(0.0, 0.1)),  # very low
                    "ir_signature": float(rng.uniform(0.0, 0.15)),  # very low
                    "altitude_m": float(rng.uniform(20, 200)),
                    "velocity_mps": float(rng.uniform(20, 80)),  # high
                    "maneuver_score": float(rng.uniform(0.7, 1.0)),  # high
                    "dwell_s": float(rng.uniform(60, 300)),
                    "track_quality": float(rng.uniform(0.1, 0.4)),  # poor
                },
            })
        else:
            entities.append({
                "name": name,
                "type": "unknown_threat",
                "attributes": {
                    "rf_signature": float(rng.uniform(0.3, 0.7)),
                    "acoustic_signature": float(rng.uniform(0.1, 0.3)),
                    "ir_signature": float(rng.uniform(0.2, 0.4)),
                    "altitude_m": float(rng.uniform(30, 250)),
                    "velocity_mps": float(rng.uniform(0.5, 60)),  # high variance not in single track
                    "maneuver_score": float(rng.uniform(0.85, 1.0)),
                    "dwell_s": float(rng.uniform(1, 5)),  # very short
                    "track_quality": float(rng.uniform(0.3, 0.6)),
                },
            })
        anomaly_names.add(name)

    edges = []
    return entities, edges, anomaly_names


# ---------------------------------------------------------------------------
# Vertical 5: PNT integrity
# ---------------------------------------------------------------------------
def gen_pnt(n_entities: int = 1600, n_anomalies: int = 32, seed: int = 42):
    """Multi-receiver GPS readings; anomalies = spoofing events."""
    rng = np.random.default_rng(seed)

    receivers = [f"rx_{i:02d}" for i in range(8)]
    location_clusters = [f"loc_cluster_{i:02d}" for i in range(20)]

    entities = []
    anomaly_names = set()

    n_normal = n_entities - n_anomalies
    for i in range(n_normal):
        rx = receivers[int(rng.integers(0, len(receivers)))]
        loc = location_clusters[int(rng.integers(0, len(location_clusters)))]
        # Normal: low residual, small consensus delta, no jamming
        name = f"pnt_{i:05d}"
        entities.append({
            "name": name,
            "type": "gps_reading",
            "attributes": {
                "receiver_id": rx,
                "cluster_id": loc,
                "residual_m": float(abs(rng.normal(0, 0.5))),
                "consensus_delta_m": float(abs(rng.normal(0, 0.3))),
                "snr_dbhz": float(rng.uniform(35, 50)),
                "drift_rate_m_per_s": float(rng.normal(0, 0.05)),
                "jamming_indicator": float(rng.uniform(0, 0.05)),
                "satellites_in_view": float(rng.integers(8, 14)),
            },
        })

    # Anomaly archetypes diversified across spoofing styles + drift styles
    spoofing_styles = [
        {"residual_sigma": 0.2, "delta_lo": 15, "delta_hi": 40, "snr_lo": 45, "snr_hi": 50, "label": "spoof_smallcap"},
        {"residual_sigma": 0.3, "delta_lo": 40, "delta_hi": 80, "snr_lo": 48, "snr_hi": 55, "label": "spoof_mediumcap"},
        {"residual_sigma": 0.4, "delta_lo": 80, "delta_hi": 200, "snr_lo": 50, "snr_hi": 58, "label": "spoof_largecap"},
        {"residual_sigma": 0.15, "delta_lo": 5, "delta_hi": 20, "snr_lo": 40, "snr_hi": 48, "label": "spoof_subtle"},
    ]
    drift_styles = [
        {"residual_mu": 2.5, "snr_lo": 20, "snr_hi": 30, "drift_lo": 0.5, "drift_hi": 2.0, "jam_lo": 0.4, "jam_hi": 0.8, "label": "drift_jammed"},
        {"residual_mu": 4.5, "snr_lo": 15, "snr_hi": 25, "drift_lo": 1.5, "drift_hi": 5.0, "jam_lo": 0.6, "jam_hi": 0.95, "label": "drift_severe"},
        {"residual_mu": 1.5, "snr_lo": 30, "snr_hi": 38, "drift_lo": 0.2, "drift_hi": 0.8, "jam_lo": 0.2, "jam_hi": 0.5, "label": "drift_subtle"},
        {"residual_mu": 8.0, "snr_lo": 12, "snr_hi": 20, "drift_lo": 3.0, "drift_hi": 8.0, "jam_lo": 0.7, "jam_hi": 1.0, "label": "drift_extreme"},
    ]
    for i in range(n_anomalies):
        kind = "spoofing" if i % 2 == 0 else "gradual_drift"
        rx = receivers[int(rng.integers(0, len(receivers)))]
        loc = location_clusters[int(rng.integers(0, len(location_clusters)))]
        name = f"pnt_anomaly_{kind}_{i:03d}"
        unique_marker = f"NOVEL_PNT_{i:03d}"
        if kind == "spoofing":
            s = spoofing_styles[i % len(spoofing_styles)]
            entities.append({
                "name": name,
                "type": "gps_reading",
                "attributes": {
                    "receiver_id": rx,
                    "cluster_id": loc,
                    "residual_m": float(abs(rng.normal(0, s["residual_sigma"]))),
                    "consensus_delta_m": float(rng.uniform(s["delta_lo"], s["delta_hi"])),
                    "snr_dbhz": float(rng.uniform(s["snr_lo"], s["snr_hi"])),
                    "drift_rate_m_per_s": float(rng.normal(0, 0.05)),
                    "jamming_indicator": float(rng.uniform(0, 0.10)),
                    "satellites_in_view": float(rng.integers(11, 15)),
                    "style_label": s["label"],
                    "anomaly_marker": unique_marker,
                },
            })
        else:
            d = drift_styles[i % len(drift_styles)]
            entities.append({
                "name": name,
                "type": "gps_reading",
                "attributes": {
                    "receiver_id": rx,
                    "cluster_id": loc,
                    "residual_m": float(abs(rng.normal(d["residual_mu"], 0.8))),
                    "consensus_delta_m": float(abs(rng.normal(1.5, 0.5))),
                    "snr_dbhz": float(rng.uniform(d["snr_lo"], d["snr_hi"])),
                    "drift_rate_m_per_s": float(rng.uniform(d["drift_lo"], d["drift_hi"])),
                    "jamming_indicator": float(rng.uniform(d["jam_lo"], d["jam_hi"])),
                    "satellites_in_view": float(rng.integers(4, 7)),
                    "style_label": d["label"],
                    "anomaly_marker": unique_marker,
                },
            })
        anomaly_names.add(name)

    edges = []
    return entities, edges, anomaly_names


# ---------------------------------------------------------------------------
# Vertical 6: Imagery / geospatial
# ---------------------------------------------------------------------------
def gen_geospatial(n_entities: int = 1500, n_anomalies: int = 30, seed: int = 42):
    """Event tracks (AIS, ADS-B, GPS). Anomalies = spatial outliers + AIS gaps."""
    rng = np.random.default_rng(seed)

    types_pool = ["ais_vessel", "adsb_aircraft", "gps_track"]
    # Define 5 shipping/airway corridors (lat, lon) bounds
    corridors = [
        {"lat": (30, 35), "lon": (-80, -75), "speed": (10, 22)},  # US east coast
        {"lat": (50, 55), "lon": (-5, 5), "speed": (12, 24)},     # English Channel
        {"lat": (25, 30), "lon": (50, 60), "speed": (8, 18)},     # Persian Gulf
        {"lat": (35, 40), "lon": (130, 145), "speed": (15, 30)},  # Sea of Japan
        {"lat": (10, 20), "lon": (110, 125), "speed": (10, 20)},  # South China Sea
    ]

    entities = []
    anomaly_names = set()

    n_normal = n_entities - n_anomalies
    for i in range(n_normal):
        c = corridors[int(rng.integers(0, len(corridors)))]
        type_ = types_pool[int(rng.integers(0, len(types_pool)))]
        name = f"track_{i:05d}"
        entities.append({
            "name": name,
            "type": type_,
            "attributes": {
                "lat": float(rng.uniform(*c["lat"])),
                "lon": float(rng.uniform(*c["lon"])),
                "speed_kts": float(rng.uniform(*c["speed"])),
                "heading_deg": float(rng.uniform(0, 360)),
                "dwell_min": float(rng.uniform(5, 60)),
                "shipping_lane_consistency": float(rng.uniform(0.7, 1.0)),
                "ais_consistency": float(rng.uniform(0.8, 1.0)),
                "report_density": float(rng.uniform(0.6, 1.0)),
            },
        })

    # Anomaly archetypes — diversified so each anomaly has a distinct
    # structural fingerprint and BTUT does not collapse them to one cell.
    out_of_lane_regions = [
        {"lat": (-65, -45), "lon": (-160, -120), "label": "se_pacific"},
        {"lat": (60, 78),   "lon": (-180, -150), "label": "arctic"},
        {"lat": (-50, -30), "lon": (45, 75),     "label": "sw_indian"},
        {"lat": (-30, -10), "lon": (-140, -110), "label": "central_pacific"},
        {"lat": (40, 55),   "lon": (-30, 0),     "label": "north_atlantic_remote"},
        {"lat": (-60, -50), "lon": (10, 40),     "label": "antarctic_circle"},
    ]
    ais_dark_lanes = [
        {"lat": (20, 35),  "lon": (115, 130), "label": "south_china_sea"},
        {"lat": (10, 25),  "lon": (50, 65),   "label": "arabian_sea"},
        {"lat": (35, 45),  "lon": (-75, -65), "label": "northeast_us"},
        {"lat": (-5, 5),   "lon": (95, 110),  "label": "malacca"},
        {"lat": (50, 60),  "lon": (15, 30),   "label": "baltic"},
        {"lat": (28, 35),  "lon": (32, 36),   "label": "suez_approach"},
    ]
    for i in range(n_anomalies):
        kind = "out_of_lane" if i % 2 == 0 else "ais_gap_dark"
        unique_marker = f"NOVEL_TRACK_{i:03d}"
        name = f"track_anomaly_{kind}_{i:03d}"
        if kind == "out_of_lane":
            region = out_of_lane_regions[i % len(out_of_lane_regions)]
            entities.append({
                "name": name,
                "type": "ais_vessel",
                "attributes": {
                    "lat": float(rng.uniform(*region["lat"])),
                    "lon": float(rng.uniform(*region["lon"])),
                    "speed_kts": float(rng.uniform(0, 6)),  # slow / loitering, varied
                    "heading_deg": float(rng.uniform(0, 360)),
                    "dwell_min": float(rng.uniform(60, 720)),  # widely varied
                    "shipping_lane_consistency": float(rng.uniform(0.0, 0.2)),
                    "ais_consistency": float(rng.uniform(0.3, 0.8)),  # widened
                    "report_density": float(rng.uniform(0.1, 0.5)),
                    "region_label": region["label"],
                    "anomaly_marker": unique_marker,
                },
            })
        else:
            lane = ais_dark_lanes[i % len(ais_dark_lanes)]
            entities.append({
                "name": name,
                "type": "gps_track",
                "attributes": {
                    "lat": float(rng.uniform(*lane["lat"])),
                    "lon": float(rng.uniform(*lane["lon"])),
                    "speed_kts": float(rng.uniform(2, 26)),
                    "heading_deg": float(rng.uniform(0, 360)),
                    "dwell_min": float(rng.uniform(5, 150)),
                    "shipping_lane_consistency": float(rng.uniform(0.3, 0.8)),
                    "ais_consistency": float(rng.uniform(0.0, 0.2)),  # AIS dark
                    "report_density": float(rng.uniform(0.05, 0.4)),
                    "lane_label": lane["label"],
                    "anomaly_marker": unique_marker,
                },
            })
        anomaly_names.add(name)

    edges = []
    return entities, edges, anomaly_names


# ---------------------------------------------------------------------------
# Vertical 7: Network / cyber forensics
# ---------------------------------------------------------------------------
def gen_network(n_entities: int = 2500, n_anomalies: int = 50, seed: int = 42):
    """Network flow records. Anomalies = C2 beaconing + asymmetric exfil."""
    rng = np.random.default_rng(seed)

    src_subnets = [f"10.0.{i}.0/24" for i in range(20)]
    dst_subnets = [f"203.0.{i}.0/24" for i in range(20)]
    port_categories = ["web_https", "web_http", "db_postgres", "db_mongo", "ssh", "dns", "smb", "rdp"]

    entities = []
    anomaly_names = set()

    n_normal = n_entities - n_anomalies
    for i in range(n_normal):
        cat = port_categories[int(rng.integers(0, len(port_categories)))]
        # Normal sizes by category
        if cat in ("web_https", "web_http"):
            bin_, bout = float(rng.lognormal(7, 0.8)), float(rng.lognormal(9, 1.0))
            dur = float(rng.uniform(0.1, 30))
        elif cat in ("db_postgres", "db_mongo"):
            bin_, bout = float(rng.lognormal(6, 0.6)), float(rng.lognormal(8, 0.8))
            dur = float(rng.uniform(0.05, 5))
        elif cat == "ssh":
            bin_, bout = float(rng.lognormal(5, 0.5)), float(rng.lognormal(5, 0.5))
            dur = float(rng.uniform(60, 3600))
        else:  # dns, smb, rdp
            bin_, bout = float(rng.lognormal(4, 0.5)), float(rng.lognormal(4, 0.5))
            dur = float(rng.uniform(0.01, 1))
        name = f"flow_{i:05d}"
        entities.append({
            "name": name,
            "type": "flow",
            "attributes": {
                "src_subnet": src_subnets[int(rng.integers(0, len(src_subnets)))],
                "dst_subnet": dst_subnets[int(rng.integers(0, len(dst_subnets)))],
                "dst_port_category": cat,
                "bytes_in": bin_,
                "bytes_out": bout,
                "duration_s": dur,
                "packet_count": float(rng.integers(2, 1500)),
                "inter_packet_entropy": float(rng.uniform(0.4, 0.95)),
            },
        })

    # C2 beaconing variants (different ports, sizes, intervals) + exfil variants
    beacon_styles = [
        {"port": "exotic_high_port", "bin_lo": 64, "bin_hi": 128, "bout_lo": 64, "bout_hi": 128, "ipe_hi": 0.1, "label": "tiny_steady"},
        {"port": "dns_tunnel", "bin_lo": 200, "bin_hi": 600, "bout_lo": 200, "bout_hi": 600, "ipe_hi": 0.2, "label": "dns_tunnel"},
        {"port": "https_covert", "bin_lo": 1024, "bin_hi": 2048, "bout_lo": 512, "bout_hi": 1024, "ipe_hi": 0.25, "label": "https_covert"},
        {"port": "icmp_data", "bin_lo": 32, "bin_hi": 64, "bout_lo": 32, "bout_hi": 64, "ipe_hi": 0.05, "label": "icmp_data"},
    ]
    exfil_styles = [
        {"port_cat": "web_https", "bin_lo": 50, "bin_hi": 500, "bout_lo": 5_000_000, "bout_hi": 50_000_000, "label": "exfil_medium"},
        {"port_cat": "ssh_tunnel", "bin_lo": 100, "bin_hi": 1000, "bout_lo": 100_000_000, "bout_hi": 500_000_000, "label": "exfil_large"},
        {"port_cat": "smb_exotic", "bin_lo": 200, "bin_hi": 2000, "bout_lo": 1_000_000, "bout_hi": 10_000_000, "label": "exfil_small"},
        {"port_cat": "rdp_anomaly", "bin_lo": 50, "bin_hi": 500, "bout_lo": 500_000_000, "bout_hi": 5_000_000_000, "label": "exfil_massive"},
    ]
    for i in range(n_anomalies):
        kind = "c2_beaconing" if i % 2 == 0 else "asymmetric_exfil"
        name = f"flow_anomaly_{kind}_{i:03d}"
        unique_marker = f"NOVEL_FLOW_{i:03d}"
        if kind == "c2_beaconing":
            s = beacon_styles[i % len(beacon_styles)]
            entities.append({
                "name": name,
                "type": "flow",
                "attributes": {
                    "src_subnet": src_subnets[int(rng.integers(0, len(src_subnets)))],
                    "dst_subnet": f"EXOTIC.{i:03d}.0.0/24",
                    "dst_port_category": s["port"],
                    "bytes_in": float(rng.uniform(s["bin_lo"], s["bin_hi"])),
                    "bytes_out": float(rng.uniform(s["bout_lo"], s["bout_hi"])),
                    "duration_s": float(rng.uniform(0.05, 0.5)),
                    "packet_count": float(rng.integers(2, 12)),
                    "inter_packet_entropy": float(rng.uniform(0.0, s["ipe_hi"])),
                    "style_label": s["label"],
                    "anomaly_marker": unique_marker,
                },
            })
        else:
            s = exfil_styles[i % len(exfil_styles)]
            entities.append({
                "name": name,
                "type": "flow",
                "attributes": {
                    "src_subnet": src_subnets[int(rng.integers(0, len(src_subnets)))],
                    "dst_subnet": dst_subnets[int(rng.integers(0, len(dst_subnets)))],
                    "dst_port_category": s["port_cat"],
                    "bytes_in": float(rng.uniform(s["bin_lo"], s["bin_hi"])),
                    "bytes_out": float(rng.uniform(s["bout_lo"], s["bout_hi"])),
                    "duration_s": float(rng.uniform(60, 7200)),
                    "packet_count": float(rng.integers(1000, 50000)),
                    "inter_packet_entropy": float(rng.uniform(0.6, 0.95)),
                    "style_label": s["label"],
                    "anomaly_marker": unique_marker,
                },
            })
        anomaly_names.add(name)

    edges = []
    return entities, edges, anomaly_names


# ---------------------------------------------------------------------------
# Vertical 8: Logistics / counter-threat finance
# ---------------------------------------------------------------------------
def gen_logistics_finance(n_entities: int = 1800, n_anomalies: int = 36, seed: int = 42):
    """Transactions / shipments. Anomalies = shell-co + layering + triangulation."""
    rng = np.random.default_rng(seed)

    countries_a_pool = ["USA", "GBR", "DEU", "FRA", "JPN", "KOR", "AUS", "CAN", "ITA", "ESP"]
    countries_b_pool = ["MEX", "BRA", "ARG", "CHL", "ZAF", "EGY", "TUR", "IND", "VNM", "PHL"]
    commodity_pool = [f"HS_{i:04d}" for i in range(50)]
    type_pool = ["invoice", "payment", "shipment"]

    entities = []
    anomaly_names = set()

    n_normal = n_entities - n_anomalies
    for i in range(n_normal):
        type_ = type_pool[int(rng.integers(0, len(type_pool)))]
        a = countries_a_pool[int(rng.integers(0, len(countries_a_pool)))]
        b = countries_b_pool[int(rng.integers(0, len(countries_b_pool)))]
        commodity = commodity_pool[int(rng.integers(0, len(commodity_pool)))]
        name = f"txn_{i:05d}"
        entities.append({
            "name": name,
            "type": type_,
            "attributes": {
                "vendor_country": a,
                "dest_country": b,
                "commodity_code": commodity,
                "amount_usd": float(rng.lognormal(11, 1.0)),  # ~$60k median
                "lead_time_days": float(rng.uniform(7, 90)),
                "layering_depth": float(rng.integers(0, 2)),  # 0-1 hops
                "vendor_age_years": float(rng.uniform(2, 30)),
                "intermediary_count": float(rng.integers(0, 2)),
            },
        })

    # Diversified anomaly archetypes for sanctions evasion
    shell_co_jurisdictions = ["OFFSHORE_BVI", "OFFSHORE_CYM", "OFFSHORE_PAN", "OFFSHORE_BLZ", "OFFSHORE_SEY", "OFFSHORE_VCT"]
    sanctioned_proxies = ["SANCTIONED_AAA", "SANCTIONED_BBB", "SANCTIONED_CCC", "SANCTIONED_DDD"]
    triad_hubs_x = ["TRIAD_HUB_HK", "TRIAD_HUB_SG", "TRIAD_HUB_DXB", "TRIAD_HUB_CY", "TRIAD_HUB_LU"]
    triad_hubs_y = ["TRIAD_PROXY_RU", "TRIAD_PROXY_VE", "TRIAD_PROXY_IR", "TRIAD_PROXY_KP", "TRIAD_PROXY_BY"]
    for i in range(n_anomalies):
        kind_idx = i % 3
        kind = ["shell_company", "layering", "triangulation"][kind_idx]
        name = f"txn_anomaly_{kind}_{i:03d}"
        unique_marker = f"NOVEL_TXN_{i:03d}"
        if kind == "shell_company":
            jur = shell_co_jurisdictions[i % len(shell_co_jurisdictions)]
            sanc = sanctioned_proxies[i % len(sanctioned_proxies)]
            entities.append({
                "name": name,
                "type": "payment",
                "attributes": {
                    "vendor_country": jur,
                    "dest_country": sanc,
                    "commodity_code": f"HS_UNKNOWN_{i:03d}",
                    "amount_usd": float(rng.lognormal(13.5 + (i % 3) * 0.5, 0.6)),
                    "lead_time_days": float(rng.uniform(0, 3)),
                    "layering_depth": float(rng.integers(0, 3)),
                    "vendor_age_years": float(rng.uniform(0.0, 0.5)),
                    "intermediary_count": float(rng.integers(0, 3)),
                    "scheme_label": "shell_co",
                    "anomaly_marker": unique_marker,
                },
            })
        elif kind == "layering":
            a = countries_a_pool[int(rng.integers(0, len(countries_a_pool)))]
            b = countries_b_pool[int(rng.integers(0, len(countries_b_pool)))]
            depth = int(rng.integers(5, 12))
            entities.append({
                "name": name,
                "type": "payment",
                "attributes": {
                    "vendor_country": a,
                    "dest_country": b,
                    "commodity_code": commodity_pool[int(rng.integers(0, len(commodity_pool)))],
                    "amount_usd": float(rng.lognormal(11.5 + (i % 4) * 0.3, 0.6)),
                    "lead_time_days": float(rng.uniform(1, 8)),
                    "layering_depth": float(depth),
                    "vendor_age_years": float(rng.uniform(2, 15)),
                    "intermediary_count": float(rng.integers(5, 14)),
                    "scheme_label": f"layer_d{depth}",
                    "anomaly_marker": unique_marker,
                },
            })
        else:  # triangulation
            hx = triad_hubs_x[i % len(triad_hubs_x)]
            hy = triad_hubs_y[i % len(triad_hubs_y)]
            entities.append({
                "name": name,
                "type": "shipment",
                "attributes": {
                    "vendor_country": hx,
                    "dest_country": hy,
                    "commodity_code": f"HS_REROUTE_{i:03d}",
                    "amount_usd": float(rng.lognormal(12.5 + (i % 5) * 0.3, 0.7)),
                    "lead_time_days": float(rng.uniform(20, 240)),
                    "layering_depth": float(rng.integers(2, 7)),
                    "vendor_age_years": float(rng.uniform(0.5, 4)),
                    "intermediary_count": float(rng.integers(3, 9)),
                    "scheme_label": "triad",
                    "anomaly_marker": unique_marker,
                },
            })
        anomaly_names.add(name)

    edges = []
    return entities, edges, anomaly_names


# ---------------------------------------------------------------------------
# Registry
# ---------------------------------------------------------------------------
GENERATORS = {
    "all_source": gen_all_source,
    "sigint_comint": gen_sigint,
    "ew_spectrum": gen_ew,
    "counter_uas_masint": gen_counter_uas,
    "pnt_integrity": gen_pnt,
    "imagery_geospatial": gen_geospatial,
    "network_cyber": gen_network,
    "logistics_finance": gen_logistics_finance,
}

VERTICAL_LABELS = {
    "all_source": "All-source / fused intelligence",
    "sigint_comint": "Signal and communications (SIGINT, COMINT)",
    "ew_spectrum": "Electronic warfare and spectrum management",
    "counter_uas_masint": "Counter-UAS and counter-MASINT signature",
    "pnt_integrity": "PNT integrity",
    "imagery_geospatial": "Imagery and geospatial",
    "network_cyber": "Network and cyber forensics",
    "logistics_finance": "Logistics, force protection, counter-threat finance",
}
