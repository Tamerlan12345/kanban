import { ref, reactive } from 'https://unpkg.com/vue@3/dist/vue.esm-browser.prod.js';
import { projectService, workspaceService, workflowService, taskService, issueTypeService } from '../services/supabaseService.js';
import { user } from './useAuth.js';

export function useProjects(showAlert) {
    // Новое состояние для рабочих пространств
    const allWorkspaces = ref([]);
    const currentWorkspace = ref(null);

    const allProjects = ref([]);
    const currentProject = ref(null);
    const newProject = reactive({ title: '' });
    const newWorkspace = reactive({ name: '' }); // Новое состояние для создания workspace

    // 1. Инициализация: загрузка рабочих пространств, а затем проектов
    const initialize = async () => {
        if (!user.id) return;
        try {
            const { data, error } = await workspaceService.fetchAll();
            if (error) throw error;
            allWorkspaces.value = data;

            // Автоматически выбираем первое рабочее пространство
            if (data && data.length > 0) {
                await selectWorkspace(data[0].id);
            }
        } catch (error) {
            console.error("Error fetching workspaces:", error);
            showAlert(`Не удалось загрузить рабочие пространства: ${error.message}`);
        }
    };

    // 2. Выбор рабочего пространства и загрузка его проектов
    const selectWorkspace = async (workspaceId) => {
        currentWorkspace.value = allWorkspaces.value.find(w => w.id === workspaceId);
        currentProject.value = null; // Сбрасываем выбор проекта
        allProjects.value = []; // Очищаем старые проекты

        if (!currentWorkspace.value) return;

        try {
            const { data, error } = await projectService.fetchForWorkspace(workspaceId);
            if (error) throw error;
            allProjects.value = data;
        } catch (error) {
            console.error("Error fetching projects for workspace:", error);
            showAlert(`Не удалось загрузить проекты: ${error.message}`);
        }
    };

    // 3. Создание проекта в текущем рабочем пространстве
    const createProject = async () => {
        if (!newProject.title || !currentWorkspace.value?.id || !user.id) {
            showAlert("Необходимо указать название проекта и выбрать рабочее пространство.");
            return;
        }
        try {
            await projectService.createProject(newProject.title, user.id, currentWorkspace.value.id);
            await selectWorkspace(currentWorkspace.value.id); // Обновляем список проектов
            newProject.title = '';
        } catch (error) {
            console.error("Error creating project:", error);
            showAlert(`Не удалось создать проект: ${error.message}`);
        }
    };

    // 4. Выбор проекта
    const selectProject = async (projectId) => {
        try {
            const { data, error } = await projectService.fetchProjectDetails(projectId);
            if (error) throw error;

            // TODO: Интегрировать логику команд и участников
            data.members = []; // Временная заглушка для участников

            // Сортируем статусы в workflow
            if (data.workflows && data.workflows.statuses) {
                data.workflows.statuses.sort((a, b) => a.order - b.order);
            }

            // Для совместимости со старой структурой, переименовываем workflows в workflow
            data.workflow = data.workflows;
            delete data.workflows;

            currentProject.value = data;

        } catch (error) {
            console.error("Error selecting project:", error);
            currentProject.value = null;
            showAlert(`Не удалось загрузить проект: ${error.message}`);
        }
    };

    // 5. Создание рабочего пространства
    const createWorkspace = async () => {
        if (!newWorkspace.name || !user.id) {
            showAlert("Необходимо указать название рабочего пространства.");
            return;
        }
        try {
            const { data, error } = await workspaceService.create(newWorkspace.name, user.id);
            if (error) throw error;

            newWorkspace.name = '';
            await initialize(); // Перезагружаем все данные
        } catch (error) {
            console.error("Error creating workspace:", error);
            showAlert(`Не удалось создать рабочее пространство: ${error.message}`);
        }
    };

    const goBackToDashboard = () => {
        currentProject.value = null;
    };

    return {
        allWorkspaces,
        currentWorkspace,
        allProjects,
        currentProject,
        newProject,
        newWorkspace, // Экспортируем новое состояние
        initialize, // Главная функция для запуска
        selectWorkspace,
        createProject,
        createWorkspace, // Экспортируем новую функцию
        selectProject,
        goBackToDashboard,
    };
}