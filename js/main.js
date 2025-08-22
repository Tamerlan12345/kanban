import { createApp, onMounted, watch, reactive, computed } from 'https://unpkg.com/vue@3/dist/vue.esm-browser.prod.js';
import { useAuth, user as globalUser } from './composables/useAuth.js';
import { useProjects } from './composables/useProjects.js';
import { useKanban } from './composables/useKanban.js';
import { useAI } from './composables/useAI.js';
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
        } = useAI(currentProject, currentProjectMembers);

        // --- 2. Admin-specific Logic ---
        const admin = reactive({
            allUsers: [],
            newUser: { email: '', password: '' },
        });

        const fetchAllUsersForAdmin = async () => {
            if (user.role === 'projectAdmin') {
                try {
                    const { data, error } = await profileService.fetchAllUsers();
                    if (error) throw error;
                    admin.allUsers = data;
                } catch (error) {
                    console.error("Error fetching all users for admin:", error);
                    showAlert("Не удалось загрузить список пользователей.");
                }
            }
        };

        const createAdminUser = () => {
            showAlert('Функция создания пользователей в разработке.');
        };

        // --- 3. Lifecycle and Watchers ---
        // When auth state changes, fetch initial data
        watch(isAuthenticated, (isAuth) => {
            if (isAuth) {
                fetchProjects();
                fetchAllUsersForAdmin();
            } else {
                // Clear data on logout
                allProjects.value = [];
                admin.allUsers = [];
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
            goBackToDashboard,
            addColumn,
            getTasksForColumn,
            dragStart, dragOver, dragLeave, drop,

            // Task Modal
            taskModal,
            openTaskModal,
            closeTaskModal,
            saveTask,

            // AI
            ai,
            getAiTaskHelper: (type) => getAiTaskHelper(type, taskModal.data), // Pass current task data
            getProjectAiAnalysis,
            getGlobalAiAnalysis: (type) => getGlobalAiAnalysis(type, admin.allUsers), // Pass all users data

            // Admin
            admin,
            createUser: createAdminUser,

            // UI
            alert,
        };
    }
}).mount('#app');
