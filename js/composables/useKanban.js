import { reactive, computed } from 'https://unpkg.com/vue@3/dist/vue.esm-browser.prod.js';
import { columnService, taskService } from '../services/supabaseService.js';

export function useKanban(currentProject) {
    const taskModal = reactive({
        isOpen: false,
        isEditing: false,
        data: {},
    });

    let draggedTaskId = null;

    const getTasksForColumn = (columnId) => {
        // Return the filtered array directly. Reactivity is handled by Vue because
        // it tracks the dependency on `currentProject.value.tasks` within the template.
        return currentProject.value?.tasks.filter(t => t.column_id === columnId) || [];
    };

    const addColumn = async () => {
        const title = prompt("Название новой колонки:");
        if (title && title.trim() && currentProject.value) {
            try {
                const newOrder = currentProject.value.columns.length > 0
                    ? Math.max(...currentProject.value.columns.map(c => c.order)) + 1
                    : 1;
                const { data, error } = await columnService.createColumn(title.trim(), currentProject.value.id, newOrder);
                if (error) throw error;
                currentProject.value.columns.push(data);
            } catch (error) {
                console.error("Error adding column:", error);
                // Notify user
            }
        }
    };

    const openTaskModal = (columnId, taskId = null) => {
        if (taskId && currentProject.value) {
            const taskData = currentProject.value.tasks.find(t => t.id === taskId);
            taskModal.data = { ...taskData };
            taskModal.isEditing = true;
        } else {
            taskModal.data = {
                column_id: columnId,
                title: '',
                description: '',
                priority: 'medium',
                project_id: currentProject.value.id
            };
            taskModal.isEditing = false;
        }
        taskModal.isOpen = true;
    };

    const closeTaskModal = () => {
        taskModal.isOpen = false;
        taskModal.data = {};
    };

    const saveTask = async () => {
        if (!currentProject.value) return;
        try {
            let savedTask;
            if (taskModal.isEditing) {
                const { id, created_at, project_id, column_id, ...updates } = taskModal.data;
                const { data, error } = await taskService.updateTask(id, updates);
                if (error) throw error;
                savedTask = data;
                const taskIndex = currentProject.value.tasks.findIndex(t => t.id === savedTask.id);
                if (taskIndex !== -1) currentProject.value.tasks[taskIndex] = savedTask;
            } else {
                const { data, error } = await taskService.createTask(taskModal.data);
                if (error) throw error;
                savedTask = data;
                currentProject.value.tasks.push(savedTask);
            }
            closeTaskModal();
        } catch (error) {
            console.error("Error saving task:", error);
            // Notify user
        }
    };

    // --- Drag & Drop ---
    const dragStart = (event, taskId) => {
        draggedTaskId = taskId;
        event.dataTransfer.effectAllowed = 'move';
    };

    const dragOver = (event) => {
        event.currentTarget.classList.add('drag-over');
    };

    const dragLeave = (event) => {
        event.currentTarget.classList.remove('drag-over');
    };

    const drop = async (event, newColumnId) => {
        event.currentTarget.classList.remove('drag-over');
        if (draggedTaskId && currentProject.value) {
            const task = currentProject.value.tasks.find(t => t.id === draggedTaskId);
            if (task && task.column_id !== newColumnId) {
                const originalColumnId = task.column_id;
                task.column_id = newColumnId; // Optimistic update
                try {
                    const { error } = await taskService.moveTask(draggedTaskId, newColumnId);
                    if (error) {
                        task.column_id = originalColumnId; // Revert on error
                        throw error;
                    }
                } catch (error) {
                    console.error("Error moving task:", error);
                    // Notify user
                }
            }
            draggedTaskId = null;
        }
    };

    return {
        taskModal,
        openTaskModal,
        closeTaskModal,
        saveTask,
        addColumn,
        getTasksForColumn,
        dragStart,
        dragOver,
        dragLeave,
        drop,
    };
}
