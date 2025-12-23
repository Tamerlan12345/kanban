import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { GoogleGenerativeAI } from '@google/generative-ai'

// @ts-ignore
const genAI = new GoogleGenerativeAI(Deno.env.get('GEMINI_API_KEY')!)

// Define interfaces for request payload
interface AIRequest {
  assistantType: 'business_analyst' | 'task_decomposer' | 'admin_analytics' | 'code_reviewer' | 'risk_assessor';
  input: string;
  context?: any;
}

// Mock function to get assistant config - in a real app this would query the DB
async function getAssistantConfig(type: string) {
  // This should ideally fetch from app_ai.assistants table via Supabase Client
  // For now, we hardcode based on the TZ prompts
  const prompts: Record<string, string> = {
    business_analyst: `Ты опытный бизнес-аналитик в страховой и финтех индустрии. Твоя задача:
- Анализировать требования и создавать детальные спецификации
- Выявлять риски и зависимости
- Предлагать оптимальные решения с учетом бизнес-метрик
- Формулировать критерии приемки (Definition of Done)
- Оценивать влияние на существующие процессы

Отвечай структурированно, с конкретными рекомендациями.`,
    task_decomposer: `Ты эксперт по декомпозиции сложных задач на управляемые подзадачи. Твоя цель:
- Разбивать крупные задачи на атомарные подзадачи (2-8 часов работы)
- Определять зависимости между задачами
- Расставлять приоритеты по фреймворку P1-P4
- Оценивать сложность и время выполнения
- Предлагать оптимальную последовательность выполнения

Каждая подзадача должна иметь: название, описание, оценку времени, приоритет, зависимости.`,
    admin_analytics: `Ты AI-аналитик данных для руководителя. Твоя задача:
- Анализировать производительность команды и выявлять тренды
- Определять узкие места (bottlenecks) в процессах
- Прогнозировать сроки завершения проектов
- Генерировать инсайты для принятия управленческих решений
- Сравнивать текущие метрики с целевыми KPI

Предоставляй actionable insights с конкретными рекомендациями.`
  };

  return {
    system_prompt: prompts[type] || "You are a helpful assistant.",
    model_config: {
      model: "gemini-1.5-pro",
      temperature: 0.7
    }
  };
}

// Mock function to log request - in a real app this would insert into app_ai.ai_requests
async function logAIRequest(data: any) {
  console.log("Logging AI Request:", data);
}

serve(async (req) => {
  // CORS headers
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      }
    })
  }

  try {
    const { assistantType, input, context } = await req.json() as AIRequest

    if (!assistantType || !input) {
       return new Response(JSON.stringify({ error: 'Missing assistantType or input' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const assistant = await getAssistantConfig(assistantType)
    const model = genAI.getGenerativeModel({
      model: assistant.model_config.model,
      generationConfig: {
        temperature: assistant.model_config.temperature,
        topP: 0.95,
        topK: 40,
        maxOutputTokens: 8192,
      }
    })

    const chat = model.startChat({
      history: [
        {
          role: 'user',
          parts: [{ text: assistant.system_prompt }]
        },
        {
          role: 'model',
          parts: [{ text: 'Понял, готов помогать согласно моей роли.' }]
        }
      ]
    })

    const result = await chat.sendMessage(input)
    const responseText = result.response.text()

    // Log to DB (mocked)
    await logAIRequest({
      assistantType,
      input,
      output: responseText,
      tokensUsed: result.response.usageMetadata?.totalTokenCount
    })

    return new Response(JSON.stringify({
      response: responseText,
      meta: result.response.usageMetadata
    }), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    })

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
})
