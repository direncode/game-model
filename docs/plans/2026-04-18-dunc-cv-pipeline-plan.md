# D-U-N-C Computer Vision Pipeline — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a Colab notebook that processes football match video into Dunc-compatible TrackingFrame JSON using YOLOv8 detection, SigLIP team clustering, ByteTrack tracking, and pitch homography — then add Voronoi/radar/trajectory overlays to the Next.js frontend.

**Architecture:** Single Colab notebook for the CV pipeline (6 stages: detect → cluster → track → keypoints → transform → export). Output plugs into Dunc's existing TrackingAdapter. Three new frontend overlay components (Voronoi, radar, trajectories) render from existing WebSocket tick data using D3.js.

**Tech Stack:** Python 3.10+, ultralytics (YOLOv8), supervision, transformers (SigLIP), umap-learn, scikit-learn, OpenCV, torch. Frontend: D3.js, React, TypeScript.

---

### Task 1: Create Colab Notebook — Environment Setup

**Files:**
- Create: `cv/dunc_cv_pipeline.ipynb`

**Step 1: Create the notebook with setup cells**

Create `cv/dunc_cv_pipeline.ipynb` with these cells:

**Cell 1 (markdown):**
```markdown
# D-U-N-C Computer Vision Pipeline
## Real match video → tactical tracking data

Pipeline: YOLOv8 detection → SigLIP team clustering → ByteTrack tracking → pitch homography → TrackingFrame JSON

**Output:** Dunc-compatible tracking data for the live tactical dashboard.
```

**Cell 2 (code) — Install dependencies:**
```python
!pip install -q ultralytics supervision transformers umap-learn scikit-learn opencv-python-headless torch torchvision

# Verify GPU
import torch
print(f"GPU: {torch.cuda.get_device_name(0) if torch.cuda.is_available() else 'CPU only'}")
print(f"CUDA available: {torch.cuda.is_available()}")
```

**Cell 3 (code) — Imports:**
```python
import cv2
import numpy as np
import json
import time
from pathlib import Path
from collections import defaultdict

import torch
import supervision as sv
from ultralytics import YOLO
from transformers import AutoProcessor, AutoModel
from sklearn.cluster import KMeans
import umap

# Pitch dimensions (meters)
PITCH_LENGTH = 105.0
PITCH_WIDTH = 68.0
```

**Step 2: Verify notebook runs in Colab**

Upload to Google Drive or open directly. Run cells 1-3.
Expected: GPU detected, all imports succeed.

**Step 3: Commit**

```bash
git add cv/dunc_cv_pipeline.ipynb
git commit -m "feat(cv): create Colab notebook with environment setup"
```

---

### Task 2: YOLOv8 Player Detection — Fine-tuning

**Files:**
- Modify: `cv/dunc_cv_pipeline.ipynb` (append cells)

**Step 1: Add dataset download cell**

**Cell 4 (markdown):**
```markdown
## Stage 1: Player Detection (YOLOv8)
Fine-tune YOLOv8 on the Roboflow football-players-detection dataset.
Classes: player, goalkeeper, referee, ball.
```

**Cell 5 (code) — Download Roboflow dataset:**
```python
# Download football player detection dataset from Roboflow
# Using the public football-players-detection dataset
!pip install -q roboflow

from roboflow import Roboflow

# Public dataset — no API key needed for download
# Alternative: manual download from https://universe.roboflow.com/roboflow-jvuqo/football-players-detection-3zvbc
import os
DATASET_DIR = "/content/football-dataset"

if not os.path.exists(DATASET_DIR):
    rf = Roboflow(api_key="YOUR_ROBOFLOW_API_KEY")  # Free tier key
    project = rf.workspace("roboflow-jvuqo").project("football-players-detection-3zvbc")
    version = project.version(14)
    dataset = version.download("yolov8", location=DATASET_DIR)
    print(f"Dataset downloaded to {DATASET_DIR}")
else:
    print(f"Dataset already exists at {DATASET_DIR}")

# Inspect dataset
!ls {DATASET_DIR}/
!cat {DATASET_DIR}/data.yaml
```

**Cell 6 (code) — Fine-tune YOLOv8:**
```python
# Fine-tune YOLOv8x on football detection dataset
# ~30-45 minutes on Colab T4

model = YOLO("yolov8x.pt")  # Start from pretrained COCO weights

results = model.train(
    data=f"{DATASET_DIR}/data.yaml",
    epochs=50,
    imgsz=1280,
    batch=4,       # T4 can handle batch=4 at 1280
    device=0,
    project="/content/dunc-cv",
    name="detection",
    patience=10,   # Early stopping
    verbose=True,
)

print(f"\nTraining complete!")
print(f"Best mAP@50: {results.results_dict.get('metrics/mAP50(B)', 'N/A')}")
```

