# CampusVoice Python AI Backend

## Setup (Windows)

Open CMD in `python-backend` folder and run:

```
pip install -r requirements.txt
```

## Run

```
python main.py
```

## Test

Visit http://localhost:8000/health

## Endpoints

```
GET  /health
POST /api/verify-image
POST /api/verify-campus
```

## Models

- **YOLOv8n** — Object detection (campus scene verification)
- **CLIP ViT-B/32** — Text-image similarity matching

## Notes

- First run will auto-download YOLOv8n weights (~6MB)
- CLIP model downloads on first run (~350MB)
- Runs on CPU by default, uses CUDA if available
