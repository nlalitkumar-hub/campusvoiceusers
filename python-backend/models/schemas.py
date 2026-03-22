from pydantic import BaseModel
from typing import Optional, List


class VerifyRequest(BaseModel):
    imageBase64: str
    description: str
    location: Optional[str] = None


class DetectedObject(BaseModel):
    object: str
    confidence: float


class YOLOResult(BaseModel):
    detected_objects: List[DetectedObject]
    campus_objects_found: List[str]
    is_campus_scene: bool
    confidence: float
    total_objects: int
    error: Optional[str] = None


class CLIPResult(BaseModel):
    similarity_score: float
    matches: bool
    confidence: str
    description_relevance: float
    error: Optional[str] = None


class VerifyResponse(BaseModel):
    overallVerified: bool
    campusDetected: bool
    descriptionMatches: bool
    isReal: bool
    yoloResults: dict
    clipResults: dict
    reason: str
    score: float
