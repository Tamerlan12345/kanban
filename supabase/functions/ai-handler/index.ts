import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { corsHeaders } from '../_shared/cors.ts'
import { getPrompt } from './prompts.ts'

// Get the API key from Supabase environment variables
const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY')
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`

serve(async (req) => {
  // Handle CORS preflight request
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const body = await req.json()

    // 1. Generate the prompt using the dedicated prompt library
    const prompt = getPrompt(body)

    // Handle special case from prompt generator for empty members list
    if (prompt.startsWith('Невозможно дать рекомендацию')) {
        return new Response(JSON.stringify({ report: prompt }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
        });
    }

    // 2. Call the Gemini API
    const payload = {
      contents: [{ role: "user", parts: [{ text: prompt }] }]
    };

    const geminiResponse = await fetch(GEMINI_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!geminiResponse.ok) {
      const errorBody = await geminiResponse.text();
      console.error('Gemini API Error:', errorBody);
      throw new Error(`Gemini API error! Status: ${geminiResponse.status}. Body: ${errorBody}`);
    }

    const geminiResult = await geminiResponse.json();

    if (!geminiResult.candidates || geminiResult.candidates.length === 0) {
        console.error('Invalid Gemini Response:', geminiResult);
        throw new Error("Не удалось получить ответ от ИИ-модели.");
    }

    const report = geminiResult.candidates[0].content.parts[0].text;

    // 3. Send the successful response back to the client
    return new Response(JSON.stringify({ report }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (error) {
    // 4. Send an error response back to the client
    console.error('Handler Error:', error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400, // Using 400 for client-side or data errors
    })
  }
})
