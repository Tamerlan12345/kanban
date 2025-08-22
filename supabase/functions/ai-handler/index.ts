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
    const { analysisType, context } = body // Получаем новый параметр 'context'
    let prompt = "";

    if (analysisType === 'decompose' || analysisType === 'distribute') {
        // Логика для ИИ-помощника в задаче (без изменений)
        const { task, projectMembers } = body;
        if (!task) throw new Error("Данные о задаче отсутствуют.");

        if (analysisType === 'decompose') {
            prompt = `Ты — опытный тимлид. Декомпозируй следующую сложную задачу на более мелкие, конкретные подзадачи. Представь результат в виде маркированного списка. Задача: "${task.title}". Описание: "${task.description}".`;
        } else { // distribute
            if (!projectMembers || !Array.isArray(projectMembers) || projectMembers.length === 0) {
                // Возвращаем осмысленный отчет вместо ошибки, чтобы UI мог его отобразить.
                return new Response(JSON.stringify({ report: "Невозможно дать рекомендацию: список участников проекта пуст или не был предоставлен." }), {
                  headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                  status: 200, // Отправляем 200, так как это не сбой сервера, а состояние данных
                })
            }
            const membersString = projectMembers.join(', ');
            prompt = `Ты — AI-менеджер проектов. Проанализируй задачу и список участников проекта. Порекомендуй наиболее подходящего исполнителя для этой задачи и кратко обоснуй свой выбор. Задача: "${task.title}". Описание: "${task.description}". Участники проекта: ${membersString}.`;
        }
    } else {
        // Обновленная логика для аналитики с учетом контекста
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

        const isSingleProject = context === 'singleProject' && allProjects.length === 1;
        const projectName = isSingleProject ? allProjects[0].title : '';

        if (analysisType === 'productivity') {
            prompt = isSingleProject
                ? `Ты — AI-аналитик. Проанализируй данные по проекту "${projectName}". Оцени задачи в колонках "В процессе" и "Готово", чтобы определить текущую производительность команды. Укажи, есть ли какие-либо блокираторы. Ответ дай на русском языке в формате Markdown.`
                : `Ты — ведущий AI-аналитик в IT-компании. Проанализируй предоставленные данные о проектах, задачах и пользователях. Подготовь отчет о продуктивности. Для каждого пользователя оцени количество выполненных задач (в колонке "Готово" или аналогичной), и общую вовлеченность. Выдели самых продуктивных сотрудников и тех, кому может потребоваться помощь. Ответ дай на русском языке в формате Markdown.`;
        } else if (analysisType === 'risks') {
            prompt = isSingleProject
                ? `Ты — AI-эксперт по управлению рисками. Проанализируй канбан-доску проекта "${projectName}". Определи "узкие места" (колонки с наибольшим скоплением задач). Укажи потенциальные риски срыва сроков для задач, которые долго находятся в работе. Предложи рекомендации. Ответ дай на русском языке в формате Markdown.`
                : `Ты — AI-эксперт по управлению рисками. Проанализируй данные о канбан-досках. Выяви проекты и задачи, которые находятся "в процессе" дольше всего. Определи "узкие места" (колонки с наибольшим скоплением задач). Укажи потенциальные риски срыва сроков. Предложи рекомендации по перераспределению ресурсов. Ответ дай на русском языке в формате Markdown.`;
        } else { // summary
            prompt = isSingleProject
                ? `Ты — AI-ассистент. Подготовь краткую сводку по текущему состоянию проекта "${projectName}". Укажи: 1) Количество задач в каждой колонке. 2) Процент выполненных задач. 3) Ключевые задачи, требующие внимания. Ответ дай на русском языке в формате Markdown.`
                : `Ты — AI-ассистент руководителя проекта. Подготовь общую сводку по всем проектам. Укажи: 1) Общее количество проектов и задач. 2) Процент выполненных задач. 3) Проекты, требующие особого внимания. 4) Общие выводы и ключевые показатели. Ответ дай на русском языке в формате Markdown.`;
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
