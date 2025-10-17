import google.generativeai as genai
from ..config import settings
from pydub import AudioSegment
import io
import asyncio
import os
import uuid

# Configure the Gemini API key
genai.configure(api_key=settings.GEMINI_API_KEY)

# System prompt as defined in the technical specification
SYSTEM_PROMPT = "Ты — эксперт по корпоративному обучению. Твоя задача — отвечать на вопросы пользователя кратко, четко и по делу, используя модель STAR (Situation, Task, Action, Result), где это применимо. Будь вежливым и профессиональным."

async def stream_audio_to_gemini(audio_data: bytes):
    """
    Receives a complete audio byte stream, converts it, sends it to Gemini,
    and streams the text response back.
    """
    print("Starting audio processing for Gemini.")

    # 1. Convert audio from WEBM/Opus to a compatible format like MP3
    # Use a temporary file path for conversion
    temp_webm_path = f"/tmp/{uuid.uuid4()}.webm"
    temp_mp3_path = f"/tmp/{uuid.uuid4()}.mp3"

    try:
        # Write the received bytes to a temporary webm file
        with open(temp_webm_path, "wb") as f:
            f.write(audio_data)
        print(f"Temporarily saved audio to {temp_webm_path}")

        # Convert the audio file to MP3 using pydub
        audio = AudioSegment.from_file(temp_webm_path, format="webm")
        audio.export(temp_mp3_path, format="mp3")
        print(f"Converted audio to {temp_mp3_path}")

        # 2. Upload the converted audio file to the Gemini API
        print("Uploading audio file to Gemini...")
        audio_file = genai.upload_file(path=temp_mp3_path, mime_type="audio/mp3")
        print(f"Successfully uploaded file: {audio_file.name}")

        # 3. Initialize the generative model and generate content
        print("Generating content with Gemini...")
        model = genai.GenerativeModel(
            model_name='models/gemini-1.5-flash',
            system_instruction=SYSTEM_PROMPT
        )

        # The prompt for the model includes the uploaded audio file
        prompt = ["Пожалуйста, проанализируй этот аудиофайл и ответь на мой вопрос.", audio_file]

        # Generate content with streaming enabled
        response = model.generate_content(prompt, stream=True)
        print("Received streaming response from Gemini.")

        # 4. Stream the response back to the client
        for chunk in response:
            if chunk.text:
                # Add a small delay to simulate natural speech flow if desired
                # await asyncio.sleep(0.05)
                yield chunk.text

    except Exception as e:
        print(f"An error occurred in the Gemini service: {e}")
        # Re-raise the exception to be caught by the WebSocket endpoint
        raise

    finally:
        # Clean up temporary files
        if os.path.exists(temp_webm_path):
            os.remove(temp_webm_path)
            print(f"Cleaned up temporary file: {temp_webm_path}")
        if os.path.exists(temp_mp3_path):
            os.remove(temp_mp3_path)
            print(f"Cleaned up temporary file: {temp_mp3_path}")