**Cell 7 (code) — Load and test detection model:**
```python
# Load the fine-tuned model
DETECTION_MODEL_PATH = "/content/dunc-cv/detection/weights/best.pt"
detector = YOLO(DETECTION_MODEL_PATH)

# Test on a single frame
# Upload a test image or extract from video
TEST_IMAGE = "/content/test_frame.jpg"  # User uploads this

if os.path.exists(TEST_IMAGE):
    result = detector(TEST_IMAGE, conf=0.3)[0]
    detections = sv.Detections.from_ultralytics(result)
    print(f"Detected {len(detections)} objects")
    print(f"Classes: {[result.names[int(c)] for c in detections.class_id]}")

    # Visualize
    annotator = sv.EllipseAnnotator(thickness=2)
    annotated = annotator.annotate(
        scene=cv2.imread(TEST_IMAGE),
        detections=detections,
    )
    sv.plot_image(annotated, size=(12, 8))
else:
    print("Upload a test frame to /content/test_frame.jpg")
```

**Step 2: Run in Colab to validate**

Expected: Model trains, detections visible on test frame with ellipse annotations.

**Step 3: Commit**

```bash
git add cv/dunc_cv_pipeline.ipynb
git commit -m "feat(cv): YOLOv8 player detection fine-tuning"
```

---

### Task 3: Pitch Keypoint Detection + Homography

**Files:**
- Modify: `cv/dunc_cv_pipeline.ipynb` (append cells)

**Step 1: Add pitch keypoint cells**

**Cell 8 (markdown):**
```markdown
## Stage 2: Pitch Keypoint Detection + Homography
Detect 32 pitch landmarks → compute homography matrix → pixel-to-pitch transform.
```

**Cell 9 (code) — Pitch keypoint model:**
```python
# Load pitch keypoint detection model
# Using a pre-trained model for football pitch keypoints
# Roboflow has football-field-detection-f07vi dataset with keypoint annotations

PITCH_MODEL_PATH = "yolov8x-pose.pt"  # Or fine-tuned on pitch keypoints

# For v0: use manual keypoint selection or a simpler approach
# Define the 4 corner mapping for homography
# These are the pitch corners in real-world coordinates (meters)
PITCH_CORNERS_REAL = np.array([
    [0, 0],              # Bottom-left
    [PITCH_LENGTH, 0],   # Bottom-right
    [PITCH_LENGTH, PITCH_WIDTH],  # Top-right
    [0, PITCH_WIDTH],    # Top-left
], dtype=np.float32)

def compute_homography_from_corners(pixel_corners: np.ndarray) -> np.ndarray:
    """
    Compute homography matrix from 4 pitch corner pixel coordinates.

    Args:
        pixel_corners: 4x2 array of corner positions in pixel coords
                       [bottom-left, bottom-right, top-right, top-left]

    Returns:
        3x3 homography matrix H where pitch_coords = H @ pixel_coords
    """
    H, status = cv2.findHomography(pixel_corners, PITCH_CORNERS_REAL)
    if status is None or H is None:
        raise ValueError("Homography computation failed")
    return H


def pixel_to_pitch(points: np.ndarray, H: np.ndarray) -> np.ndarray:
    """
    Transform pixel coordinates to pitch coordinates using homography.

    Args:
        points: Nx2 array of (u, v) pixel coordinates
        H: 3x3 homography matrix

    Returns:
        Nx2 array of (x, y) pitch coordinates in meters
    """
    if len(points) == 0:
        return np.array([]).reshape(0, 2)

    # Convert to homogeneous coordinates
    ones = np.ones((len(points), 1))
    pts_h = np.hstack([points, ones])

    # Apply homography
    transformed = (H @ pts_h.T).T

    # Convert back from homogeneous
    transformed = transformed[:, :2] / transformed[:, 2:3]

    # Clamp to pitch bounds
    transformed[:, 0] = np.clip(transformed[:, 0], 0, PITCH_LENGTH)
    transformed[:, 1] = np.clip(transformed[:, 1], 0, PITCH_WIDTH)

    return transformed


# === Interactive corner selection ===
def select_corners_from_frame(frame):
    """
    For v0: manually select 4 pitch corners in a video frame.
    In Colab, display the frame and input pixel coordinates.
    """
    from IPython.display import display
    import matplotlib.pyplot as plt

    fig, ax = plt.subplots(1, 1, figsize=(16, 9))
    ax.imshow(cv2.cvtColor(frame, cv2.COLOR_BGR2RGB))
    ax.set_title("Click to note corner positions: BL, BR, TR, TL")
    ax.grid(True, alpha=0.3)
    plt.show()

    print("Enter pixel coordinates for 4 pitch corners:")
    print("Order: bottom-left, bottom-right, top-right, top-left")
    corners = []
    for label in ["Bottom-Left", "Bottom-Right", "Top-Right", "Top-Left"]:
        x = float(input(f"  {label} x: "))
        y = float(input(f"  {label} y: "))
        corners.append([x, y])

    return np.array(corners, dtype=np.float32)


print("Homography utilities loaded.")
```

