import { ref, reactive } from 'https://unpkg.com/vue@3/dist/vue.esm-browser.prod.js';
import { projectService, workflowService, taskService, issueTypeService } from '../services/supabaseService.js';
import { user } from './useAuth.js'; // Import the reactive user object

export function useProjects(showAlert) {
    const allProjects = ref([]);
    const currentProject = ref(null);
    // currentProjectMembers is now derived from currentProject.value.members
    const newProject = reactive({ title: '' });

    const fetchProjects = async () => {
        if (!user.id) return;
        try {
            const { data, error } = await projectService.fetchUserProjects(user.id);
            if (error) throw error;
            allProjects.value = data;
        } catch (error) {
            console.error("Error fetching projects:", error);
            showAlert(`Не удалось загрузить проекты: ${error.message}`);
        }
    };

    const createProject = async () => {
        if (!newProject.title || !user.id) return;
        try {
            await projectService.createProject(newProject.title, user.id);
            await fetchProjects(); // Refresh the project list
            newProject.title = '';
        } catch (error) {
            console.error("Error creating project:", error);
            showAlert(`Не удалось создать проект: ${error.message}`);
        }
    };

    const selectProject = async (projectId) => {
        try {
            const projectData = allProjects.value.find(p => p.id === projectId);
            if (!projectData) throw new Error("Проект не найден");

            // Fetch members, workflow, tasks, and issue types in parallel
            const [
                { data: membersData, error: membersError },
                { data: workflowData, error: workflowError },
                { data: tasksData, error: tasksError },
                { data: issueTypesData, error: issueTypesError }
            ] = await Promise.all([
                projectService.fetchProjectMembers(projectId),
                workflowService.fetchWorkflowForProject(projectId),
                taskService.fetchTasksForProject(projectId),
                issueTypeService.fetchForProject(projectId)
            ]);

            if (membersError) throw membersError;
            if (workflowError) throw workflowError;
            if (tasksError) throw tasksError;
            if (issueTypesError) throw issueTypesError;

            // Combine all data into the currentProject object
            currentProject.value = {
                ...projectData,
                members: membersData.map(m => m.profiles).filter(p => p !== null),
                workflow: workflowData,
                tasks: tasksData || [],
                issueTypes: issueTypesData || []
            };

        } catch (error) {
            console.error("Error selecting project:", error);
            currentProject.value = null;
            showAlert(`Не удалось загрузить проект: ${error.message}`);
        }
    };

    const goBackToDashboard = () => {
        currentProject.value = null;
    };

    return {
        allProjects,
        currentProject,
        newProject,
        fetchProjects,
        createProject,
        selectProject,
        goBackToDashboard,
    };
}
