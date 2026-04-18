# D-U-N-C Computer Vision Pipeline — Design Document

**Date:** 2026-04-18
**Status:** Approved
**Owner:** direncode
**Related:** `docs/plans/2026-04-11-dunc-vertical-design.md`, `backend/app/services/dunc/adapters.py`

---

## 1. Context

Big Dunc currently runs on a synthetic simulator — 22 AI-generated digital twins producing fake tracking data. This design replaces the synthetic data with **real computer vision** applied to match video. A camera feed goes in, player positions in pitch coordinates come out — and the entire downstream Dunc system (digital twins, tactical engine, BTUT convergence, WebSocket broadcast, frontend pitch view) works unchanged.

The pipeline: YOLOv8 detection + SigLIP team clustering + ByteTrack persistent IDs + pitch keypoint homography + Voronoi/radar visualization.

## 2. Development Strategy

**Phase 1: Colab notebook** — Build and validate the full pipeline in a free Colab GPU environment. Process pre-recorded match videos, output Dunc-format TrackingFrame JSON, and generate annotated debug video.

**Phase 2: RunPod deployment** — Package the validated pipeline for serverless GPU inference. The backend uploads video, RunPod processes it, returns tracking data.

**Phase 3: Live integration** — Wire the CV output into Dunc's `TrackingAdapter` interface. The tactical engine, digital twins, and frontend all work unchanged.

## 3. Pipeline Architecture

```
VIDEO INPUT (MP4, 25 FPS) → sample every 5th frame (5 FPS effective)
    │
    ▼
STAGE 1: DETECTION — YOLOv8x fine-tuned on Roboflow football dataset
    Classes: player, goalkeeper, referee, ball
    Output: bounding boxes + confidence per frame
    │
    ├──▶ STAGE 2a: TEAM CLUSTERING
    │    Crop each player bbox → SigLIP embedding (768D)
    │    → UMAP (768D → 3D) → KMeans(k=2) → home/away assignment
    │    Run on first N frames to build clusters, then classify per frame
    │
    ├──▶ STAGE 2b: TRACKING — ByteTrack (via supervision)
    │    Persistent player IDs across frames
    │    Handles occlusion, re-identification
    │
    └──▶ STAGE 2c: PITCH KEYPOINTS — YOLOv8x-pose (custom trained)
         32 pitch landmarks (corners, penalty spots, center circle, etc.)
         → OpenCV findHomography → 3x3 transform matrix H
    │
    ▼
STAGE 3: COORDINATE TRANSFORM
    Pixel (u,v) × H⁻¹ → Pitch meters (x,y) on 105m × 68m field
    Velocity = Δposition / Δt between frames
    │
    ▼
STAGE 4: OUTPUT
    ├──▶ TrackingFrame JSON (Dunc adapter format)
    ├──▶ Supervision annotated video (ellipses, radar, Voronoi)
    └──▶ Frontend overlays (Voronoi, radar, trajectories via D3/Canvas)
```

## 4. Models and Dependencies

| Component | Model/Library | Size | Purpose |
|---|---|---|---|
| Player detection | YOLOv8x (fine-tuned) | ~130MB | Detect players/GK/refs/ball |
| Team clustering | SigLIP (siglip-base-patch16-224) | ~400MB | Embed player crops |
| Dim reduction | UMAP | <1MB | Reduce embeddings to 3D |
| Team assignment | KMeans (k=2) | <1MB | Split home/away |
| Pitch keypoints | YOLOv8x-pose (custom) | ~130MB | 32 pitch landmarks |
| Tracking | ByteTrack (supervision) | <1MB | Persistent IDs |
| Homography | OpenCV | included | Pixel → pitch transform |
| Visualization | Supervision | <10MB | Annotated debug output |

Total GPU memory: ~2-3 GB. Fits on a T4 (16GB) with room to spare.

## 5. Output Format

Each processed frame produces a `TrackingFrame` matching `backend/app/services/dunc/adapters.py`:

```python
TrackingFrame(
    t=12.5,  # seconds since kickoff
    ball=BallSample(t=12.5, x=52.3, y=34.1, vx=8.2, vy=-3.1),
    players=[
        TrackingSample(
            t=12.5,
            player_id="track_7",    # ByteTrack persistent ID
            team="home",            # SigLIP clustering
            number=0,               # unknown (jersey OCR = future)
            role="GK",              # from YOLO class (GK vs outfield)
            x=45.2, y=22.8,         # pitch meters via homography
            vx=2.1, vy=-0.5,        # velocity from position delta
        ),
        ...  # 22 players
    ],
)
```

## 6. Frontend Visualization Additions

