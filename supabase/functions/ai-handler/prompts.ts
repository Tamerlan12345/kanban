/**
 * =================================================================
 * PROMPT ENGINEERING LIBRARY FOR KANBAN AI ASSISTANT
 * =================================================================
 * This file contains all prompts used by the AI handler.
 * Personas are clearly defined and instructions are specific
 * to improve the quality and consistency of AI responses.
 */

// --- BASE PERSONA ---
const basePersona = "Ты — 'Kanban-AI', ведущий AI-ассистент по управлению проектами. Твоя задача — предоставлять четкие, структурированные и действенные аналитические отчеты и рекомендации. Всегда отвечай на русском языке в формате Markdown, используя заголовки, списки и выделение текста для лучшей читаемости.";

// --- DATA FORMATTING ---
function formatDataForPrompt(allUsers, allProjects) {
    let dataString = "### Аналитические данные\n\n**Пользователи:**\n";
    allUsers.forEach(u => {
        dataString += `- ${u.email} (Роль: ${u.role || 'user'})\n`;
    });

    dataString += "\n**Проекты и Задачи:**\n";
    allProjects.forEach(p => {
        dataString += `\n---\n**Проект: "${p.title}"**\n`;
        const statuses = p.workflow?.statuses;

        if (!statuses || statuses.length === 0) {
            dataString += "- *В этом проекте не настроены статусы рабочего процесса.*\n";
            return;
        }
        if (!p.tasks || p.tasks.length === 0) {
            dataString += "- *Задач нет*\n";
            return;
        }

        const tasksByStatus = {};
        statuses.forEach(s => tasksByStatus[s.id] = []);
        p.tasks.forEach(t => {
            if(tasksByStatus[t.status_id]) {
                tasksByStatus[t.status_id].push(t);
            }
        });

        statuses.forEach(s => {
            dataString += `\n*Статус: ${s.name}*\n`;
            const tasks = tasksByStatus[s.id];
            if (tasks.length === 0) {
                dataString += "- *Пусто*\n";
            } else {
                tasks.forEach(t => {
                    dataString += `  - **Задача:** ${t.title} (Приоритет: ${t.priority}, ID: ${t.id})\n`;
                });
            }
        });
    });
    return dataString;
}


// --- PROMPT GENERATION LOGIC ---
export function getPrompt(body) {
    const { analysisType, context } = body;

    // --- Task-level Helpers ---
    if (analysisType === 'decompose' || analysisType === 'distribute') {
        const { task, projectMembers } = body;
        if (!task) throw new Error("Данные о задаче отсутствуют.");

        if (analysisType === 'decompose') {
            return `${basePersona}\n\n**Задача:** Декомпозируй следующую сложную задачу на более мелкие, конкретные и выполнимые подзадачи. Для каждой подзадачи предложи оценку сложности (Низкая, Средняя, Высокая). Представь результат в виде маркированного списка.\n\n**Исходная задача:** "${task.title}"\n**Описание:** "${task.description}".`;
        }

        if (analysisType === 'distribute') {
            if (!projectMembers || !Array.isArray(projectMembers) || projectMembers.length === 0) {
                return "Невозможно дать рекомендацию: список участников проекта пуст.";
            }
            const membersString = projectMembers.join(', ');
            return `${basePersona}\n\n**Задача:** Проанализируй задачу и список участников проекта. Порекомендуй наиболее подходящего исполнителя (или нескольких) для этой задачи. Обоснуй свой выбор, исходя из предполагаемых сильных сторон участников и сути задачи. Укажи свою уверенность в рекомендации (в процентах).\n\n**Задача:** "${task.title}"\n**Описание:** "${task.description}"\n**Участники проекта:** ${membersString}.`;
        }
    }

    // --- Project/Global Analysis ---
    const { allUsers, allProjects } = body;
    if (!allUsers || !allProjects) throw new Error("Данные о проектах и пользователях отсутствуют.");

    const dataString = formatDataForPrompt(allUsers, allProjects);
    const isSingleProject = context === 'singleProject' && allProjects.length === 1;
    const projectName = isSingleProject ? `"${allProjects[0].title}"` : 'по всем проектам';

    let analysisGoal = '';

    switch (analysisType) {
        case 'productivity':
            analysisGoal = `**Цель:** Подготовь отчет о продуктивности для проекта ${projectName}.
- Оцени темп выполнения задач (соотношение "В процессе" и "Готово").
- Выдели ключевые выполненные задачи.
- Определи, есть ли признаки замедления или блокировки в работе команды.
- Дай рекомендации по повышению продуктивности.`;
            break;
        case 'risks':
            analysisGoal = `**Цель:** Проведи анализ рисков для проекта ${projectName}.
- Определи "узкие места" (колонки с аномально большим количеством задач).
- Выяви задачи, которые находятся "в процессе" дольше всего и могут быть под риском срыва.
- Укажи потенциальные риски, основываясь на распределении и приоритетах задач.
- Предложи конкретные шаги для минимизации рисков.`;
            break;
        case 'summary':
            analysisGoal = `**Цель:** Подготовь краткую сводку (executive summary) по состоянию проекта ${projectName}.
- Укажи точное количество задач в каждой колонке.
- Рассчитай процент выполненных задач от общего числа.
- Выдели 1-3 ключевые задачи, требующие немедленного внимания.
- Сформулируй общий вывод о текущем статусе проекта (например, "в графике", "требует внимания", "в зоне риска").`;
            break;
        default:
            throw new Error(`Неизвестный тип анализа: ${analysisType}`);
    }

    return `${basePersona}\n\n${analysisGoal}\n\n${dataString}`;
}
