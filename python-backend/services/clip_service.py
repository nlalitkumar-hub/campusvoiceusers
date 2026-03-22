import torch
import numpy as np
from PIL import Image
import io
import base64
from typing import Dict, Any


class CLIPService:
    def __init__(self):
        self.model = None
        self.use_transformers = False
        self._load_model()

    def _load_model(self):
        try:
            from transformers import CLIPProcessor, CLIPModel
            self.model = CLIPModel.from_pretrained("openai/clip-vit-base-patch32")
            self.processor = CLIPProcessor.from_pretrained("openai/clip-vit-base-patch32")
            self.use_transformers = True
            print("✅ CLIP model loaded")
        except Exception as e:
            print(f"❌ CLIP load error: {e}")
            self.model = None

    def decode_image(self, base64_str: str) -> Image.Image:
        if ',' in base64_str:
            base64_str = base64_str.split(',')[1]
        img_data = base64.b64decode(base64_str)
        return Image.open(io.BytesIO(img_data)).convert('RGB')

    def compute_similarity(self, base64_image: str, description: str) -> Dict[str, Any]:
        if not self.model:
            return {
                "similarity_score": 0.0,
                "matches": False,
                "confidence": "low",
                "description_relevance": 0.0,
                "is_human": False,
                "error": "Model not loaded",
            }
        try:
            image = self.decode_image(base64_image)
            positive_texts = [
                f"a photo clearly showing {description}",
                f"image of {description} at a college campus",
                f"campus complaint about {description}",
                f"visible problem: {description}",
            ]
            negative_texts = [
                "a photo of a human face or person only",
                "a selfie portrait photo",
                "completely unrelated image",
                "no visible problem or damage",
                "everything looks normal and undamaged",
                "a random photo with no issues",
                "clean and functioning facility",
                "no complaint visible here",
                "image does not show any problem",
                "irrelevant photo",
            ]
            all_texts = positive_texts + negative_texts

            if self.use_transformers:
                inputs = self.processor(
                    text=all_texts, images=image,
                    return_tensors="pt", padding=True,
                    truncation=True, max_length=77,
                )
                with torch.no_grad():
                    outputs = self.model(**inputs)
                    probs = outputs.logits_per_image.softmax(dim=1).numpy()[0]

                positive_score = float(np.mean(probs[:4]))
                negative_score = float(np.mean(probs[4:]))
                total = positive_score + negative_score
                ratio = positive_score / total if total > 0 else 0

                print(f"CLIP positive: {positive_score:.3f}")
                print(f"CLIP negative: {negative_score:.3f}")
                print(f"CLIP ratio: {ratio:.3f}")

                # 90% accuracy threshold
                matches = ratio > 0.68
                if ratio > 0.82:
                    confidence = "high"
                elif ratio > 0.68:
                    confidence = "medium"
                else:
                    confidence = "low"

                return {
                    "similarity_score": round(ratio, 3),
                    "matches": matches,
                    "confidence": confidence,
                    "description_relevance": round(positive_score, 3),
                }
        except Exception as e:
            print(f"CLIP similarity error: {e}")
            return {
                "similarity_score": 0.0,
                "matches": False,
                "confidence": "low",
                "description_relevance": 0.0,
                "error": str(e),
            }


clip_service = CLIPService()
