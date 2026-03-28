from pydantic import BaseModel
from typing import Optional, List


class VerifyRequest(BaseModel):
    imageBase64: str
    description: str
    category: Optional[str] = "Infrastructure"
    location: Optional[str] = None


class FinalVerifyRequest(BaseModel):
    before_url: str   # Cloudinary URL of student's original complaint photo
    after_url: str    # Cloudinary URL of authority's resolution photo
    complaint_id: Optional[str] = None


class FinalVerifyResponse(BaseModel):
    status: str       # "MATCHED", "NOT_MATCHED", "UNCERTAIN"
    score: float
    action: Optional[str] = None   # "trigger_claude" when uncertain
    message: str


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
    # Triage fields
    status: Optional[str] = None
    detected_objects: Optional[List[str]] = None
    confidence: Optional[float] = None
    verification_image_url: Optional[str] = None
    specialist_model: Optional[str] = None
