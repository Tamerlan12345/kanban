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
// Reverting to use the global role from the 'profiles' table.
export const profileService = {
    fetchUserProfile: (userId) => supabaseClient
        .from('profiles')
        .select('role')
        .eq('id', userId)
        .single(),
    fetchAllUsers: () => supabaseClient
        .from('profiles')
        .select('id, email, role'),
    findProfileByEmail: (email) => supabaseClient
        .from('profiles')
        .select('id')
        .eq('email', email)
        .single(),
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
        .select(`user_id, profiles (id, email, role)`) // Reverted to get role from profiles
        .eq('project_id', projectId),

    // Creates a new project with a default workflow and statuses
    createProject: async (title, ownerId) => {
        // 1. Create the project
        const { data: project, error: projectError } = await supabaseClient
            .from('projects')
            .insert({ title, owner_id: ownerId })
            .select()
            .single();
        if (projectError) throw projectError;

        // 2. Add owner as a member
        await supabaseClient
            .from('project_members')
            .insert({ project_id: project.id, user_id: ownerId });

        // 3. Create a default workflow for the project
        const { data: workflow, error: workflowError } = await supabaseClient
            .from('workflows')
            .insert({ name: 'Основной рабочий процесс', project_id: project.id })
            .select()
            .single();
        if (workflowError) throw workflowError;

        // 4. Create default statuses for the workflow
        const defaultStatuses = [
            { name: 'Сделать', order: 1, workflow_id: workflow.id },
            { name: 'В процессе', order: 2, workflow_id: workflow.id },
            { name: 'Готово', order: 3, workflow_id: workflow.id },
        ];
        const { error: statusesError } = await supabaseClient.from('statuses').insert(defaultStatuses);
        if (statusesError) throw statusesError;

        return project;
    },

    // Reverted: addMember no longer handles roles.
    addMember: (projectId, userId) => supabaseClient
        .from('project_members')
        .insert({ project_id: projectId, user_id: userId })
        .select(`*, profiles (id, email)`)
        .single(),

    removeMember: (projectId, userId) => supabaseClient
        .from('project_members')
        .delete()
        .eq('project_id', projectId)
        .eq('user_id', userId),

    // Reverted: updateMemberRole function removed as it's invalid without a role column.
};

// --- Workflows, Statuses (New) ---

export const workflowService = {
    // Fetches the workflow and its statuses for a project
    fetchWorkflowForProject: async (projectId) => {
        const { data, error } = await supabaseClient
            .from('workflows')
            .select(`
                *,
                statuses (*)
            `)
            .eq('project_id', projectId)
            .single();
        if (error) throw error;
        // Sort statuses by their order
        if (data && data.statuses) {
            data.statuses.sort((a, b) => a.order - b.order);
        }
        return { data, error };
    }
};

export const statusService = {
    createStatus: (statusData) => supabaseClient
        .from('statuses')
        .insert(statusData)
        .select()
        .single(),
};


// --- Issue Types (New) ---
export const issueTypeService = {
    fetchForProject: (projectId) => supabaseClient
        .from('issue_types')
        .select('*')
        .eq('project_id', projectId)
        .order('name'),

    create: (issueTypeData) => supabaseClient
        .from('issue_types')
        .insert(issueTypeData)
        .select()
        .single(),

    update: (issueTypeId, updates) => supabaseClient
        .from('issue_types')
        .update(updates)
        .eq('id', issueTypeId)
        .select()
        .single(),

    delete: (issueTypeId) => supabaseClient
        .from('issue_types')
        .delete()
        .eq('id', issueTypeId),
};

// --- Tasks ---
export const taskService = {
    fetchTasksForProject: (projectId) => supabaseClient
        .from('tasks')
        .select('*')
        .eq('project_id', projectId),

    createTask: (taskData) => {
        // Ensure tasks are created with `status_id`, not `column_id`
        const { column_id, ...rest } = taskData;
        if (column_id) { // In case old data is passed, convert it
            rest.status_id = column_id;
        }
        return supabaseClient
            .from('tasks')
            .insert(rest)
            .select()
            .single();
    },

    updateTask: (taskId, updates) => supabaseClient
        .from('tasks')
        .update(updates)
        .eq('id', taskId)
        .select()
        .single(),

    moveTask: (taskId, newStatusId) => supabaseClient
        .from('tasks')
        .update({ status_id: newStatusId }) // Changed from column_id to status_id
        .eq('id', taskId),
};

// --- Personal Tasks ---
export const personalTaskService = {
    fetchForProjectTask: (projectTaskId) => supabaseClient
        .from('personal_tasks')
        .select('*')
        .eq('linked_project_task_id', projectTaskId)
        .order('created_at'),

    create: (taskData) => supabaseClient
        .from('personal_tasks')
        .insert(taskData)
        .select()
        .single(),

    update: (taskId, updates) => supabaseClient
        .from('personal_tasks')
        .update(updates)
        .eq('id', taskId)
        .select()
        .single(),

    delete: (taskId) => supabaseClient
        .from('personal_tasks')
        .delete()
        .eq('id', taskId),
};

// --- AI Suggestions (for approval flow) ---
export const aiSuggestionService = {
    createSuggestion: (suggestionData) => supabaseClient
        .from('ai_suggestions')
        .insert(suggestionData)
        .select()
        .single(),

    updateSuggestionStatus: (suggestionId, status) => supabaseClient
        .from('ai_suggestions')
        .update({ status })
        .eq('id', suggestionId)
        .select()
        .single(),

    fetchSuggestionsForTask: (taskId) => supabaseClient
        .from('ai_suggestions')
        .select('*')
        .eq('task_id', taskId),

    countSuggestions: ({ task_ids, status, type }) => {
        let query = supabaseClient
            .from('ai_suggestions')
            .select('id', { count: 'exact', head: true });

        if (task_ids) {
            query = query.in('task_id', task_ids);
        }
        if (status) {
            query = query.eq('status', status);
        }
        if (type) {
            query = query.eq('type', type);
        }
        return query;
    },
};

// --- AI / Edge Functions ---
export const aiService = {
    invoke: (payload) => supabaseClient.functions.invoke('ai-handler', { body: payload }),
};
