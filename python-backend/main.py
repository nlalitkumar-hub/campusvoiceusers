from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import os
from dotenv import load_dotenv

load_dotenv()

app = FastAPI(
    title="CampusVoice Python AI Backend",
    description="YOLOv8 + CLIP image verification",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:8080",
        "http://localhost:8081",
        "http://127.0.0.1:8080",
        "http://127.0.0.1:8081",
        "http://localhost:5000",
        "http://localhost:3000",
        "*",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from routers import health, verification

app.include_router(health.router)
app.include_router(verification.router)


@app.get("/")
async def root():
    return {
        "message": "CampusVoice AI Backend",
        "status": "running",
        "endpoints": [
            "GET /health",
            "POST /api/verify-image",
            "POST /api/verify-campus",
            "POST /api/verify-resolution",
        ],
    }


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8000))
    print(f"Starting CampusVoice AI on port {port}")
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)