Beyond the existing PitchView, add three new overlay components rendered in the Next.js frontend using D3.js (already in package.json):

### 6a. Voronoi Overlay
- Compute Voronoi tessellation from player positions (per team)
- Render as semi-transparent colored polygons on the pitch SVG
- Shows territorial control — which team dominates which space
- Toggle on/off via existing OverlayToggles component

### 6b. Radar View
- Mini top-down pitch (200x130px) in corner of the match dashboard
- Dots for all players (colored by team) + ball
- Updates at tick rate — gives overview when main view is zoomed

### 6c. Trajectory Trails
- Last N seconds of movement per player as fading polylines
- Shows running patterns, pressing direction, defensive shape
- Configurable trail length (2s, 5s, 10s)

All three render client-side from the existing WebSocket tick data — no backend changes needed.

## 7. Colab Notebook Structure

```
dunc_cv_pipeline.ipynb

Section 1: Setup
  - Install: ultralytics, supervision, transformers, umap-learn, opencv
  - Mount Google Drive (for video files + model cache)

Section 2: Fine-tune YOLOv8 Detection Model
  - Download Roboflow football-players-detection dataset
  - Fine-tune YOLOv8x for 50 epochs (~30 min on T4)
  - Evaluate mAP on validation set

Section 3: Pitch Keypoint Model
  - Load pre-trained YOLOv8x-pose for 32 pitch landmarks
  - Or train on Roboflow pitch keypoints dataset
  - Validate homography matrix on known pitch dimensions

Section 4: Team Clustering
  - Extract player crops from detection boxes
  - SigLIP embedding → UMAP → KMeans(2)
  - Visualize clusters, verify home/away separation

Section 5: Full Pipeline
  - Process video frame-by-frame:
    1. YOLOv8 detect → boxes
    2. ByteTrack → persistent IDs
    3. SigLIP → team assignment
    4. Pitch keypoints → homography
    5. Transform → pitch coordinates
    6. Compute velocities
  - Output: list of TrackingFrame dicts

Section 6: Export
  - Save TrackingFrame JSON (Dunc-compatible)
  - Generate Supervision annotated video (ellipses + radar + Voronoi)

Section 7: Quality Metrics
  - Detection confidence distribution
  - Tracking consistency (ID switches per minute)
  - Homography reprojection error
  - Player count per frame (should be ~22)
```

## 8. Integration with Dunc

### 8a. New TrackingAdapter

```python
class VideoTrackingAdapter(TrackingAdapter):
    """Adapter that reads pre-computed CV tracking data."""
    name = "video"

    def __init__(self, tracking_json_path: str, hz: float = 5.0):
        self.hz = hz
        self.frames = load_tracking_json(tracking_json_path)

    async def frames(self) -> AsyncIterator[TrackingFrame]:
        for frame in self.frames:
            yield frame
            await asyncio.sleep(1.0 / self.hz)
```

### 8b. MatchRuntime Refactor

Minimal change: accept a `TrackingAdapter` parameter instead of hardcoding `SyntheticAdapter`. The runtime loop calls `adapter.frames()` instead of `simulator.step()`.

### 8c. API Extension

```
POST /api/v1/dunc/matches
  { "source": "video", "tracking_data_url": "s3://...", "hz": 5 }
```

## 9. Cost Analysis

### Colab (Development)
- Free T4 GPU
- ~1 FPS processing
- 90-min match at 5 FPS sampling = ~27,000 frames → ~7.5 hours processing
- Cost: $0

### RunPod (Production)
| GPU | $/hr | Effective FPS | Cost per match (5 FPS sampling) |
|---|---|---|---|
| T4 (16GB) | $0.20 | ~1 | ~$1.50 |
| A40 (48GB) | $0.44 | ~5 | ~$0.10 |
| A100 (80GB) | $1.64 | ~12 | ~$0.05 |

At A40 pricing, processing 100 matches = ~$10.

## 10. Limitations (v0)

- ~1 FPS on T4 (optimize with TensorRT/quantization later)
- No jersey number OCR — players identified by track ID only
- Role is GK vs outfield only (positional inference from patterns = future)
- Single broadcast camera only (no multi-angle stitching)
- Homography assumes flat pitch (no lens distortion correction)
- Team clustering may fail on similar-colored kits (manual override needed)

## 11. Future Upgrades

- TensorRT quantization for real-time inference (~15 FPS on A40)
- Jersey number OCR (PaddleOCR on jersey crop)
- Position role inference from spatial patterns (CB/CM/ST)
- Live RTSP/HLS stream input
- Multi-camera fusion
- Event detection (goals, cards, fouls) from tactical patterns
