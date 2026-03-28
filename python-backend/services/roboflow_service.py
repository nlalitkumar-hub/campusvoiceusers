import os
import requests
import base64
from typing import Dict, Any

from dotenv import load_dotenv
load_dotenv()

ROBOFLOW_API_KEY = os.getenv("ROBOFLOW_API_KEY", "")

MATCH_THRESHOLD     = 0.85
UNCERTAIN_THRESHOLD = 0.78   # raised from 0.60 — evaluation showed different scenes score ~0.77

# Inline workflow spec — no broken classification model
# Runs CLIP cosine similarity + object detection directly
WORKFLOW_SPEC = {
    "version": "1.0",
    "inputs": [
        {"type": "InferenceImage", "name": "image"},
        {"type": "InferenceImage", "name": "before_image"}
    ],
    "steps": [
        {
            "type": "roboflow_core/roboflow_object_detection_model@v1",
            "name": "detection_model",
            "images": "$inputs.image",
            "model_id": "furniture-detection-qiufc/20"
        },
        {
            "type": "roboflow_core/clip@v1",
            "name": "before_embedding",
            "data": "$inputs.before_image"
        },
        {
            "type": "roboflow_core/clip@v1",
            "name": "after_embedding",
            "data": "$inputs.image"
        },
        {
            "type": "roboflow_core/cosine_similarity@v1",
            "name": "similarity_score",
            "embedding_1": "$steps.before_embedding.embedding",
            "embedding_2": "$steps.after_embedding.embedding"
        }
    ],
    "outputs": [
        {
            "type": "JsonField",
            "name": "detection_predictions",
            "selector": "$steps.detection_model.predictions"
        },
        {
            "type": "JsonField",
            "name": "similarity_score",
            "selector": "$steps.similarity_score.similarity"
        }
    ]
}

INLINE_URL = "https://serverless.roboflow.com/infer/workflows"


def _url_to_base64(url: str) -> str:
    resp = requests.get(url, timeout=15)
    resp.raise_for_status()
    return base64.b64encode(resp.content).decode("utf-8")


def _call_workflow(after_b64: str, before_b64: str) -> Dict[str, Any]:
    """POST inline workflow spec to Roboflow serverless."""
    payload = {
        "api_key": ROBOFLOW_API_KEY,
        "specification": WORKFLOW_SPEC,
        "inputs": {
            "image":        {"type": "base64", "value": after_b64},
            "before_image": {"type": "base64", "value": before_b64},
        },
    }
    resp = requests.post(INLINE_URL, json=payload, timeout=30)

    if resp.status_code != 200:
        print(f"Roboflow returned {resp.status_code}: {resp.text[:300]}")
        return {"error": resp.text, "status_code": resp.status_code}

    data = resp.json()
    outputs = data.get("outputs", [{}])
    return outputs[0] if outputs else {}


def final_verification(before_url: str, after_url: str) -> Dict[str, Any]:
    """
    Compare before (student complaint photo) vs after (authority resolution photo).

    Returns:
        MATCHED     — score > 0.85  → resolution confirmed
        UNCERTAIN   — 0.60–0.85     → trigger Claude fallback
        NOT_MATCHED — score < 0.60  → resolution rejected
        ERROR       — API failure   → trigger Claude fallback
    """
    try:
        before_b64 = _url_to_base64(before_url)
        after_b64  = _url_to_base64(after_url)

        out = _call_workflow(after_b64, before_b64)

        if "error" in out:
            return {
                "status": "ERROR",
                "score": 0.0,
                "action": "trigger_claude",
                "message": f"Workflow error ({out.get('status_code')}): {out['error'][:200]}",
            }

        score = out.get("similarity_score")
        if score is None:
            print(f"Warning: similarity_score missing. Output keys: {list(out.keys())}")
            score = 0.0
        score = float(score)

        detections = out.get("detection_predictions", [])
        n_detections = len(detections) if isinstance(detections, list) else 0
        print(f"Similarity: {score:.3f} | Detections: {n_detections}")

        if score > MATCH_THRESHOLD:
            return {
                "status": "MATCHED",
                "score": score,
                "action": None,
                "message": f"Resolution verified — {round(score * 100)}% similarity",
                "detections": n_detections,
            }
        elif score >= UNCERTAIN_THRESHOLD:
            return {
                "status": "UNCERTAIN",
                "score": score,
                "action": "trigger_claude",
                "message": f"Uncertain match ({round(score * 100)}%) — escalating to AI review",
                "detections": n_detections,
            }
        else:
            return {
                "status": "NOT_MATCHED",
                "score": score,
                "action": None,
                "message": f"Resolution not verified — only {round(score * 100)}% similarity",
                "detections": n_detections,
            }

    except requests.HTTPError as e:
        print(f"Roboflow HTTP error: {e}")
        return {"status": "ERROR", "score": 0.0, "action": "trigger_claude", "message": str(e)}
    except Exception as e:
        print(f"final_verification error: {e}")
        return {"status": "ERROR", "score": 0.0, "action": "trigger_claude", "message": str(e)}
