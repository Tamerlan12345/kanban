from fastapi import FastAPI, Request
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
import os
import sys
import logging
from contextlib import asynccontextmanager
import google.generativeai as genai
from .config import settings
from .routers import websocket

# --- Globals ---
# A global variable to hold the initialized Gemini model.
gemini_model = None

# --- Lifespan Management ---
@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Application lifespan manager. This function runs on startup and shutdown.
    """
    global gemini_model
    logging.info("Application startup...")

    # On startup, initialize the Gemini model and handle potential errors.
    try:
        logging.info("Initializing Gemini model...")
        # Configure the API key from settings.
        genai.configure(api_key=settings.GEMINI_API_KEY)
        # The following line will fail if the API key is invalid,
        # preventing the app from starting.
        gemini_model = genai.GenerativeModel('models/gemini-1.5-flash')
        # Perform a test generation to ensure the key is valid.
        # This is a lightweight check.
        _ = gemini_model.generate_content("test", generation_config=genai.types.GenerationConfig(max_output_tokens=1))
        logging.info("Gemini model initialized successfully.")
    except Exception as e:
        # If there's any exception during initialization (e.g., invalid key),
        # log the error and exit the application.
        logging.error(f"CRITICAL: Failed to initialize Gemini model. Error: {e}")
        logging.error("Please ensure the GEMINI_API_KEY is valid and has permissions for the 'gemini-1.5-flash' model.")
        sys.exit(1) # Exit with a non-zero code to indicate failure.

    yield # The application runs here

    # --- Shutdown logic (if any) ---
    logging.info("Application shutdown.")

# --- FastAPI App Initialization ---
app = FastAPI(
    title="Live Corporate Trainer API",
    lifespan=lifespan # Use the lifespan manager for startup/shutdown events.
)

# Mount the WebSocket router
app.include_router(websocket.router)

@app.get("/health", tags=["Health Check"])
async def health_check():
    """Endpoint to check if the application is running."""
    return {"status": "OK"}

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