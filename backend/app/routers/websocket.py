import asyncio
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from ..services import gemini_service

router = APIRouter()

@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """
    Handles the WebSocket connection for real-time audio streaming to Gemini
    and streaming text responses back to the client.
    """
    await websocket.accept()

    # Queue to hold audio chunks from the client
    audio_queue = asyncio.Queue()

    async def audio_chunk_generator():
        """Async generator that yields audio chunks from the queue."""
        while True:
            chunk = await audio_queue.get()
            if chunk is None:  # A sentinel value to indicate the end of the stream
                break
            yield chunk

    async def receive_audio_from_client():
        """Receives audio bytes from the client and puts them in the queue."""
        try:
            while True:
                data = await websocket.receive_bytes()
                await audio_queue.put(data)
        except WebSocketDisconnect:
            print("Client disconnected.")
            # Put the sentinel value to signal the end to the generator
            await audio_queue.put(None)
        except Exception as e:
            print(f"Error receiving from client: {e}")
            await audio_queue.put(None)


    async def send_text_to_client():
        """
        Streams text from the Gemini service to the client.
        The service function is fed with the async audio generator.
        """
        print("Starting to stream text to client...")
        try:
            async for text_chunk in gemini_service.stream_audio_to_gemini(audio_chunk_generator()):
                await websocket.send_text(text_chunk)
        except Exception as e:
            print(f"Error during streaming to client: {e}")
            # Optionally, send an error message to the client
            # await websocket.send_text(f"Error: {e}")
        finally:
            print("Finished streaming text to client.")
            # Ensure the connection is closed if not already
            if websocket.client_state.CONNECTED:
                await websocket.close()

    # Run receiver and sender tasks concurrently
    receive_task = asyncio.create_task(receive_audio_from_client())
    send_task = asyncio.create_task(send_text_to_client())

    # Wait for either task to complete
    done, pending = await asyncio.wait(
        [receive_task, send_task],
        return_when=asyncio.FIRST_COMPLETED,
    )

    # Cancel any pending tasks to ensure a clean exit
    for task in pending:
        task.cancel()

    print("WebSocket session concluded.")