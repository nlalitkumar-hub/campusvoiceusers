import os, re, json
import requests as http_requests
from fastapi import APIRouter, HTTPException
from models.schemas import VerifyRequest, VerifyResponse, FinalVerifyRequest, FinalVerifyResponse
from services.roboflow_service import final_verification, ROBOFLOW_API_KEY

router = APIRouter(prefix="/api")
ROBOFLOW_INLINE_URL = "https://serverless.roboflow.com/infer/workflows"

PRIVACY_MODEL    = os.getenv("PRIVACY_MODEL",    "person-detection-9a6mk/16")
COCO_MODEL       = "coco/14"
FURNITURE_MODEL  = os.getenv("FURNITURE_MODEL",  "furniture-detection-qiufc/20")
POTHOLE_MODEL    = os.getenv("POTHOLE_MODEL",    "pothole-voxrl/1")
ELECTRICAL_MODEL = os.getenv("ELECTRICAL_MODEL", "electrical-appliance/2")

CLIP_ACCEPT = 0.25   # score > 0.25 = ACCEPT
CLIP_REVIEW = 0.22   # 0.22-0.25 = LOW_CONFIDENCE (flag for review)
# score <= 0.22 = REJECT

# CLIP-only fallback threshold — 0.25 strict match required
CLIP_ONLY_ACCEPT = 0.25
COCO_CAMPUS_CLASSES = {
    "chair","couch","sofa","bench","dining table","table","desk","bed",
    "toilet","sink","refrigerator","oven","microwave","tv","laptop",
    "monitor","keyboard","mouse","cell phone","book","clock","vase",
    "scissors","bottle","cup","potted plant","backpack","handbag",
    "suitcase","door","window","cabinet","shelf","bookshelf",
    "fire hydrant","stop sign","parking meter",
    # Campus-specific additions
    "bin","trash can","dustbin","waste bin","garbage bin","bowl",
    "water cooler","dispenser","water dispenser",
    "socket","switch","electrical panel","power outlet",
    "fan","ac","air conditioner","light","bulb",
    "pipe","tap","faucet","drain","spoon","fork",
}

CATEGORY_MODEL_MAP = {
    "infrastructure": FURNITURE_MODEL, "safety": POTHOLE_MODEL,
    "roads": POTHOLE_MODEL, "roads/safety": POTHOLE_MODEL,
    "technology": ELECTRICAL_MODEL, "electrical": ELECTRICAL_MODEL,
    "electrical/appliances": ELECTRICAL_MODEL, "academic": FURNITURE_MODEL,
    "health": FURNITURE_MODEL, "hygiene": FURNITURE_MODEL, "other": FURNITURE_MODEL,
}
CATEGORY_LABELS = {
    FURNITURE_MODEL:  "infrastructure or furniture",
    POTHOLE_MODEL:    "road damage or safety hazards",
    ELECTRICAL_MODEL: "electrical appliances or wiring",
}

def _detect_spec(model_id):
    return {"version":"1.0","inputs":[{"type":"InferenceImage","name":"image"}],
            "steps":[{"type":"roboflow_core/roboflow_object_detection_model@v1",
                      "name":"det","images":chr(36)+"inputs.image","model_id":model_id}],
            "outputs":[{"type":"JsonField","name":"predictions","selector":chr(36)+"steps.det.predictions"}]}

def _visualize_spec(model_id):
    return {"version":"1.0","inputs":[{"type":"InferenceImage","name":"image"}],
            "steps":[
                {"type":"roboflow_core/roboflow_object_detection_model@v1","name":"det",
                 "images":chr(36)+"inputs.image","model_id":model_id},
                {"type":"roboflow_core/bounding_box_visualization@v1","name":"viz",
                 "image":chr(36)+"inputs.image","predictions":chr(36)+"steps.det.predictions"},
                {"type":"roboflow_core/label_visualization@v1","name":"lbl",
                 "image":chr(36)+"steps.viz.image","predictions":chr(36)+"steps.det.predictions",
                 "text":"Class and Confidence"}
            ],
            "outputs":[
                {"type":"JsonField","name":"predictions","selector":chr(36)+"steps.det.predictions"},
                {"type":"JsonField","name":"visualization","selector":chr(36)+"steps.lbl.image"}
            ]}