**Cell 10 (code) — Test homography on a frame:**
```python
# Load a frame and compute homography
VIDEO_PATH = "/content/match.mp4"  # User uploads match video

cap = cv2.VideoCapture(VIDEO_PATH)
ret, first_frame = cap.read()
cap.release()

if ret:
    print(f"Frame shape: {first_frame.shape}")

    # Option A: Manual corner selection
    # pixel_corners = select_corners_from_frame(first_frame)

    # Option B: Hardcode corners (replace with your values after visual inspection)
    # These are EXAMPLE values — must be set per video
    pixel_corners = np.array([
        [100, 650],    # Bottom-left corner of pitch
        [1820, 650],   # Bottom-right
        [1500, 200],   # Top-right
        [420, 200],    # Top-left
    ], dtype=np.float32)

    H = compute_homography_from_corners(pixel_corners)
    print(f"Homography matrix:\n{H}")

    # Test: center of pitch in pixels should map to ~(52.5, 34)
    center_pixel = np.array([[960, 425]])  # Approximate center
    center_pitch = pixel_to_pitch(center_pixel, H)
    print(f"Center pixel {center_pixel[0]} → pitch {center_pitch[0]} (should be ~[52.5, 34.0])")
else:
    print("Upload a match video to /content/match.mp4")
```

**Step 2: Validate in Colab**

Expected: Homography matrix computed, center point maps to approximately (52.5, 34.0).

**Step 3: Commit**

```bash
git add cv/dunc_cv_pipeline.ipynb
git commit -m "feat(cv): pitch homography from corner keypoints"
```

---

### Task 4: Team Clustering with SigLIP

**Files:**
- Modify: `cv/dunc_cv_pipeline.ipynb` (append cells)

**Step 1: Add team clustering cells**

**Cell 11 (markdown):**
```markdown
## Stage 3: Team Clustering (SigLIP + UMAP + KMeans)
Crop each detected player → embed with SigLIP → reduce with UMAP → cluster into 2 teams.
```

**Cell 12 (code) — SigLIP embeddings:**
```python
# Load SigLIP model for player crop embeddings
SIGLIP_MODEL = "google/siglip-base-patch16-224"

siglip_processor = AutoProcessor.from_pretrained(SIGLIP_MODEL)
siglip_model = AutoModel.from_pretrained(SIGLIP_MODEL).to("cuda")
siglip_model.eval()

print(f"SigLIP model loaded: {SIGLIP_MODEL}")


def extract_player_crops(frame: np.ndarray, detections: sv.Detections) -> list[np.ndarray]:
    """Extract cropped player images from detection bounding boxes."""
    crops = []
    for xyxy in detections.xyxy:
        x1, y1, x2, y2 = map(int, xyxy)
        # Pad slightly for context
        pad = 5
        x1, y1 = max(0, x1 - pad), max(0, y1 - pad)
        x2, y2 = min(frame.shape[1], x2 + pad), min(frame.shape[0], y2 + pad)
        crop = frame[y1:y2, x1:x2]
        if crop.size > 0:
            crops.append(crop)
    return crops


def embed_crops(crops: list[np.ndarray]) -> np.ndarray:
    """Embed player crops using SigLIP vision encoder."""
    if not crops:
        return np.array([])

    from PIL import Image

    pil_images = [Image.fromarray(cv2.cvtColor(c, cv2.COLOR_BGR2RGB)) for c in crops]

    with torch.no_grad():
        inputs = siglip_processor(images=pil_images, return_tensors="pt", padding=True).to("cuda")
        outputs = siglip_model.get_image_features(**inputs)
        embeddings = outputs.cpu().numpy()

    # L2 normalize
    norms = np.linalg.norm(embeddings, axis=1, keepdims=True)
    embeddings = embeddings / (norms + 1e-8)

    return embeddings


print("SigLIP embedding functions ready.")
```

**Cell 13 (code) — Build team clusters:**
```python
def build_team_clusters(
    video_path: str,
    detector: YOLO,
    n_sample_frames: int = 30,
    skip_frames: int = 75,  # Sample every 3 seconds at 25fps
) -> KMeans:
    """
    Build team clusters from sampled video frames.

    1. Sample N frames from the video
    2. Detect players in each frame
    3. Crop + embed each player
    4. UMAP reduce to 3D
    5. KMeans(k=2) to split teams

    Returns fitted KMeans model for classifying new crops.
    """
    print(f"Building team clusters from {n_sample_frames} frames...")
    cap = cv2.VideoCapture(video_path)
    all_embeddings = []
    frame_idx = 0
    sampled = 0

    while sampled < n_sample_frames:
        ret, frame = cap.read()
        if not ret:
            break
        if frame_idx % skip_frames == 0:
            result = detector(frame, conf=0.3, verbose=False)[0]
            dets = sv.Detections.from_ultralytics(result)

            # Filter to players only (exclude referee, ball)
            player_mask = np.isin(dets.class_id, [0, 1])  # player + goalkeeper
            player_dets = dets[player_mask]

            crops = extract_player_crops(frame, player_dets)
            if crops:
                embs = embed_crops(crops)
                all_embeddings.append(embs)
                sampled += 1
                print(f"  Frame {frame_idx}: {len(crops)} players embedded")

        frame_idx += 1

    cap.release()

    if not all_embeddings:
        raise ValueError("No player embeddings collected")

    all_embs = np.vstack(all_embeddings)
    print(f"Total embeddings: {all_embs.shape[0]}")

    # UMAP reduce 768D → 3D
    reducer = umap.UMAP(n_components=3, random_state=42)
    reduced = reducer.fit_transform(all_embs)

    # KMeans into 2 teams
    kmeans = KMeans(n_clusters=2, random_state=42, n_init=10)
    kmeans.fit(reduced)

    # Store reducer for inference
    kmeans._umap_reducer = reducer
    kmeans._siglip_dim = all_embs.shape[1]

    print(f"Cluster sizes: {np.bincount(kmeans.labels_)}")
    print("Team clustering ready.")

    return kmeans


def classify_team(crops: list[np.ndarray], kmeans: KMeans) -> np.ndarray:
    """Classify player crops into team 0 or team 1."""
    if not crops:
        return np.array([])
    embs = embed_crops(crops)
    reduced = kmeans._umap_reducer.transform(embs)
    labels = kmeans.predict(reduced)
    return labels


# Build clusters
if os.path.exists(VIDEO_PATH):
    team_kmeans = build_team_clusters(VIDEO_PATH, detector, n_sample_frames=20)
else:
    print("Upload match video first")
```

