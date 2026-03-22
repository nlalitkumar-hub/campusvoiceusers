from ultralytics import YOLO
import numpy as np
from PIL import Image
import io
import base64
from typing import List, Dict, Any

CAMPUS_OBJECTS = [
    'chair', 'desk', 'laptop', 'keyboard', 'mouse', 'monitor', 'tv', 'book',
    'backpack', 'bench', 'table', 'bottle', 'cup', 'clock', 'toilet', 'sink',
    'door', 'window', 'car', 'bicycle', 'motorcycle', 'fire hydrant',
    'stop sign', 'trash', 'cell phone', 'umbrella', 'handbag', 'potted plant',
    'couch', 'dining table', 'refrigerator', 'vase', 'scissors', 'toothbrush',
    'bowl', 'microwave', 'oven', 'knife', 'spoon',
]

PROBLEM_INDICATORS = ['trash', 'fire hydrant', 'toilet', 'sink', 'stop sign']

HUMAN_OBJECTS = ['person']


class YOLOService:
    def __init__(self):
        self.model = None
        self._load_model()

    def _load_model(self):
        try:
            self.model = YOLO('yolov8n.pt')
            print("✅ YOLOv8 model loaded")
        except Exception as e:
            print(f"❌ YOLOv8 load error: {e}")
            self.model = None

    def decode_image(self, base64_str: str) -> Image.Image:
        if ',' in base64_str:
            base64_str = base64_str.split(',')[1]
        img_data = base64.b64decode(base64_str)
        return Image.open(io.BytesIO(img_data)).convert('RGB')

    def detect(self, base64_image: str) -> Dict[str, Any]:
        if not self.model:
            return {
                "detected_objects": [],
                "campus_objects_found": [],
                "is_campus_scene": False,
                "confidence": 0.0,
                "total_objects": 0,
                "is_human_image": False,
                "error": "Model not loaded",
            }
        try:
            image = self.decode_image(base64_image)
            results = self.model(image, conf=0.35, verbose=False)

            detected = []
            campus_found = []
            human_found = []
            scores = []

            for result in results:
                for box in result.boxes:
                    class_id = int(box.cls[0])
                    name = result.names[class_id]
                    conf = float(box.conf[0])
                    detected.append({"object": name, "confidence": round(conf, 3)})
                    if name in HUMAN_OBJECTS:
                        human_found.append(name)
                    if name in CAMPUS_OBJECTS:
                        campus_found.append(name)
                    scores.append(conf)

            print(f"\nYOLO detected: {[d['object'] for d in detected]}")
            print(f"Campus objects: {list(set(campus_found))}")
            print(f"Human objects: {list(set(human_found))}")

            avg_conf = float(np.mean(scores)) if scores else 0.0
            unique_campus = list(set(campus_found))
            unique_human = list(set(human_found))
            non_person_campus = [obj for obj in unique_campus if obj != 'person']
            has_problem_indicator = any(obj in PROBLEM_INDICATORS for obj in unique_campus)

            # Human image: ONLY flag when person is detected with high confidence
            # AND is the ONLY object in the frame — any other object = not a human image
            high_conf_person = any(
                obj['object'] == 'person' and obj['confidence'] > 0.75
                for obj in detected
            )
            is_human_image = (high_conf_person and len(detected) == 1)

            # Campus detection requires non-person objects
            is_campus = (
                (len(non_person_campus) >= 1 and avg_conf > 0.35)
                or (has_problem_indicator and avg_conf > 0.30)
            )

            print(f"Is human image: {is_human_image}")
            print(f"Is campus: {is_campus}")
            print(f"Avg confidence: {avg_conf:.3f}")

            return {
                "detected_objects": detected,
                "campus_objects_found": unique_campus,
                "non_person_objects": non_person_campus,
                "is_campus_scene": is_campus,
                "is_human_image": is_human_image,
                "confidence": round(avg_conf, 3),
                "total_objects": len(detected),
            }
        except Exception as e:
            print(f"YOLO detection error: {e}")
            return {
                "detected_objects": [],
                "campus_objects_found": [],
                "is_campus_scene": False,
                "is_human_image": False,
                "confidence": 0.0,
                "total_objects": 0,
                "error": str(e),
            }


yolo_service = YOLOService()