CLIP_SPEC = {
    "version":"1.0",
    "inputs":[{"type":"InferenceImage","name":"image"},
              {"type":"InferenceParameter","name":"description"}],
    "steps":[
        {"type":"roboflow_core/clip@v1","name":"img_emb","data":chr(36)+"inputs.image"},
        {"type":"roboflow_core/clip@v1","name":"txt_emb","data":chr(36)+"inputs.description"},
        {"type":"roboflow_core/cosine_similarity@v1","name":"sim",
         "embedding_1":chr(36)+"steps.img_emb.embedding",
         "embedding_2":chr(36)+"steps.txt_emb.embedding"}
    ],
    "outputs":[{"type":"JsonField","name":"similarity_score","selector":chr(36)+"steps.sim.similarity"}]
}

def _run(b64, spec, extra=None):
    inputs = {"image":{"type":"base64","value":b64}}
    if extra: inputs.update(extra)
    try:
        r = http_requests.post(ROBOFLOW_INLINE_URL,
            json={"api_key":ROBOFLOW_API_KEY,"specification":spec,"inputs":inputs}, timeout=25)
        if not r.ok: print(f"  API {r.status_code}: {r.text[:80]}"); return {}
        return (r.json().get("outputs") or [{}])[0]
    except Exception as e:
        print(f"  API exception: {e}"); return {}

def _preds(out):
    p = out.get("predictions") or {}
    return p.get("predictions",[]) if isinstance(p,dict) else []

def _person_ratio(preds):
    persons = [p for p in preds if p.get("class","").lower()=="person"]
    if not persons: return 0.0
    w = preds[0].get("image_dimensions",{}).get("width") or 640
    h = preds[0].get("image_dimensions",{}).get("height") or 480
    area = w*h
    return max((p.get("width",0)*p.get("height",0))/area for p in persons) if area else 0.0