**Step 2: Validate clustering**

Expected: Two roughly equal-sized clusters (~10-11 players each). Visualize with scatter plot to confirm separation.

**Step 3: Commit**

```bash
git add cv/dunc_cv_pipeline.ipynb
git commit -m "feat(cv): SigLIP team clustering with UMAP + KMeans"
```

---

### Task 5: ByteTrack Persistent Tracking

**Files:**
- Modify: `cv/dunc_cv_pipeline.ipynb` (append cells)

**Step 1: Add tracking cell**

**Cell 14 (markdown):**
```markdown
## Stage 4: ByteTrack Persistent Tracking
Assign consistent IDs to players across frames. Handles occlusion and re-identification.
```

**Cell 15 (code) — ByteTrack setup:**
```python
# ByteTrack tracker via supervision
tracker = sv.ByteTrack(
    track_activation_threshold=0.25,
    lost_track_buffer=30,      # Keep lost tracks for 30 frames (1.2s at 25fps)
    minimum_matching_threshold=0.8,
    frame_rate=25,
)

print("ByteTrack tracker initialized.")
print("  - Activation threshold: 0.25")
print("  - Lost track buffer: 30 frames")
print("  - Matching threshold: 0.8")
```

**Step 2: Commit**

```bash
git add cv/dunc_cv_pipeline.ipynb
git commit -m "feat(cv): ByteTrack persistent player tracking"
```

---

### Task 6: Full Pipeline — Frame-by-Frame Processing

**Files:**
- Modify: `cv/dunc_cv_pipeline.ipynb` (append cells)

**Step 1: Add the main pipeline cell**

**Cell 16 (markdown):**
```markdown
## Stage 5: Full Pipeline
Process video frame-by-frame: detect → track → cluster → transform → output.
```

