import supabaseClient from '../supabaseClient.js';

/**
 * =================================================================
 * Service for all interactions with the Supabase backend (Quantum Version)
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
        .select('id, email, role') // Expanded to get more profile data
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

// --- Workspaces ---
export const workspaceService = {
    create: (name, ownerId) => supabaseClient
        .from('workspaces')
        .insert({ name, owner_id: ownerId })
        .select()
        .single(),
    // TODO: This needs a proper RLS policy or RPC function to get all workspaces for a user.
    // For now, fetching all workspaces, assuming RLS will handle security.
    fetchAll: () => supabaseClient
        .from('workspaces')
        .select('*'),
};

// --- Teams ---
export const teamService = {
    create: (name, workspaceId) => supabaseClient
        .from('teams')
        .insert({ name, workspace_id: workspaceId })
        .select()
        .single(),
    addMember: (teamId, userId) => supabaseClient
        .from('team_members')
        .insert({ team_id: teamId, user_id: userId }),
    removeMember: (teamId, userId) => supabaseClient
        .from('team_members')
        .delete()
        .eq('team_id', teamId)
        .eq('user_id', userId),
    fetchForWorkspace: (workspaceId) => supabaseClient
        .from('teams')
        .select('*, team_members(*, profiles(id, email))')
        .eq('workspace_id', workspaceId),
};

// --- Projects ---
export const projectService = {
    // Fetches projects for a given workspace
    fetchForWorkspace: (workspaceId) => supabaseClient
        .from('projects')
        .select('*')
        .eq('workspace_id', workspaceId),

    // Fetches the detailed view of a single project, including statuses and tasks
    fetchProjectDetails: (projectId) => supabaseClient
        .from('projects')
        .select(`
            *,
            workflows (*, statuses (*)),
            tasks (*)
        `)
        .eq('id', projectId)
        .single(),

    // Creates a new project within a workspace
    createProject: async (title, ownerId, workspaceId, teamId = null) => {
        // 1. Create the project
        const { data: project, error: projectError } = await supabaseClient
            .from('projects')
            .insert({ title, owner_id: ownerId, workspace_id: workspaceId, team_id: teamId })
            .select()
            .single();
        if (projectError) throw projectError;

        // 2. Create a default workflow for the project
        const { data: workflow, error: workflowError } = await supabaseClient
            .from('workflows')
            .insert({ name: 'Основной рабочий процесс', project_id: project.id })
            .select()
            .single();
        if (workflowError) throw workflowError;

        // 3. Create default statuses for the workflow
        const defaultStatuses = [
            { name: 'Сделать', order: 1, workflow_id: workflow.id },
            { name: 'В процессе', order: 2, workflow_id: workflow.id },
            { name: 'Готово', order: 3, workflow_id: workflow.id },
        ];
        const { error: statusesError } = await supabaseClient.from('statuses').insert(defaultStatuses);
        if (statusesError) throw statusesError;

        return project;
    },
};

// --- Workflows & Statuses ---
export const workflowService = {
    fetchWorkflowForProject: async (projectId) => {
        const { data, error } = await supabaseClient
            .from('workflows')
            .select(`*, statuses (*)`)
            .eq('project_id', projectId)
            .single();
        if (error) throw error;
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

// --- Issue Types ---
export const issueTypeService = {
    fetchForProject: (projectId) => supabaseClient.from('issue_types').select('*').eq('project_id', projectId).order('name'),
    create: (issueTypeData) => supabaseClient.from('issue_types').insert(issueTypeData).select().single(),
    update: (issueTypeId, updates) => supabaseClient.from('issue_types').update(updates).eq('id', issueTypeId).select().single(),
    delete: (issueTypeId) => supabaseClient.from('issue_types').delete().eq('id', issueTypeId),
};

// --- Tasks & Dependencies ---
export const taskService = {
    fetchTasksForProject: (projectId) => supabaseClient
        .from('tasks')
        .select('*, task_dependencies!task_id(*)') // Fetch dependencies
        .eq('project_id', projectId),

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

    moveTask: (taskId, newStatusId) => supabaseClient
        .from('tasks')
        .update({ status_id: newStatusId })
        .eq('id', taskId),

    addDependency: (taskId, dependsOnTaskId, type) => supabaseClient
        .from('task_dependencies')
        .insert({ task_id: taskId, depends_on_task_id: dependsOnTaskId, type: type }),

    removeDependency: (taskId, dependsOnTaskId) => supabaseClient
        .from('task_dependencies')
        .delete()
        .eq('task_id', taskId)
        .eq('depends_on_task_id', dependsOnTaskId),
};

// --- Personal Tasks ---
export const personalTaskService = {
    fetchForProjectTask: (projectTaskId) => supabaseClient.from('personal_tasks').select('*').eq('linked_project_task_id', projectTaskId).order('created_at'),
    create: (taskData) => supabaseClient.from('personal_tasks').insert(taskData).select().single(),
    update: (taskId, updates) => supabaseClient.from('personal_tasks').update(updates).eq('id', taskId).select().single(),
    delete: (taskId) => supabaseClient.from('personal_tasks').delete().eq('id', taskId),
};

// --- AI Suggestions ---
export const aiSuggestionService = {
    createSuggestion: (suggestionData) => supabaseClient.from('ai_suggestions').insert(suggestionData).select().single(),
    updateSuggestionStatus: (suggestionId, status) => supabaseClient.from('ai_suggestions').update({ status }).eq('id', suggestionId).select().single(),
    fetchSuggestionsForTask: (taskId) => supabaseClient.from('ai_suggestions').select('*').eq('task_id', taskId),
    countSuggestions: ({ task_ids, status, type }) => {
        let query = supabaseClient.from('ai_suggestions').select('id', { count: 'exact', head: true });
        if (task_ids) query = query.in('task_id', task_ids);
        if (status) query = query.eq('status', status);
        if (type) query = query.eq('type', type);
        return query;
    },
};

// --- AI / Edge Functions ---
export const aiService = {
    invoke: (payload) => supabaseClient.functions.invoke('ai-handler', { body: payload }),
};