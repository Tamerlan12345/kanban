import google.generativeai as genai
from ..config import settings

# Configure the Gemini API key
genai.configure(api_key=settings.GEMINI_API_KEY)

# System prompt as defined in the technical specification
SYSTEM_PROMPT = "Ты — эксперт по корпоративному обучению. Твоя задача — отвечать на вопросы пользователя кратко, четко и по делу, используя модель STAR (Situation, Task, Action, Result), где это применимо. Будь вежливым и профессиональным."

async def stream_audio_to_gemini(audio_chunks):
    """
    Initializes a Gemini session and streams audio chunks to it,
    yielding back the text responses.
    """
    model = genai.GenerativeModel('models/gemini-1.5-flash')

    # This is a placeholder for the live, streaming API interaction.
    # The actual google-generativeai library might have a different implementation
    # for live audio streaming (e.g., a specific method or class).
    # For this MVP, we simulate the streaming behavior.

    # Let's assume the real API would look something like this:
    # session = model.start_live_session(system_instruction=SYSTEM_PROMPT)
    # for chunk in audio_chunks:
    #     response = session.send_audio_chunk(chunk)
    #     if response.text:
    #         yield response.text

    # In this simulation, we first need to consume all the audio chunks
    # to simulate waiting for the user to finish speaking.
    print("Receiving audio stream from client...")
    async for _ in audio_chunks:
        # In a real implementation, we would accumulate or process these chunks.
        # For now, we just consume them to ensure we wait for the stream to end.
        pass
    print("Audio stream received. Now generating simulated response.")


    # Since we don't have a live API to connect to, we'll simulate a response.
    # This function will be updated once the actual Gemini Live API client is available.
    full_response = "Это симуляция ответа от Gemini. Аудиопоток получен, и теперь я генерирую этот ответ. Если бы вы спросили про модель STAR, я бы рассказал, что это Situation, Task, Action, Result."

    import asyncio

    for char in full_response:
        yield char
        await asyncio.sleep(0.05) # Simulate streaming delay