**Cell 17 (code) — Main pipeline:**
```python
def process_video(
    video_path: str,
    detector: YOLO,
    team_kmeans: KMeans,
    H: np.ndarray,
    sample_every: int = 5,  # Process every 5th frame (5 FPS from 25 FPS)
    max_frames: int = None,
) -> list[dict]:
    """
    Full CV pipeline: video → TrackingFrame JSON list.

    Each output frame matches Dunc's TrackingAdapter format:
    {
        "t": float,
        "ball": {"x": float, "y": float, "vx": float, "vy": float},
        "players": [
            {"player_id": str, "team": str, "number": int, "role": str,
             "x": float, "y": float, "vx": float, "vy": float},
            ...
        ]
    }
    """
    cap = cv2.VideoCapture(video_path)
    fps = cap.get(cv2.CAP_PROP_FPS)
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    effective_fps = fps / sample_every

    print(f"Video: {total_frames} frames at {fps:.1f} FPS")
    print(f"Processing every {sample_every}th frame → {effective_fps:.1f} effective FPS")

    tracker.reset()
    tracking_frames = []
    prev_positions = {}  # track_id → (x, y, t) for velocity computation
    frame_idx = 0
    processed = 0
    start_time = time.time()

    while True:
        ret, frame = cap.read()
        if not ret:
            break

        if frame_idx % sample_every != 0:
            frame_idx += 1
            continue

        if max_frames and processed >= max_frames:
            break

        t = frame_idx / fps  # Match clock in seconds

        # 1. Detect
        result = detector(frame, conf=0.3, verbose=False)[0]
        detections = sv.Detections.from_ultralytics(result)

        # 2. Track (assigns persistent IDs)
        detections = tracker.update_with_detections(detections)

        # 3. Separate players and ball
        class_names = [result.names[int(c)] for c in detections.class_id]
        player_mask = np.array([c in ("player", "goalkeeper") for c in class_names])
        ball_mask = np.array([c == "ball" for c in class_names])

        player_dets = detections[player_mask]
        ball_dets = detections[ball_mask]

        # 4. Team clustering for players
        player_crops = extract_player_crops(frame, player_dets)
        if player_crops:
            team_labels = classify_team(player_crops, team_kmeans)
        else:
            team_labels = np.array([])

        # 5. Transform to pitch coordinates
        # Player centers (bottom of bounding box = feet position)
        player_feet = np.array([
            [(xyxy[0] + xyxy[2]) / 2, xyxy[3]]  # center-x, bottom-y
            for xyxy in player_dets.xyxy
        ]) if len(player_dets) > 0 else np.array([]).reshape(0, 2)

        if len(player_feet) > 0:
            player_pitch = pixel_to_pitch(player_feet, H)
        else:
            player_pitch = np.array([]).reshape(0, 2)

        # Ball center
        if len(ball_dets) > 0:
            ball_center = np.array([
                [(ball_dets.xyxy[0][0] + ball_dets.xyxy[0][2]) / 2,
                 (ball_dets.xyxy[0][1] + ball_dets.xyxy[0][3]) / 2]
            ])
            ball_pitch = pixel_to_pitch(ball_center, H)
        else:
            ball_pitch = np.array([[52.5, 34.0]])  # Default center

        # 6. Build TrackingFrame
        players = []
        for i, (xyxy, track_id) in enumerate(zip(
            player_dets.xyxy,
            player_dets.tracker_id if player_dets.tracker_id is not None else range(len(player_dets)),
        )):
            pid = f"track_{int(track_id)}"
            x, y = float(player_pitch[i][0]), float(player_pitch[i][1])

            # Velocity from previous frame
            vx, vy = 0.0, 0.0
            if pid in prev_positions:
                px, py, pt = prev_positions[pid]
                dt = t - pt
                if dt > 0:
                    vx = (x - px) / dt
                    vy = (y - py) / dt
            prev_positions[pid] = (x, y, t)

            # Team assignment
            team = "home" if (i < len(team_labels) and team_labels[i] == 0) else "away"

            # Role from detection class
            cls = class_names[np.where(player_mask)[0][i]] if i < len(class_names) else "player"
            role = "GK" if cls == "goalkeeper" else "outfield"

            players.append({
                "player_id": pid,
                "team": team,
                "number": 0,
                "role": role,
                "x": round(x, 2),
                "y": round(y, 2),
                "vx": round(vx, 2),
                "vy": round(vy, 2),
            })

        # Ball
        bx, by = float(ball_pitch[0][0]), float(ball_pitch[0][1])
        ball_vx, ball_vy = 0.0, 0.0
        if "ball" in prev_positions:
            pbx, pby, pbt = prev_positions["ball"]
            dt = t - pbt
            if dt > 0:
                ball_vx = (bx - pbx) / dt
                ball_vy = (by - pby) / dt
        prev_positions["ball"] = (bx, by, t)

        tracking_frame = {
            "t": round(t, 3),
            "ball": {
                "x": round(bx, 2),
                "y": round(by, 2),
                "vx": round(ball_vx, 2),
                "vy": round(ball_vy, 2),
            },
            "players": players,
        }
        tracking_frames.append(tracking_frame)

        processed += 1
        if processed % 50 == 0:
            elapsed = time.time() - start_time
            fps_actual = processed / elapsed
            print(f"  Processed {processed} frames ({t:.0f}s match time) — {fps_actual:.1f} FPS")

    cap.release()
    elapsed = time.time() - start_time
    print(f"\nDone: {processed} frames in {elapsed:.1f}s ({processed/elapsed:.1f} FPS)")
    print(f"Match time covered: {tracking_frames[-1]['t']:.0f}s")
    print(f"Average players per frame: {np.mean([len(f['players']) for f in tracking_frames]):.1f}")

    return tracking_frames


# === RUN THE PIPELINE ===
if os.path.exists(VIDEO_PATH):
    tracking_data = process_video(
        VIDEO_PATH,
        detector=detector,
        team_kmeans=team_kmeans,
        H=H,
        sample_every=5,
        max_frames=500,  # Limit for testing — remove for full match
    )
    print(f"\nSample frame:")
    print(json.dumps(tracking_data[0], indent=2))
else:
    print("Upload match video to /content/match.mp4")
```

**Step 2: Validate in Colab**

Expected: Pipeline processes frames, prints progress, outputs valid TrackingFrame JSON.

**Step 3: Commit**

```bash
git add cv/dunc_cv_pipeline.ipynb
git commit -m "feat(cv): full frame-by-frame pipeline with TrackingFrame output"
```

---

### Task 7: Export + Supervision Visualization

**Files:**
- Modify: `cv/dunc_cv_pipeline.ipynb` (append cells)

**Step 1: Add export and visualization cells**

**Cell 18 (markdown):**
```markdown
## Stage 6: Export + Visualization
Save TrackingFrame JSON and generate annotated debug video with Supervision.
```

**Cell 19 (code) — Export JSON:**
```python
# Export TrackingFrame JSON (Dunc-compatible format)
OUTPUT_JSON = "/content/dunc_tracking.json"

with open(OUTPUT_JSON, "w") as f:
    json.dump(tracking_data, f)

print(f"Exported {len(tracking_data)} frames to {OUTPUT_JSON}")
print(f"File size: {os.path.getsize(OUTPUT_JSON) / 1024 / 1024:.1f} MB")

# Download link in Colab
from google.colab import files
files.download(OUTPUT_JSON)
```

