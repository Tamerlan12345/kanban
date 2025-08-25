import { ref, reactive } from 'https://unpkg.com/vue@3/dist/vue.esm-browser.prod.js';
import { projectService } from '../services/supabaseService.js';
import { user } from './useAuth.js'; // Import the reactive user object

export function useProjects(showAlert) { // showAlert is kept for now to avoid another reference error until all files are reverted
    const allProjects = ref([]);
    const currentProject = ref(null);
    const currentProjectMembers = ref([]);
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
            // Fetch project details and members in parallel
            const [
                { data: projectData, error: projectError },
                { data: membersData, error: membersError }
            ] = await Promise.all([
                projectService.fetchProjectDetails(projectId),
                projectService.fetchProjectMembers(projectId)
            ]);

            if (projectError) throw projectError;
            if (membersError) throw membersError;

            // Reverted: No per-project role logic.
            currentProject.value = projectData;

            // Reverted: Member list is simpler now.
            currentProjectMembers.value = membersData
                .map(m => m.profiles)
                .filter(p => p !== null);

        } catch (error) {
            console.error("Error selecting project:", error);
            currentProject.value = null;
            currentProjectMembers.value = [];
            showAlert(`Не удалось загрузить проект: ${error.message}`);
        }
    };

    const goBackToDashboard = () => {
        currentProject.value = null;
        currentProjectMembers.value = [];
    };

    return {
        allProjects,
        currentProject,
        currentProjectMembers,
        newProject,
        fetchProjects,
        createProject,
        selectProject,
        goBackToDashboard,
    };
}
