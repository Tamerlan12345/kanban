import supabaseClient from '../supabaseClient.js';

/**
 * =================================================================
 * Service for all interactions with the Supabase backend.
 * =================================================================
 */

// --- Auth ---
export const auth = {
    onAuthStateChange: (callback) => supabaseClient.auth.onAuthStateChange(callback),
    signIn: (email, password) => supabaseClient.auth.signInWithPassword({ email, password }),
    signOut: () => supabaseClient.auth.signOut(),
    getSession: () => supabaseClient.auth.getSession(),
};

// --- User Profile ---
export const profileService = {
    fetchUserProfile: (userId) => supabaseClient
        .from('profiles')
        .select('role')
        .eq('id', userId)
        .single(),
    fetchAllUsers: () => supabaseClient
        .from('profiles')
        .select('id, email, role'),
};

// --- Projects & Kanban Data ---
export const projectService = {
    // Fetches projects for the currently logged-in user
    fetchUserProjects: (userId) => supabaseClient.rpc('get_projects_for_user', { user_id: userId }),

    // Fetches all project details for the admin view
    fetchAllProjectDetailsForAdmin: () => supabaseClient.rpc('get_all_project_details_for_admin'),

    // Fetches the detailed view of a single project, including columns and tasks
    fetchProjectDetails: (projectId) => supabaseClient.rpc('get_project_details', { p_id: projectId }),

    // Fetches the members of a specific project
    fetchProjectMembers: (projectId) => supabaseClient
        .from('project_members')
        .select(`user_id, profiles (id, email, role)`)
        .eq('project_id', projectId),

    // Creates a new project with default columns
    createProject: async (title, ownerId) => {
        const { data: projectData, error: projectError } = await supabaseClient
            .from('projects')
            .insert({ title, owner_id: ownerId })
            .select()
            .single();
        if (projectError) throw projectError;

        await supabaseClient
            .from('project_members')
            .insert({ project_id: projectData.id, user_id: ownerId });

        const defaultColumns = [
            { title: 'Сделать', order: 1, project_id: projectData.id },
            { title: 'В процессе', order: 2, project_id: projectData.id },
            { title: 'Готово', order: 3, project_id: projectData.id },
        ];
        await supabaseClient.from('columns').insert(defaultColumns);

        return projectData;
    },
};

// --- Columns ---
export const columnService = {
    createColumn: (title, projectId, order) => supabaseClient
        .from('columns')
        .insert({ title, project_id: projectId, order })
        .select()
        .single(),
};

// --- Tasks ---
export const taskService = {
    createTask: (taskData) => supabaseClient
        .from('tasks')
        .insert(taskData)
        .select()
        .single(),

    updateTask: (taskId, updates) => supabaseClient
        .from('tasks')
        .update(updates)
        .eq('id', taskId)
        .select()
        .single(),

    moveTask: (taskId, newColumnId) => supabaseClient
        .from('tasks')
        .update({ column_id: newColumnId })
        .eq('id', taskId),
};

// --- AI / Edge Functions ---
export const aiService = {
    invoke: (payload) => supabaseClient.functions.invoke('ai-handler', { body: payload }),
};
