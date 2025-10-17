import asyncio
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from ..services import gemini_service

router = APIRouter()

@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """
    Handles the WebSocket connection. It receives a full audio stream from a client,
    processes it with the Gemini service, and streams the text response back.
    """
    await websocket.accept()
    print("WebSocket connection accepted.")

    audio_chunks = []
    try:
        # 1. Receive audio stream from client
        while True:
            data = await websocket.receive_bytes()
            audio_chunks.append(data)
            print(f"Received audio chunk of size: {len(data)}")

    except WebSocketDisconnect:
        print("Client disconnected. Processing received audio...")
        # This is the expected way to end the stream.

    except Exception as e:
        print(f"An unexpected error occurred while receiving audio: {e}")
        await websocket.close(code=1011, reason="Server error")
        return # Exit if an error occurs

    if not audio_chunks:
        print("No audio data received. Closing connection.")
        await websocket.close(code=1007, reason="No audio data received")
        return

    # 2. Combine audio chunks into a single byte object
    full_audio_data = b"".join(audio_chunks)
    print(f"Total audio data size: {len(full_audio_data)} bytes")

    # 3. Stream response from Gemini back to the client
    try:
        print("Sending audio to Gemini and starting to stream response...")
        # The service function is now an async generator
        async for text_chunk in gemini_service.stream_audio_to_gemini(full_audio_data):
            await websocket.send_text(text_chunk)
            print(f"Sent text chunk: {text_chunk}")

    except Exception as e:
        error_message = f"Error processing audio with Gemini: {e}"
        print(error_message)
        # Optionally, send an error message to the client before closing
        await websocket.send_text(f"Error: {error_message}")
        await websocket.close(code=1011, reason="Gemini processing error")

    finally:
        # 4. Cleanly close the connection
        try:
            if websocket.client_state != "DISCONNECTED":
                await websocket.close()
                print("WebSocket connection closed by server.")
        except RuntimeError as e:
            # This can happen if the client has already disconnected.
            print(f"Ignoring error on websocket close: {e}")

    print("WebSocket session concluded.")