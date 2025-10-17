from fastapi import FastAPI
from .routers import websocket

app = FastAPI(title="Live Corporate Trainer API")

app.include_router(websocket.router)

@app.get("/")
def read_root():
    return {"message": "Welcome to the Live Corporate Trainer API"}