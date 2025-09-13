import { reactive } from 'https://unpkg.com/vue@3/dist/vue.esm-browser.prod.js';
import { statusService, taskService, aiSuggestionService } from '../services/supabaseService.js';

export function useKanban(currentProject, showAlert) {
    const taskModal = reactive({
        isOpen: false,
        isEditing: false,
        data: {},
        suggestions: [],
    });

    let draggedTaskId = null;

    // Refactored to work with statuses and show only top-level tasks
    const getTasksForStatus = (statusId) => {
        return currentProject.value?.tasks.filter(t => t.status_id === statusId && t.parent_id === null) || [];
    };

    // Refactored to add a status instead of a column
    const addStatus = async () => {
        const name = prompt("Название нового статуса:");
        if (name && name.trim() && currentProject.value?.workflow) {
            try {
                const workflow = currentProject.value.workflow;
                const newOrder = workflow.statuses.length > 0
                    ? Math.max(...workflow.statuses.map(s => s.order)) + 1
                    : 1;

                const { data, error } = await statusService.createStatus({
                    name: name.trim(),
                    workflow_id: workflow.id,
                    order: newOrder
                });

                if (error) throw error;
                currentProject.value.workflow.statuses.push(data);
            } catch (error) {
                console.error("Error adding status:", error);
                showAlert(`Не удалось добавить статус: ${error.message}`);
            }
        }
    };

    // Refactored to use status_id
    const openTaskModal = async (statusId, taskId = null) => {
        taskModal.suggestions = []; // Clear old suggestions on open
        if (taskId && currentProject.value) {
            const taskData = currentProject.value.tasks.find(t => t.id === taskId);
            taskModal.data = { ...taskData };
            taskModal.isEditing = true;

            // Fetch AI suggestions for this task
            try {
                const { data, error } = await aiSuggestionService.fetchSuggestionsForTask(taskId);
                if (error) throw error;
                taskModal.suggestions = data;
            } catch (error) {
                console.error("Error fetching suggestions:", error);
                taskModal.suggestions = [];
            }

        } else {
            // Set default issue type if available
            const defaultTypeId = currentProject.value?.issueTypes?.[0]?.id || null;
            taskModal.data = {
                status_id: statusId,
                title: '',
                description: '',
                priority: 'medium',
                project_id: currentProject.value.id,
                issue_type_id: defaultTypeId,
                parent_id: null // Add parent_id for hierarchy
            };
            taskModal.isEditing = false;
        }
        taskModal.isOpen = true;
    };

    const closeTaskModal = () => {
        taskModal.isOpen = false;
        taskModal.data = {};
        taskModal.suggestions = [];
    };

    const handleSuggestion = async (suggestion, newStatus) => {
        try {
            const { data: updatedSuggestion, error } = await aiSuggestionService.updateSuggestionStatus(suggestion.id, newStatus);
            if (error) throw error;

            const index = taskModal.suggestions.findIndex(s => s.id === suggestion.id);
            if (index !== -1) {
                taskModal.suggestions[index] = updatedSuggestion;
            }

            // If an AI decomposition is approved, create the sub-tasks
            if (suggestion.type === 'decompose' && newStatus === 'approved' && currentProject.value) {
                const parentTask = taskModal.data;
                // Assuming content is a list of titles, separated by newlines from a plain text response.
                // A more robust implementation might expect structured data like JSON.
                const subtaskTitles = suggestion.content.split('\n').filter(title => title.trim() !== '');

                for (const title of subtaskTitles) {
                    const newSubtaskData = {
                        title: title.trim(),
                        project_id: parentTask.project_id,
                        parent_id: parentTask.id,
                        status_id: parentTask.status_id, // Default to parent's status
                        priority: 'medium',
                        issue_type_id: null, // Or a default sub-task type if one exists
                        description: ''
                    };
                    const { data: newSubtask, error: createError } = await taskService.createTask(newSubtaskData);
                    if (createError) throw createError;

                    // Optimistically add to the project's task list to update UI
                    currentProject.value.tasks.push(newSubtask);
                }
            }
        } catch (error) {
            console.error(`Error updating suggestion status to ${newStatus}:`, error);
            showAlert(`Не удалось обработать предложение: ${error.message}`);
        }
    };

    // Refactored to handle status_id
    const saveTask = async () => {
        if (!currentProject.value) return;
        try {
            let savedTask;
            if (taskModal.isEditing) {
                // Ensure we don't try to update column_id if it exists from old data
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
            showAlert(`Не удалось сохранить задачу: ${error.message}`);
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

    // Refactored for statuses
    const drop = async (event, newStatusId) => {
        event.currentTarget.classList.remove('drag-over');
        if (draggedTaskId && currentProject.value) {
            const task = currentProject.value.tasks.find(t => t.id === draggedTaskId);
            if (task && task.status_id !== newStatusId) {
                const originalStatusId = task.status_id;
                task.status_id = newStatusId; // Optimistic update
                try {
                    const { error } = await taskService.moveTask(draggedTaskId, newStatusId);
                    if (error) {
                        task.status_id = originalStatusId; // Revert on error
                        throw error;
                    }
                } catch (error) {
                    console.error("Error moving task:", error);
                    showAlert(`Не удалось переместить задачу: ${error.message}`);
                }
            }
            draggedTaskId = null;
        }
    };

    const openSubTaskModal = (parentTaskId) => {
        const parentTask = currentProject.value?.tasks.find(t => t.id === parentTaskId);
        if (!parentTask) return;

        // Open the modal to create a new task, but with the parent_id set
        const defaultTypeId = currentProject.value?.issueTypes?.[0]?.id || null;
        taskModal.data = {
            status_id: parentTask.status_id, // Default to same status as parent
            title: '',
            description: '',
            priority: 'medium',
            project_id: currentProject.value.id,
            issue_type_id: defaultTypeId,
            parent_id: parentTaskId
        };
        taskModal.isEditing = false;
        taskModal.suggestions = [];
        taskModal.isOpen = true;
    };

    return {
        taskModal,
        openTaskModal,
        openSubTaskModal,
        closeTaskModal,
        saveTask,
        addStatus,
        getTasksForStatus,
        handleSuggestion,
        dragStart,
        dragOver,
        dragLeave,
        drop,
    };
}
