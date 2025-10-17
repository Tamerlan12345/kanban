from fastapi import FastAPI, Request
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
import os
from .routers import websocket

app = FastAPI(title="Live Corporate Trainer API")

# Mount the WebSocket router
app.include_router(websocket.router)

# Path to the static files directory
static_files_dir = os.path.join(os.path.dirname(__file__), "static")

# Mount the static files directory to serve the React frontend
# This will serve files like JS, CSS, images, etc.
app.mount("/assets", StaticFiles(directory=os.path.join(static_files_dir, "assets")), name="assets")

@app.get("/{full_path:path}")
async def serve_react_app(request: Request, full_path: str):
    """
    Serve the React application.
    This serves the index.html for any path that is not an API endpoint.
    """
    index_path = os.path.join(static_files_dir, "index.html")
    if os.path.exists(index_path):
        return FileResponse(index_path)
    return {"message": "React app not found. Please build the frontend first."}