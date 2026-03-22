from fastapi import APIRouter, HTTPException
from models.schemas import VerifyRequest, VerifyResponse
from services.yolo_service import yolo_service
from services.clip_service import clip_service

router = APIRouter(prefix="/api")


@router.post("/verify-image", response_model=VerifyResponse)
async def verify_image(request: VerifyRequest):
    try:
        print(f"\n{'='*50}")
        print(f"VERIFYING IMAGE")
        print(f"Description: {request.description}")
        print(f"{'='*50}")

        # Step 1: Run YOLOv8 detection
        yolo = yolo_service.detect(request.imageBase64)

        # Step 2: Check if human image (YOLO only — stricter detection)
        is_human = yolo.get("is_human_image", False)

        print(f"Is human (YOLO): {is_human}")

        # Return immediately with specific error for human images
        if is_human:
            return VerifyResponse(
                overallVerified=False,
                campusDetected=False,
                descriptionMatches=False,
                isReal=True,
                yoloResults=yolo,
                clipResults={"similarity_score": 0.0, "matches": False, "confidence": "low", "is_human": True},
                reason="IMAGE_OF_HUMAN",
                score=0.0,
            )

        # Step 3: Campus detection
        non_person = yolo.get("non_person_objects", [])
        is_campus_scene = yolo.get("is_campus_scene", False)
        avg_conf = yolo.get("confidence", 0)
        campus_detected = is_campus_scene and len(non_person) >= 1 and avg_conf >= 0.35

        print(f"Campus detected: {campus_detected}")

        # Step 4: CLIP similarity
        clip_result = clip_service.compute_similarity(request.imageBase64, request.description)
        description_matches = clip_result.get("matches", False)

        # Step 5: Image authenticity
        total_objects = yolo.get("total_objects", 0)
        is_real = total_objects > 0

        score = (
            0.4 * float(campus_detected)
            + 0.4 * float(description_matches)
            + 0.2 * float(is_real)
        )

        overall = (
            campus_detected
            and description_matches
            and is_real
            and score >= 0.8
        )

        print(f"Description matches: {description_matches}")
        print(f"Is real: {is_real}")
        print(f"Score: {score:.3f}")
        print(f"Overall: {overall}")

        # Build reason message
        parts = []
        if not campus_detected:
            if len(non_person) == 0:
                parts.append("No campus objects or infrastructure detected in the image")
            else:
                parts.append("Image does not clearly show a campus location or problem")
        else:
            parts.append(f"Campus confirmed: {', '.join(non_person[:3])}")

        if not description_matches:
            parts.append(
                "Description does not match what is visible in the image. "
                "Please take a photo of the actual problem"
            )
        else:
            conf = clip_result.get("confidence", "medium")
            parts.append(f"Description matches image ({conf} confidence)")

        if not is_real:
            parts.append("Image appears to be empty or unrecognizable")

        return VerifyResponse(
            overallVerified=overall,
            campusDetected=campus_detected,
            descriptionMatches=description_matches,
            isReal=is_real,
            yoloResults=yolo,
            clipResults=clip_result,
            reason=". ".join(parts),
            score=round(score, 3),
        )
    except Exception as e:
        print(f"Verification error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/verify-campus")
async def verify_campus_only(request: VerifyRequest):
    try:
        result = yolo_service.detect(request.imageBase64)
        return {"success": True, "data": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
