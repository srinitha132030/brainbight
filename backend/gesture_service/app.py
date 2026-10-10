"""Optional, local hand-landmark demo. Models remain opt-in and locally supplied."""
import os
from io import BytesIO
from pathlib import Path

from fastapi import FastAPI, File, HTTPException, UploadFile
from PIL import Image

app = FastAPI(title="Brainbight gesture service", version="0.1.0")
MODEL = Path(os.environ["BRAINBIGHT_HAND_MODEL"]) if os.getenv("BRAINBIGHT_HAND_MODEL") else None
_landmarker = None


def get_landmarker():
    global _landmarker
    if not MODEL or not MODEL.is_file():
        return None
    if _landmarker is None:
        try:
            import mediapipe as mp
            options = mp.tasks.vision.HandLandmarkerOptions(
                base_options=mp.tasks.BaseOptions(model_asset_path=str(MODEL)),
                running_mode=mp.tasks.vision.RunningMode.IMAGE,
                num_hands=1,
            )
            _landmarker = mp.tasks.vision.HandLandmarker.create_from_options(options)
        except (ImportError, AttributeError, RuntimeError, ValueError):
            return None
    return _landmarker


@app.get("/health")
def health():
    return {"service": "brainbight-gesture-service", "status": "ready" if get_landmarker() else "model_not_configured"}


@app.post("/analyze")
async def analyze(image: UploadFile = File(...)):
    landmarker = get_landmarker()
    if landmarker is None:
        raise HTTPException(status_code=503, detail="Install the requirements and set BRAINBIGHT_HAND_MODEL to a compatible, locally supplied MediaPipe hand-landmarker .task file.")
    if image.content_type not in {"image/jpeg", "image/png", "image/webp"}:
        raise HTTPException(status_code=415, detail="Upload a JPEG, PNG, or WebP image.")
    data = await image.read(4_000_001)
    if len(data) > 4_000_000:
        raise HTTPException(status_code=413, detail="Image must be 4 MB or smaller.")
    try:
        import mediapipe as mp
        with Image.open(BytesIO(data)) as source:
            rgb = source.convert("RGB")
            if rgb.width * rgb.height > 16_000_000:
                raise HTTPException(status_code=413, detail="Image resolution must be 16 megapixels or smaller.")
            mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=__import__("numpy").array(rgb))
            result = landmarker.detect(mp_image)
        if not result.hand_landmarks:
            return {"detected": False, "gesture": "none", "message": "No hand detected."}
        points = result.hand_landmarks[0]
        wrist, middle_tip, index_tip, thumb_tip = points[0], points[12], points[8], points[4]
        extended = middle_tip.y < wrist.y - 0.08
        index_up = index_tip.y < wrist.y - 0.08
        thumb_left = thumb_tip.x < points[2].x - 0.09
        gesture = "scroll_up" if extended and not index_up else "scroll_down" if extended and index_up else "swipe_left" if thumb_left else "none"
        return {"detected": True, "gesture": gesture, "message": "Hand landmark detected."}
    except HTTPException:
        raise
    except Exception as error:
        raise HTTPException(status_code=400, detail="The image could not be analyzed.") from error
