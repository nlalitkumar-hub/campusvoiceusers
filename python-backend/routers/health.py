from fastapi import APIRouter

router = APIRouter()


@router.get("/health")
async def health():
    try:
        import torch
        device = "cuda" if torch.cuda.is_available() else "cpu"
    except ImportError:
        device = "cpu (torch not installed)"

    try:
        from services.yolo_service import yolo_service
        yolo_status = "loaded" if yolo_service.model else "not loaded"
    except Exception:
        yolo_status = "unavailable"

    try:
        from services.clip_service import clip_service
        clip_status = "loaded" if clip_service.model else "not loaded"
    except Exception:
        clip_status = "unavailable"

    return {
        "status": "ok",
        "service": "CampusVoice Python AI",
        "port": 8000,
        "models": {
            "yolov8": yolo_status,
            "clip": clip_status,
        },
        "device": device,
    }
