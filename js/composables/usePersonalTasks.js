import { ref } from 'https://unpkg.com/vue@3/dist/vue.esm-browser.prod.js';
import { personalTaskService } from '../services/supabaseService.js';
import { user } from './useAuth.js';

export function usePersonalTasks(showAlert) {
    const personalTasks = ref([]);
    const newPersonalTaskTitle = ref('');

    const fetchPersonalTasks = async (projectTaskId) => {
        if (!projectTaskId) {
            personalTasks.value = [];
            return;
        }
        try {
            const { data, error } = await personalTaskService.fetchForProjectTask(projectTaskId);
            if (error) throw error;
            personalTasks.value = data;
        } catch (error) {
            console.error('Error fetching personal tasks:', error);
            personalTasks.value = [];
        }
    };

    const addPersonalTask = async (projectTaskId) => {
        if (!newPersonalTaskTitle.value.trim() || !projectTaskId) return;
        try {
            const taskData = {
                owner_id: user.id,
                linked_project_task_id: projectTaskId,
                title: newPersonalTaskTitle.value.trim(),
                is_completed: false,
            };
            const { data, error } = await personalTaskService.create(taskData);
            if (error) throw error;
            personalTasks.value.push(data);
            newPersonalTaskTitle.value = '';
        } catch (error) {
            console.error('Error creating personal task:', error);
            showAlert('Не удалось создать персональную задачу.');
        }
    };

    const togglePersonalTask = async (task) => {
        try {
            const { data: updatedTask, error } = await personalTaskService.update(task.id, { is_completed: !task.is_completed });
            if (error) throw error;
            const index = personalTasks.value.findIndex(t => t.id === task.id);
            if (index !== -1) {
                personalTasks.value[index] = updatedTask;
            }
        } catch (error) {
            console.error('Error updating personal task:', error);
            showAlert('Не удалось обновить статус задачи.');
            // Revert on error
            task.is_completed = !task.is_completed;
        }
    };

    const deletePersonalTask = async (taskId) => {
        try {
            const { error } = await personalTaskService.delete(taskId);
            if (error) throw error;
            personalTasks.value = personalTasks.value.filter(t => t.id !== taskId);
        } catch (error) {
            console.error('Error deleting personal task:', error);
            showAlert('Не удалось удалить задачу.');
        }
    };

    return {
        personalTasks,
        newPersonalTaskTitle,
        fetchPersonalTasks,
        addPersonalTask,
        togglePersonalTask,
        deletePersonalTask,
    };
}