**Cell 20 (code) — Annotated debug video:**
```python
def generate_annotated_video(
    video_path: str,
    detector: YOLO,
    team_kmeans: KMeans,
    H: np.ndarray,
    output_path: str = "/content/dunc_annotated.mp4",
    max_frames: int = 250,
    sample_every: int = 5,
):
    """
    Generate an annotated video with:
    - Ellipse annotations per player (colored by team)
    - Ball triangle marker
    - Mini radar view (top-down pitch)
    """
    cap = cv2.VideoCapture(video_path)
    fps = cap.get(cv2.CAP_PROP_FPS) / sample_every
    w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))

    fourcc = cv2.VideoWriter_fourcc(*"mp4v")
    out = cv2.VideoWriter(output_path, fourcc, fps, (w, h))

    # Annotators
    ellipse_annotator = sv.EllipseAnnotator(thickness=2)
    triangle_annotator = sv.TriangleAnnotator(base=20, height=15)
    label_annotator = sv.LabelAnnotator(text_scale=0.4, text_padding=4)

    # Team colors
    TEAM_COLORS = {
        0: sv.Color.from_hex("#FF4444"),  # Home = red
        1: sv.Color.from_hex("#4444FF"),  # Away = blue
    }

    tracker.reset()
    frame_idx = 0
    processed = 0

    while processed < max_frames:
        ret, frame = cap.read()
        if not ret:
            break

        if frame_idx % sample_every != 0:
            frame_idx += 1
            continue

        # Detect + track
        result = detector(frame, conf=0.3, verbose=False)[0]
        dets = sv.Detections.from_ultralytics(result)
        dets = tracker.update_with_detections(dets)

        class_names = [result.names[int(c)] for c in dets.class_id]
        player_mask = np.array([c in ("player", "goalkeeper") for c in class_names])
        ball_mask = np.array([c == "ball" for c in class_names])

        player_dets = dets[player_mask]
        ball_dets = dets[ball_mask]

        # Team colors
        if len(player_dets) > 0:
            crops = extract_player_crops(frame, player_dets)
            if crops:
                teams = classify_team(crops, team_kmeans)
                # Set colors based on team
                colors = [TEAM_COLORS.get(t, sv.Color.WHITE) for t in teams]
            else:
                colors = [sv.Color.WHITE] * len(player_dets)

        # Annotate players
        annotated = frame.copy()
        if len(player_dets) > 0:
            annotated = ellipse_annotator.annotate(annotated, player_dets)

            # Labels with track IDs
            labels = [
                f"#{int(tid)}" if tid is not None else "?"
                for tid in (player_dets.tracker_id if player_dets.tracker_id is not None else [None] * len(player_dets))
            ]
            annotated = label_annotator.annotate(annotated, player_dets, labels=labels)

        # Annotate ball
        if len(ball_dets) > 0:
            annotated = triangle_annotator.annotate(annotated, ball_dets)

        # Mini radar view (top-right corner)
        radar_w, radar_h = 210, 136
        radar = np.zeros((radar_h, radar_w, 3), dtype=np.uint8)
        # Draw pitch outline
        cv2.rectangle(radar, (5, 5), (radar_w - 5, radar_h - 5), (40, 40, 40), 1)
        cv2.line(radar, (radar_w // 2, 5), (radar_w // 2, radar_h - 5), (40, 40, 40), 1)
        cv2.circle(radar, (radar_w // 2, radar_h // 2), 15, (40, 40, 40), 1)

        # Plot players on radar
        if len(player_dets) > 0:
            feet = np.array([[(xy[0]+xy[2])/2, xy[3]] for xy in player_dets.xyxy])
            pitch_pos = pixel_to_pitch(feet, H)
            for j, (px, py) in enumerate(pitch_pos):
                rx = int(5 + (px / PITCH_LENGTH) * (radar_w - 10))
                ry = int(5 + (py / PITCH_WIDTH) * (radar_h - 10))
                color = (68, 68, 255) if (j < len(teams) and teams[j] == 0) else (255, 68, 68)
                cv2.circle(radar, (rx, ry), 3, color, -1)

        # Ball on radar
        if len(ball_dets) > 0:
            bc = np.array([[(ball_dets.xyxy[0][0]+ball_dets.xyxy[0][2])/2,
                           (ball_dets.xyxy[0][1]+ball_dets.xyxy[0][3])/2]])
            bp = pixel_to_pitch(bc, H)
            brx = int(5 + (bp[0][0] / PITCH_LENGTH) * (radar_w - 10))
            bry = int(5 + (bp[0][1] / PITCH_WIDTH) * (radar_h - 10))
            cv2.circle(radar, (brx, bry), 4, (255, 255, 255), -1)

        # Overlay radar on frame
        annotated[10:10+radar_h, w-radar_w-10:w-10] = radar

        out.write(annotated)
        processed += 1
        frame_idx += 1

    cap.release()
    out.release()
    print(f"Annotated video saved: {output_path} ({processed} frames)")

    # Download
    files.download(output_path)


# Generate annotated video
if os.path.exists(VIDEO_PATH):
    generate_annotated_video(
        VIDEO_PATH, detector, team_kmeans, H,
        max_frames=250,
    )
```

