import os
from fastapi import FastAPI, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from app.api.endpoints import router

app = FastAPI(
    title="AI Invoice Parser API",
    description="Asynchronous API for parsing digital and scanned invoices utilizing OCR and Gemini",
    version="1.0.0"
)

# Configure CORS to allow frontend connections
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # allow all origins in development
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["Content-Disposition"],
)

# Include API endpoints directly at the root
app.include_router(router)

# Optionally serve frontend static build if it exists
frontend_dist_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "frontend-dist"))
os.makedirs(frontend_dist_dir, exist_ok=True)

# Mount the assets directory so that /assets/... serves correct static assets
assets_dir = os.path.join(frontend_dist_dir, "assets")
os.makedirs(assets_dir, exist_ok=True)
app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")

@app.get("/favicon.svg")
async def serve_favicon():
    favicon_path = os.path.join(frontend_dist_dir, "favicon.svg")
    if os.path.exists(favicon_path):
        return FileResponse(favicon_path)
    return Response(status_code=404)

@app.get("/icons.svg")
async def serve_icons():
    icons_path = os.path.join(frontend_dist_dir, "icons.svg")
    if os.path.exists(icons_path):
        return FileResponse(icons_path)
    return Response(status_code=404)

@app.get("/")
async def serve_index():
    index_path = os.path.join(frontend_dist_dir, "index.html")
    if os.path.exists(index_path):
        return FileResponse(index_path)
    return {
        "message": "AI Invoice Parser API is running. Connect via frontend or open /docs to view Swagger documentation."
    }

# Fallback path for client-side routing in single-page apps (SPA)
@app.get("/{catchall:path}")
async def serve_spa(catchall: str):
    index_path = os.path.join(frontend_dist_dir, "index.html")
    if os.path.exists(index_path) and not catchall.startswith("api/") and not catchall.startswith("upload") and not catchall.startswith("result") and not catchall.startswith("export") and not catchall.startswith("assets/") and not catchall.startswith("settings") and not catchall.startswith("schema"):
        return FileResponse(index_path)
    # If not API and no index.html, return API message or 404
    return {
        "detail": "Not Found"
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8001, reload=True)
