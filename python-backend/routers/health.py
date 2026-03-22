from fastapi import APIRouter
import torch

router = APIRouter()


@router.get("/health")
async def health():
    from services.yolo_service import yolo_service
    from services.clip_service import clip_service
    return {
        "status": "ok",
        "service": "CampusVoice Python AI",
        "port": 8000,
        "models": {
            "yolov8": "loaded" if yolo_service.model else "not loaded",
            "clip": "loaded" if clip_service.model else "not loaded",
        },
        "device": "cuda" if torch.cuda.is_available() else "cpu",
    }