**Step 2: Commit**

```bash
git add cv/dunc_cv_pipeline.ipynb
git commit -m "feat(cv): JSON export and Supervision annotated video output"
```

---

### Task 8: Quality Metrics Cell

**Files:**
- Modify: `cv/dunc_cv_pipeline.ipynb` (append cell)

**Step 1: Add quality metrics**

**Cell 21 (code):**
```python
# === Quality Metrics ===
import matplotlib.pyplot as plt

# 1. Players per frame
player_counts = [len(f["players"]) for f in tracking_data]
print(f"Players per frame: mean={np.mean(player_counts):.1f}, "
      f"min={min(player_counts)}, max={max(player_counts)}")

# 2. Team balance
home_counts = [sum(1 for p in f["players"] if p["team"] == "home") for f in tracking_data]
away_counts = [sum(1 for p in f["players"] if p["team"] == "away") for f in tracking_data]
print(f"Home team: mean={np.mean(home_counts):.1f} players/frame")
print(f"Away team: mean={np.mean(away_counts):.1f} players/frame")

# 3. Unique track IDs
all_ids = set()
for f in tracking_data:
    for p in f["players"]:
        all_ids.add(p["player_id"])
print(f"Unique track IDs: {len(all_ids)} (ideal: ~22-26)")

# 4. Position coverage
all_x = [p["x"] for f in tracking_data for p in f["players"]]
all_y = [p["y"] for f in tracking_data for p in f["players"]]

fig, axes = plt.subplots(1, 3, figsize=(18, 5))

axes[0].hist(player_counts, bins=20)
axes[0].set_title("Players per frame")
axes[0].axvline(22, color="red", linestyle="--", label="Expected (22)")
axes[0].legend()

axes[1].hist2d(all_x, all_y, bins=30, cmap="YlOrRd")
axes[1].set_title("Position heatmap (pitch coordinates)")
axes[1].set_xlabel("x (m)")
axes[1].set_ylabel("y (m)")
axes[1].set_xlim(0, 105)
axes[1].set_ylim(0, 68)

axes[2].plot(home_counts, label="Home", alpha=0.7)
axes[2].plot(away_counts, label="Away", alpha=0.7)
axes[2].set_title("Team player count over time")
axes[2].legend()

plt.tight_layout()
plt.show()
```

**Step 2: Commit**

```bash
git add cv/dunc_cv_pipeline.ipynb
git commit -m "feat(cv): quality metrics and validation plots"
```

---

### Task 9: Frontend — Voronoi Overlay Component

**Files:**
- Create: `frontend/components/dunc/overlays/VoronoiOverlay.tsx`

**Step 1: Create the Voronoi overlay**

```tsx
"use client";

import { useMemo } from "react";
import { Delaunay } from "d3-delaunay";
import type { DuncPlayerTick } from "@/lib/dunc/types";
import { PITCH_X, PITCH_Y } from "@/lib/dunc/types";

interface Props {
  players: DuncPlayerTick[];
  width: number;
  height: number;
  team: "home" | "away" | "both";
  opacity?: number;
}

export function VoronoiOverlay({ players, width, height, team, opacity = 0.08 }: Props) {
  const paths = useMemo(() => {
    const filtered = team === "both"
      ? players
      : players.filter((p) => p.team === team);

    if (filtered.length < 3) return [];

    const scaleX = width / PITCH_X;
    const scaleY = height / PITCH_Y;

    const points = filtered.map((p) => [p.x * scaleX, p.y * scaleY] as [number, number]);
    const delaunay = Delaunay.from(points);
    const voronoi = delaunay.voronoi([0, 0, width, height]);

    return filtered.map((p, i) => ({
      path: voronoi.renderCell(i),
      team: p.team,
    }));
  }, [players, width, height, team]);

  return (
    <g className="voronoi-overlay">
      {paths.map((cell, i) => (
        <path
          key={i}
          d={cell.path}
          fill={cell.team === "home" ? "rgba(0,212,255,0.08)" : "rgba(248,81,73,0.08)"}
          stroke={cell.team === "home" ? "rgba(0,212,255,0.15)" : "rgba(248,81,73,0.15)"}
          strokeWidth={0.5}
          style={{ opacity }}
        />
      ))}
    </g>
  );
}
```

**Step 2: Typecheck**

Run: `cd frontend && npx tsc --noEmit`

**Step 3: Commit**

```bash
git add frontend/components/dunc/overlays/VoronoiOverlay.tsx
git commit -m "feat(dunc): Voronoi territorial control overlay"
```

---

### Task 10: Frontend — Radar Mini-Map Component

**Files:**
- Create: `frontend/components/dunc/overlays/RadarMiniMap.tsx`

**Step 1: Create the radar component**