def _is_gibberish(text):
    text = text.strip()
    if len(text) < 15: return True          # too short
    words = re.findall(r'[a-zA-Z]{3,}', text)
    if len(words) < 3: return True          # need at least 3 real words
    def real(w):
        w = w.lower()
        if not re.search(r'[aeiou]', w): return False
        max_c = max((len(m.group()) for m in re.finditer(r'[^aeiou]+', w)), default=0)
        if max_c >= 4: return False
        if len(w) >= 6 and w[:len(w)//2] == w[len(w)//2:]: return False
        return True
    return sum(1 for w in words if real(w)) < 2

@router.post("/verify-image", response_model=VerifyResponse)
async def verify_image(request: VerifyRequest):
    category = (request.category or "Infrastructure").strip().lower()
    desc = request.description.strip()
    print(f"\n{'='*55}\nTRIAGE v10 | category={category}\ndesc: {desc[:70]}\n{'='*55}")

    b64 = request.imageBase64.split(",")[1] if "," in request.imageBase64 else request.imageBase64

    # Gate 0: Gibberish
    if _is_gibberish(desc):
        print("[0] REJECTED gibberish")
        raise HTTPException(status_code=400, detail={
            "error":"Invalid Description",
            "message":"Description is invalid or meaningless. Please describe the actual issue clearly."})

    # Gate 1: Privacy — primary model
    print("[1] Privacy Gate")
    p_preds = _preds(_run(b64, _detect_spec(PRIVACY_MODEL)))
    persons = [p for p in p_preds if p.get("class","").lower()=="person" and p.get("confidence",0)>0.4]
    blocked = len(persons) > 0

    # Gate 1b: COCO fallback person detection
    coco_preds = _preds(_run(b64, _detect_spec(COCO_MODEL)))
    if not blocked:
        coco_p = [p for p in coco_preds if p.get("class","").lower()=="person" and p.get("confidence",0)>0.4]
        ratio = _person_ratio(coco_preds)
        print(f"    COCO persons={len(coco_p)} ratio={ratio:.3f}")
        blocked = len(coco_p) > 0 and (ratio > 0.25 or max((p.get("confidence",0) for p in coco_p), default=0) > 0.6)

    if blocked:
        print("[1] REJECTED privacy")
        raise HTTPException(status_code=400, detail={
            "error":"Privacy Violation",
            "message":"Privacy Violation: Please remove people from the frame."})

    # Gate 2: Smart Router — specialist model
    specialist = CATEGORY_MODEL_MAP.get(category, FURNITURE_MODEL)
    cat_label  = CATEGORY_LABELS.get(specialist, "relevant issues")
    print(f"[2] Specialist: {specialist}")
    s_out   = _run(b64, _visualize_spec(specialist))
    s_preds = _preds(s_out)
    viz     = s_out.get("visualization")
    print(f"    specialist: {[p.get('class') for p in s_preds]}")

    # Gate 2b: COCO fallback for Infrastructure/Hygiene/Health/Academic/Other
    final_preds = s_preds
    used_coco = False
    if not s_preds and specialist == FURNITURE_MODEL:
        coco_campus = [p for p in coco_preds
                       if p.get("class","").lower() in COCO_CAMPUS_CLASSES
                       and p.get("confidence",0) > 0.35]
        print(f"    COCO fallback: {[p.get('class') for p in coco_campus]}")
        if coco_campus:
            final_preds = coco_campus
            used_coco = True

    # Gate 4: CLIP semantic cross-verification
    # Run CLIP regardless — used both for validation and as final fallback
    print("[4] CLIP semantic check")
    clip_out   = _run(b64, CLIP_SPEC, extra={"description": desc})
    clip_score = clip_out.get("similarity_score")
    if clip_score is None:
        clip_score = 0.0; clip_verdict = "SKIP"
    else:
        clip_score = round(float(clip_score), 4)
        clip_verdict = "ACCEPT" if clip_score > CLIP_ACCEPT else "LOW_CONFIDENCE" if clip_score > CLIP_REVIEW else "REJECT"
    print(f"    score={clip_score} verdict={clip_verdict}")

    # Gate 3: Validation — no objects detected AND CLIP also low = reject
    # If CLIP score is high enough, accept even without object detection
    # (covers: electrical sockets, water coolers, dustbins, etc.)
    if not final_preds:
        if clip_score >= CLIP_ONLY_ACCEPT:
            # CLIP-only pass — image is semantically related to description
            print(f"[3] CLIP-only PASS (score={clip_score}, no model detections)")
            final_preds = [{"class": "campus object", "confidence": clip_score}]
            used_coco = True
        else:
            print("[3] REJECTED no objects + low CLIP")
            raise HTTPException(status_code=400, detail={
                "error":"Irrelevant Image",
                "message":f"Irrelevant Image: No {cat_label} issues detected. Please upload a clear photo of the problem.",
                "category":category})

    # Gate 4b: CLIP reject — enforce for ALL cases when score is below threshold
    # This catches description mismatches even when COCO fallback found objects
    if clip_verdict == "REJECT":
        detected_label = final_preds[0].get("class","object") if final_preds else "object"
        short_desc = desc[:40] + ("..." if len(desc)>40 else "")
        raise HTTPException(status_code=400, detail={
            "error":"Description Mismatch",
            "message":(f"Rejection: Your description ('{short_desc}') does not match "
                       f"the image. Please ensure the photo clearly shows the issue described."),
            "clip_score":clip_score})

    # Build response
    classes = [p.get("class","") for p in final_preds]
    confs   = [p.get("confidence",0) for p in final_preds]
    avg_c   = round(sum(confs)/len(confs), 3)
    top_c   = round(max(confs), 3)

    viz_url = None
    if viz and not used_coco:
        vb = viz.get("value") or viz.get("data") or "" if isinstance(viz,dict) else str(viz)
        if vb: viz_url = f"data:image/jpeg;base64,{vb}"

    needs_review = clip_verdict == "LOW_CONFIDENCE"
    source = "COCO/CLIP" if used_coco else specialist.split("/")[0]
    reason = (f"Verified: {', '.join(classes[:4])} detected "
              f"({len(final_preds)} object{'s' if len(final_preds)>1 else ''}, "
              f"avg confidence {avg_c:.0%}). CLIP score: {clip_score:.3f}"
              + (" [Flagged for review]" if needs_review else ""))
    print(f"[OK] {reason}")

    return VerifyResponse(
        overallVerified=True, campusDetected=True, descriptionMatches=True, isReal=True,
        yoloResults={"specialist_model":source,"category":category,
                     "detections":classes,"total_objects":len(final_preds),"avg_confidence":avg_c},
        clipResults={"similarity_score":clip_score,"matches":True,"confidence":clip_verdict},
        reason=reason, score=avg_c,
        status="LOW_CONFIDENCE" if needs_review else "VERIFIED",
        detected_objects=classes, confidence=avg_c,
        verification_image_url=viz_url, specialist_model=source)

@router.post("/verify-campus")
async def verify_campus_only(request: VerifyRequest):
    try:
        b64 = request.imageBase64.split(",")[1] if "," in request.imageBase64 else request.imageBase64
        preds = _preds(_run(b64, _detect_spec(FURNITURE_MODEL)))
        return {"success":True,"data":{"detections":preds,"count":len(preds)}}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/verify-resolution", response_model=FinalVerifyResponse)
async def verify_resolution(request: FinalVerifyRequest):
    try:
        result = final_verification(request.before_url, request.after_url)
        return FinalVerifyResponse(**result)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))