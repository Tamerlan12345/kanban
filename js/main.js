import { createApp, onMounted, watch, reactive, computed } from 'https://unpkg.com/vue@3/dist/vue.esm-browser.prod.js';
import { useAuth, user as globalUser } from './composables/useAuth.js';
import { useProjects } from './composables/useProjects.js';
import { useKanban } from './composables/useKanban.js';
import { useAI } from './composables/useAI.js';
import { useMembers } from './composables/useMembers.js';
import { usePersonalTasks } from './composables/usePersonalTasks.js';
import { profileService } from './services/supabaseService.js';

// --- A simple, app-wide notification system ---
const alert = reactive({
    isOpen: false,
    message: '',
});
const showAlert = (msg) => {
    alert.message = msg;
    alert.isOpen = true;
};

// --- VUE APPLICATION SETUP ---
createApp({
    setup() {
        // --- 1. Initialize Composables ---
        const {
            user,
            isAuthenticated,
            loginForm,
            login,
            logout,
        } = useAuth();

        const {
            allProjects,
            currentProject,
            currentProjectMembers,
            newProject,
            fetchProjects,
            createProject,
            selectProject,
            goBackToDashboard,
        } = useProjects();

        const {
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
        } = useKanban(currentProject);

        const {
            ai,
            getAiTaskHelper,
            getProjectAiAnalysis,
            getGlobalAiAnalysis,
            resetTaskHelper,
            resetProjectReport,
        } = useAI(currentProject, currentProjectMembers, showAlert);

        const {
            membersModal,
            openMembersModal,
            closeMembersModal,
            inviteMember,
            removeMember,
            updateMemberRole,
        } = useMembers(currentProject, currentProjectMembers, showAlert);

        const {
            personalTasks,
            newPersonalTaskTitle,
            fetchPersonalTasks,
            addPersonalTask,
            togglePersonalTask,
            deletePersonalTask,
        } = usePersonalTasks(showAlert);

        // Admin-specific logic is now handled by per-project roles.
        // The old global admin panel logic is removed.

        // --- 3. Lifecycle and Watchers ---
        // When auth state changes, fetch initial data
        watch(isAuthenticated, (isAuth) => {
            if (isAuth) {
                fetchProjects();
            } else {
                // Clear data on logout
                allProjects.value = [];
                currentProject.value = null;
            }
        });

        // When user navigates away from a project, clear the AI report
        watch(currentProject, (newVal) => {
            if (newVal === null) {
                resetProjectReport();
            }
        });

        // When task modal is closed, clear the AI helper suggestion
        watch(() => taskModal.isOpen, (isOpen) => {
            if (!isOpen) {
                resetTaskHelper();
            }
        });

        // When a new task is opened in the modal, fetch its personal tasks
        watch(() => taskModal.data?.id, (newTaskId) => {
            fetchPersonalTasks(newTaskId);
        });

        // --- 4. Expose to Template ---
        return {
            // Auth
            isAuthenticated,
            user, // Use the reactive user object
            loginForm,
            login,
            logout,

            // Projects & Dashboard
            userProjects: allProjects, // Renaming for template clarity
            allProjects,
            newProject,
            createProject,
            selectProject,

            // Kanban View
            currentProject,
            currentProjectMembers,
            goBackToDashboard,
            addColumn,
            getTasksForColumn,
            dragStart, dragOver, dragLeave, drop,

            // Task Modal
            handleSuggestion,
            taskModal,
            openTaskModal,
            closeTaskModal,
            saveTask,

            // Member Management Modal
            membersModal,
            openMembersModal,
            closeMembersModal,
            inviteMember,
            removeMember,
            updateMemberRole,

            // Personal Tasks
            personalTasks,
            newPersonalTaskTitle,
            addPersonalTask,
            togglePersonalTask,
            deletePersonalTask,

            // AI
            ai,
            getAiTaskHelper: (type) => getAiTaskHelper(type, taskModal.data), // Pass current task data
            getProjectAiAnalysis,

            // UI
            alert,
        };
    }
}).mount('#app');
