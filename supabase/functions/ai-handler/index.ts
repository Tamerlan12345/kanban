import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { corsHeaders } from '../_shared/cors.ts'

// Получаем ключ API из переменных окружения Supabase
const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY')
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`

serve(async (req) => {
  // Обработка CORS preflight-запроса
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const body = await req.json()
    const { analysisType } = body
    let prompt = "";

    if (analysisType === 'decompose' || analysisType === 'distribute') {
        // Логика для ИИ-помощника в задаче
        const { task, projectMembers } = body;
        if (!task) throw new Error("Данные о задаче отсутствуют.");

        if (analysisType === 'decompose') {
            prompt = `Ты — опытный тимлид. Декомпозируй следующую сложную задачу на более мелкие, конкретные подзадачи. Представь результат в виде маркированного списка. Задача: "${task.title}". Описание: "${task.description}".`;
        } else { // distribute
            const membersString = projectMembers.join(', ');
            prompt = `Ты — AI-менеджер проектов. Проанализируй задачу и список участников проекта. Порекомендуй наиболее подходящего исполнителя для этой задачи и кратко обоснуй свой выбор. Задача: "${task.title}". Описание: "${task.description}". Участники проекта: ${membersString}.`;
        }
    } else {
        // Существующая логика для общей аналитики
        const { allUsers, allProjects } = body;
        if (!allUsers || !allProjects) throw new Error("Данные о проектах и пользователях отсутствуют.");

        let dataString = "АНАЛИТИЧЕСКИЕ ДАННЫЕ:\n\nПОЛЬЗОВАТЕЛИ:\n";
        allUsers.forEach(u => { dataString += `- ${u.email} (Роль: ${u.role})\n`; });

        dataString += "\nПРОЕКТЫ И ЗАДАЧИ:\n";
        allProjects.forEach(p => {
            dataString += `\n---\nПроект: ${p.title}\n`;
            if (!p.tasks || p.tasks.length === 0) {
                dataString += "  - Задач нет\n";
            } else {
                p.tasks.forEach(t => {
                    const columnName = p.columns.find(c => c.id === t.column_id)?.title || 'N/A';
                    dataString += `  - Задача: ${t.title} (Приоритет: ${t.priority}, Колонка: ${columnName})\n`;
                });
            }
        });

        if (analysisType === 'productivity') {
            prompt = `Ты — ведущий AI-аналитик в IT-компании. Проанализируй предоставленные данные о проектах, задачах и пользователях. Подготовь отчет о продуктивности. Для каждого пользователя оцени количество выполненных задач (в колонке "Готово" или аналогичной), и общую вовлеченность. Выдели самых продуктивных сотрудников и тех, кому может потребоваться помощь. Ответ дай на русском языке в формате Markdown.`;
        } else if (analysisType === 'risks') {
            prompt = `Ты — AI-эксперт по управлению рисками. Проанализируй данные о канбан-досках. Выяви проекты и задачи, которые находятся "в процессе" дольше всего. Определи "узкие места" (колонки с наибольшим скоплением задач). Укажи потенциальные риски срыва сроков. Предложи рекомендации по перераспределению ресурсов. Ответ дай на русском языке в формате Markdown.`;
        } else { // summary
            prompt = `Ты — AI-ассистент руководителя проекта. Подготовь общую сводку по всем проектам. Укажи: 1) Общее количество проектов и задач. 2) Процент выполненных задач. 3) Проекты, требующие особого внимания. 4) Общие выводы и ключевые показатели. Ответ дай на русском языке в формате Markdown.`;
        }
        prompt = `${prompt}\n\nВот данные для анализа:\n${dataString}`;
    }

    // --- Вызываем Gemini API ---
    const payload = {
      contents: [{ role: "user", parts: [{ text: prompt }] }]
    };

    const geminiResponse = await fetch(GEMINI_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!geminiResponse.ok) {
      throw new Error(`Gemini API error! status: ${geminiResponse.status}`);
    }

    const geminiResult = await geminiResponse.json();
    const report = geminiResult.candidates[0].content.parts[0].text;

    // --- Отправляем успешный ответ клиенту ---
    return new Response(JSON.stringify({ report }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (error) {
    // --- Отправляем ошибку клиенту ---
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})