```tsx
"use client";

import type { DuncPlayerTick, DuncBallTick } from "@/lib/dunc/types";
import { PITCH_X, PITCH_Y } from "@/lib/dunc/types";

interface Props {
  players: DuncPlayerTick[];
  ball: DuncBallTick;
  width?: number;
  height?: number;
}

export function RadarMiniMap({ players, ball, width = 200, height = 130 }: Props) {
  const scaleX = (v: number) => 4 + (v / PITCH_X) * (width - 8);
  const scaleY = (v: number) => 4 + (v / PITCH_Y) * (height - 8);

  return (
    <div
      className="border border-white/10 rounded bg-black/80 backdrop-blur-sm overflow-hidden"
      style={{ width, height }}
    >
      <svg width={width} height={height}>
        {/* Pitch outline */}
        <rect x={4} y={4} width={width - 8} height={height - 8} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth={0.5} />
        <line x1={width / 2} y1={4} x2={width / 2} y2={height - 4} stroke="rgba(255,255,255,0.08)" strokeWidth={0.5} />
        <circle cx={width / 2} cy={height / 2} r={12} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={0.5} />

        {/* Players */}
        {players.map((p) => (
          <circle
            key={p.id}
            cx={scaleX(p.x)}
            cy={scaleY(p.y)}
            r={2.5}
            fill={p.team === "home" ? "#00d4ff" : "#f85149"}
            opacity={0.9}
          />
        ))}

        {/* Ball */}
        <circle cx={scaleX(ball.x)} cy={scaleY(ball.y)} r={3} fill="#ffffff" />
      </svg>
    </div>
  );
}
```

**Step 2: Typecheck**

Run: `cd frontend && npx tsc --noEmit`

**Step 3: Commit**

```bash
git add frontend/components/dunc/overlays/RadarMiniMap.tsx
git commit -m "feat(dunc): radar mini-map component"
```

---

### Task 11: Frontend — Trajectory Trails Overlay

**Files:**
- Create: `frontend/components/dunc/overlays/TrajectoryTrails.tsx`

**Step 1: Create trajectory overlay**

```tsx
"use client";

import { useMemo } from "react";
import type { DuncPlayerTick } from "@/lib/dunc/types";
import { PITCH_X, PITCH_Y } from "@/lib/dunc/types";

interface Props {
  /** History buffer: array of player arrays from recent ticks */
  history: DuncPlayerTick[][];
  width: number;
  height: number;
  maxTrailLength?: number;
  team?: "home" | "away" | "both";
}

export function TrajectoryTrails({ history, width, height, maxTrailLength = 30, team = "both" }: Props) {
  const trails = useMemo(() => {
    const scaleX = width / PITCH_X;
    const scaleY = height / PITCH_Y;

    // Build per-player trail from history
    const playerTrails: Record<string, { points: string; team: string }> = {};
    const recent = history.slice(-maxTrailLength);

    for (const tick of recent) {
      for (const p of tick) {
        if (team !== "both" && p.team !== team) continue;
        if (!playerTrails[p.id]) {
          playerTrails[p.id] = { points: "", team: p.team };
        }
        const px = p.x * scaleX;
        const py = p.y * scaleY;
        playerTrails[p.id].points += `${px},${py} `;
      }
    }

    return Object.entries(playerTrails)
      .filter(([, trail]) => trail.points.trim().includes(" "))
      .map(([id, trail]) => ({
        id,
        points: trail.points.trim(),
        team: trail.team,
      }));
  }, [history, width, height, maxTrailLength, team]);

  return (
    <g className="trajectory-trails">
      {trails.map((trail) => (
        <polyline
          key={trail.id}
          points={trail.points}
          fill="none"
          stroke={trail.team === "home" ? "rgba(0,212,255,0.3)" : "rgba(248,81,73,0.3)"}
          strokeWidth={1}
          strokeLinecap="round"
        />
      ))}
    </g>
  );
}
```

**Step 2: Typecheck**

Run: `cd frontend && npx tsc --noEmit`

**Step 3: Commit**

```bash
git add frontend/components/dunc/overlays/TrajectoryTrails.tsx
git commit -m "feat(dunc): trajectory trails overlay"
```

---

### Task 12: Wire Overlays into PitchView + Deploy

**Files:**
- Modify: `frontend/components/dunc/OverlayToggles.tsx` (add Voronoi/Radar/Trails toggles)
- Modify: `frontend/components/dunc/PitchView.tsx` (render new overlays when toggled)

**Step 1: Add toggle options**

Read `frontend/components/dunc/OverlayToggles.tsx` and add three new toggle entries: "Voronoi", "Radar", "Trails". Follow the existing pattern for how toggles are structured.

**Step 2: Import and render overlays in PitchView**

Read `frontend/components/dunc/PitchView.tsx` and add conditional rendering for the three new overlay components when their toggles are active.

**Step 3: Typecheck**

Run: `cd frontend && npx tsc --noEmit`

**Step 4: Commit**

```bash
git add frontend/components/dunc/OverlayToggles.tsx frontend/components/dunc/PitchView.tsx
git commit -m "feat(dunc): wire Voronoi, radar, and trajectory overlays into pitch view"
```

**Step 5: Push and deploy**

```bash
git push origin feat/dunc-prediction-engine
ssh -i ... ubuntu@32.192.140.145 "cd /opt/latentocean && git pull origin feat/dunc-prediction-engine"
# Frontend uses volume mounts + dev mode, so HMR picks up changes automatically
```
