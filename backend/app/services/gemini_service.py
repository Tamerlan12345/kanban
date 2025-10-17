import google.generativeai as genai
from ..config import settings
from pydub import AudioSegment
import io
import asyncio
import os
import uuid
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Configure the Gemini API key
try:
    if not settings.GEMINI_API_KEY or settings.GEMINI_API_KEY == "YOUR_API_KEY_HERE":
        raise ValueError("GEMINI_API_KEY is not set or is a placeholder.")
    genai.configure(api_key=settings.GEMINI_API_KEY)
    logger.info("Gemini API key configured successfully.")
except (ValueError, Exception) as e:
    logger.error(f"Failed to configure Gemini API key: {e}", exc_info=True)
    # This will prevent the service from starting if the key is invalid
    raise

# System prompt as defined in the technical specification
SYSTEM_PROMPT = "Ты — эксперт по корпоративному обучению. Твоя задача — отвечать на вопросы пользователя кратко, четко и по делу, используя модель STAR (Situation, Task, Action, Result), где это применимо. Будь вежливым и профессиональным."

async def stream_audio_to_gemini(audio_data: bytes):
    """
    Receives a complete audio byte stream, converts it, sends it to Gemini,
    and streams the text response back.
    """
    logger.info("Starting audio processing for Gemini.")

    # Use a temporary file path for conversion
    temp_webm_path = f"/tmp/{uuid.uuid4()}.webm"
    temp_mp3_path = f"/tmp/{uuid.uuid4()}.mp3"

    try:
        # 1. Save and Convert Audio
        logger.info("Saving received audio bytes to temporary .webm file.")
        with open(temp_webm_path, "wb") as f:
            f.write(audio_data)
        logger.info(f"Temporarily saved audio to {temp_webm_path}")

        logger.info("Converting audio from .webm to .mp3...")
        audio = AudioSegment.from_file(temp_webm_path, format="webm")
        audio.export(temp_mp3_path, format="mp3")
        logger.info(f"Successfully converted audio to {temp_mp3_path}")

        # 2. Upload the converted audio file to the Gemini API
        logger.info("Uploading audio file to Gemini File API...")
        audio_file = genai.upload_file(path=temp_mp3_path, mime_type="audio/mp3")
        logger.info(f"Successfully uploaded file: {audio_file.name}")

        # 3. Generate content with Gemini
        logger.info("Initializing Gemini Generative Model (gemini-1.5-flash).")
        model = genai.GenerativeModel(
            model_name='models/gemini-1.5-flash',
            system_instruction=SYSTEM_PROMPT
        )

        prompt = ["Пожалуйста, проанализируй этот аудиофайл и ответь на мой вопрос.", audio_file]
        logger.info("Sending prompt to Gemini for content generation (streaming).")

        response = model.generate_content(prompt, stream=True)
        logger.info("Received streaming response from Gemini.")

        # 4. Stream the response back to the client
        for chunk in response:
            if chunk.text:
                yield chunk.text
                logger.debug(f"Yielded text chunk: {chunk.text}")

    except Exception as e:
        logger.error(f"An error occurred in the Gemini service: {e}", exc_info=True)
        # Re-raise the exception to be caught by the WebSocket endpoint
        raise

    finally:
        # Clean up temporary files
        logger.info("Cleaning up temporary files.")
        if os.path.exists(temp_webm_path):
            os.remove(temp_webm_path)
            logger.info(f"Removed temporary file: {temp_webm_path}")
        if os.path.exists(temp_mp3_path):
            os.remove(temp_mp3_path)
            logger.info(f"Removed temporary file: {temp_mp3_path}")