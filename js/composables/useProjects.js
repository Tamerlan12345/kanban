import { ref, reactive } from 'https://unpkg.com/vue@3/dist/vue.esm-browser.prod.js';
import { projectService } from '../services/supabaseService.js';
import { user } from './useAuth.js'; // Import the reactive user object

export function useProjects() {
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
            // Notify user
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
            // Notify user
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

            // Find the current user's role for this specific project
            const currentUserMembership = membersData.find(m => m.user_id === user.id);
            const currentUserRole = currentUserMembership ? currentUserMembership.role : null;

            currentProject.value = { ...projectData, currentUserRole };

            // Map members to include their roles
            currentProjectMembers.value = membersData
                .map(m => ({ ...m.profiles, role: m.role })) // Combine profile with project-specific role
                .filter(p => p.id !== null); // Filter out invalid profiles

        } catch (error) {
            console.error("Error selecting project:", error);
            currentProject.value = null;
            currentProjectMembers.value = [];
            // Notify user
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
