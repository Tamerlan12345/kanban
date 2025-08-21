import { createApp, ref, onMounted, reactive, computed } from 'https://unpkg.com/vue@3/dist/vue.esm-browser.prod.js';
import supabaseClient from './supabaseClient.js';

// --- ОСНОВНОЕ ПРИЛОЖЕНИЕ VUE ---
createApp({
    setup() {
        // --- СОСТОЯНИЕ ПРИЛОЖЕНИЯ ---
        const isAuthenticated = ref(false);
        const user = reactive({ id: null, email: null, role: 'user' }); // Default role
        const allUsers = ref([]);
        const allProjects = ref([]);
        const currentProject = ref(null);

        const loginForm = reactive({ email: '', password: '', error: '', loading: false });
        const newUser = reactive({ email: '', password: '' });
        const newProject = reactive({ title: '' });

        let draggedTaskId = null;

        // Modals & UI State
        const taskModal = reactive({ isOpen: false, isEditing: false, data: {} });
        const alert = reactive({ isOpen: false, message: '' });
        const ai = reactive({
            loading: false,
            report: '',
            taskHelperLoading: false,
            taskHelperSuggestion: ''
        });

        // --- ИНИЦИАЛИЗАЦИЯ ---
        onMounted(() => {
            // Проверяем состояние аутентификации при загрузке
            supabaseClient.auth.onAuthStateChange(async (event, session) => {
                if (session) {
                    isAuthenticated.value = true;
                    user.id = session.user.id;
                    user.email = session.user.email;
                    await fetchUserProfile(session.user.id);
                    await fetchData();
                } else {
                    isAuthenticated.value = false;
                    user.id = null;
                    user.email = null;
                    user.role = 'user';
                    allProjects.value = [];
                    allUsers.value = [];
                    currentProject.value = null;
                }
            });
        });

        // --- ЗАГРУЗКА ДАННЫХ ИЗ SUPABASE ---
        async function fetchUserProfile(userId) {
            try {
                const { data, error } = await supabaseClient
                    .from('profiles')
                    .select('role')
                    .eq('id', userId)
                    .single();
                if (error) throw error;
                if (data) {
                    user.role = data.role;
                }
            } catch (error) {
                console.error('Error fetching user profile:', error);
                showAlert('Не удалось загрузить профиль пользователя.');
            }
        }

        async function fetchData() {
            if (!user.id) return;
            await fetchProjects();
            if (user.role === 'projectAdmin') {
                await fetchAllUsers();
            }
        }

        async function fetchProjects() {
            try {
                const { data, error } = await supabaseClient.rpc('get_projects_for_user', { user_id: user.id });
                if (error) throw error;
                allProjects.value = data;
            } catch (error) {
                console.error("Error fetching projects:", error);
                showAlert("Не удалось загрузить проекты.");
            }
        }

        async function fetchAllUsers() {
            try {
                const { data, error } = await supabaseClient.from('profiles').select('id, email, role');
                if (error) throw error;
                allUsers.value = data;
            } catch (error) {
                console.error("Error fetching users:", error);
                showAlert("Не удалось загрузить список пользователей.");
            }
        }

        // --- АУТЕНТИФИКАЦИЯ ---
        async function login() {
            loginForm.error = '';
            loginForm.loading = true;
            try {
                const { error } = await supabaseClient.auth.signInWithPassword({
                    email: loginForm.email,
                    password: loginForm.password,
                });
                if (error) throw error;
                // onAuthStateChange обработает успешный вход
            } catch (error) {
                loginForm.error = 'Неверный email или пароль.';
                console.error('Login error:', error);
            } finally {
                loginForm.loading = false;
            }
        }

        async function logout() {
            try {
                const { error } = await supabaseClient.auth.signOut();
                if (error) throw error;
            } catch (error) {
                console.error('Logout error:', error);
                showAlert('Ошибка при выходе из системы.');
            }
        }

        // --- ЛОГИКА АДМИН-ПАНЕЛИ ---
        async function createUser() {
            // В реальном приложении это должна быть защищенная функция
            showAlert('Функция создания пользователей в разработке.');
        }

        async function createProject() {
            if (!newProject.title) return;
            try {
                // 1. Создаем проект
                const { data: projectData, error: projectError } = await supabaseClient
                    .from('projects')
                    .insert({ title: newProject.title, owner_id: user.id })
                    .select()
                    .single();
                if (projectError) throw projectError;

                // 2. Добавляем админа как участника
                const { error: memberError } = await supabaseClient
                    .from('project_members')
                    .insert({ project_id: projectData.id, user_id: user.id });
                if (memberError) throw memberError;

                // 3. Создаем колонки по умолчанию
                const defaultColumns = [
                    { title: 'Сделать', order: 1, project_id: projectData.id },
                    { title: 'В процессе', order: 2, project_id: projectData.id },
                    { title: 'Готово', order: 3, project_id: projectData.id },
                ];
                const { error: columnsError } = await supabaseClient.from('columns').insert(defaultColumns);
                if (columnsError) throw columnsError;

                await fetchProjects(); // Обновляем список проектов
                newProject.title = '';
            } catch (error) {
                console.error("Error creating project:", error);
                showAlert("Не удалось создать проект.");
            }
        }

        // --- ЛОГИКА КАНБАН-ДОСКИ ---
        async function selectProject(projectId) {
            try {
                const { data, error } = await supabaseClient.rpc('get_project_details', { p_id: projectId });
                if (error) throw error;
                currentProject.value = data;
            } catch (error) {
                console.error("Error selecting project:", error);
                showAlert("Не удалось загрузить данные проекта.");
                currentProject.value = null;
            }
        }

        function goBackToDashboard() {
            currentProject.value = null;
        }

        async function addColumn() {
            const title = prompt("Название новой колонки:");
            if (title && title.trim() && currentProject.value) {
                try {
                    const newOrder = currentProject.value.columns.length > 0 ? Math.max(...currentProject.value.columns.map(c => c.order)) + 1 : 1;
                    const { data, error } = await supabaseClient
                        .from('columns')
                        .insert({ title: title.trim(), order: newOrder, project_id: currentProject.value.id })
                        .select()
                        .single();
                    if (error) throw error;
                    currentProject.value.columns.push(data);
                } catch (error) {
                    console.error("Error adding column:", error);
                    showAlert("Не удалось добавить колонку.");
                }
            }
        }

        // --- УПРАВЛЕНИЕ ЗАДАЧАМИ ---
        function openTaskModal(columnId, taskId = null) {
            if (taskId && currentProject.value) {
                const taskData = currentProject.value.tasks.find(t => t.id === taskId);
                taskModal.data = { ...taskData };
                taskModal.isEditing = true;
            } else {
                taskModal.data = { column_id: columnId, title: '', description: '', priority: 'medium', project_id: currentProject.value.id };
                taskModal.isEditing = false;
            }
            taskModal.isOpen = true;
        }

        function closeTaskModal() {
            taskModal.isOpen = false;
            ai.taskHelperSuggestion = '';
            ai.taskHelperLoading = false;
        }

        async function saveTask() {
            if (!currentProject.value) return;
            try {
                if (taskModal.isEditing) {
                    const { data, error } = await supabaseClient
                        .from('tasks')
                        .update({
                            title: taskModal.data.title,
                            description: taskModal.data.description,
                            priority: taskModal.data.priority
                        })
                        .eq('id', taskModal.data.id)
                        .select()
                        .single();
                    if (error) throw error;
                    // Обновляем задачу в локальном состоянии
                    const taskIndex = currentProject.value.tasks.findIndex(t => t.id === data.id);
                    if (taskIndex !== -1) currentProject.value.tasks[taskIndex] = data;

                } else {
                    const { data, error } = await supabaseClient
                        .from('tasks')
                        .insert({ ...taskModal.data })
                        .select()
                        .single();
                    if (error) throw error;
                    currentProject.value.tasks.push(data);
                }
                taskModal.isOpen = false;
            } catch(error) {
                console.error("Error saving task:", error);
                showAlert("Не удалось сохранить задачу.");
            }
        }

        // --- DRAG & DROP ---
        function dragStart(event, taskId) { draggedTaskId = taskId; }
        function dragOver(event) { event.currentTarget.classList.add('drag-over'); }
        function dragLeave(event) { event.currentTarget.classList.remove('drag-over'); }
        async function drop(event, newColumnId) {
            event.currentTarget.classList.remove('drag-over');
            if (draggedTaskId && currentProject.value) {
                try {
                    const { error } = await supabaseClient
                        .from('tasks')
                        .update({ column_id: newColumnId })
                        .eq('id', draggedTaskId);
                    if (error) throw error;
                    // Обновляем локально для мгновенного отклика
                    const task = currentProject.value.tasks.find(t => t.id === draggedTaskId);
                    if (task) task.column_id = newColumnId;
                    draggedTaskId = null;
                } catch(error) {
                    console.error("Error moving task:", error);
                    showAlert("Не удалось переместить задачу.");
                }
            }
        }

        // --- ИИ-АНАЛИТИКА ---
        async function getAiTaskHelper(helperType) {
            ai.taskHelperLoading = true;
            ai.taskHelperSuggestion = '';

            try {
                const { data: { session } } = await supabaseClient.auth.getSession();
                if (!session) throw new Error("Пользователь не авторизован.");

                // Собираем релевантные данные для помощника
                const payload = {
                    analysisType: helperType,
                    task: taskModal.data,
                    // Передаем только email пользователей, чтобы не слать лишнего
                    projectMembers: allUsers.value.map(u => u.email)
                };

                const { data, error } = await supabaseClient.functions.invoke('ai-handler', {
                    body: payload,
                });

                if (error) throw error;

                ai.taskHelperSuggestion = data.report.replace(/\n/g, '<br>').replace(/\* \s*/g, '<br>&bull; ');

            } catch(error) {
                ai.taskHelperSuggestion = `<p class='text-red-500'>Ошибка: ${error.message}</p>`;
            } finally {
                ai.taskHelperLoading = false;
            }
        }

        async function getAiAnalysis(analysisType) {
            ai.loading = true;
            ai.report = '';

            // Для ИИ-анализа нам нужны полные данные, которые есть только у админа
            // В будущем можно сделать так, чтобы обычные пользователи могли анализировать свои проекты
            if (user.role !== 'projectAdmin') {
                showAlert('Аналитика доступна только для администратора проекта.');
                ai.loading = false;
                return;
            }

            try {
                // Получаем текущую сессию для передачи токена авторизации
                const { data: { session } } = await supabaseClient.auth.getSession();
                if (!session) {
                    throw new Error("Пользователь не авторизован.");
                }

                // 1. Получаем самые свежие и полные данные по всем проектам
                const { data: allProjectsData, error: rpcError } = await supabaseClient.rpc('get_all_project_details_for_admin');
                if (rpcError) throw rpcError;

                // 2. Вызываем нашу Edge Function с полными данными
                const { data, error } = await supabaseClient.functions.invoke('ai-handler', {
                    body: {
                        analysisType,
                        allUsers: allUsers.value,
                        allProjects: allProjectsData // Используем свежие и полные данные
                    },
                });

                if (error) throw error;

                // Отображаем отчет, полученный от функции
                ai.report = data.report.replace(/\n/g, '<br>').replace(/\* \s*/g, '<br>&bull; ');

            } catch (error) {
                console.error("Error invoking Edge Function:", error);
                ai.report = `<p class='text-red-500'>Ошибка при вызове ИИ-аналитики: ${error.message}</p>`;
            } finally {
                ai.loading = false;
            }
        }

        function showAlert(msg) {
            alert.message = msg;
            alert.isOpen = true;
        }

        // --- ВЫЧИСЛЯЕМЫЕ СВОЙСТВА ---
        const userProjects = computed(() => {
            // Эта логика теперь обрабатывается на сервере через RPC `get_projects_for_user`
            return allProjects.value;
        });

        return {
            isAuthenticated, user, allUsers, allProjects, loginForm, newUser, newProject,
            login, logout, createUser, createProject,
            userProjects, currentProject, selectProject, goBackToDashboard,
            taskModal, openTaskModal, saveTask, addColumn,
            dragStart, dragOver, dragLeave, drop,
            alert, ai, getAiAnalysis, getAiTaskHelper, closeTaskModal,
            // Для v-if в HTML
            currentProjectTasks: computed(() => currentProject.value ? currentProject.value.tasks : []),
            currentProjectColumns: computed(() => currentProject.value ? currentProject.value.columns : []),
            getTasksForColumn: (columnId) => {
                return currentProject.value?.tasks.filter(t => t.column_id === columnId) || [];
            }
        };
    }
}).mount('#app');
