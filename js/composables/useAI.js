import { reactive } from 'https://unpkg.com/vue@3/dist/vue.esm-browser.prod.js';
import { aiService, projectService, aiSuggestionService } from '../services/supabaseService.js';
import { user } from './useAuth.js';

export function useAI(currentProject, currentProjectMembers, showAlert) {
    const ai = reactive({
        loading: false,
        report: '',
        projectReportLoading: false,
        projectReport: '',
        projectMetrics: {}, // For quantitative metrics
        taskHelperLoading: false,
        taskHelperSuggestion: '', // This will be deprecated
    });

    const formatReport = (report) => report.replace(/\n/g, '<br>').replace(/\* \s*/g, '<br>&bull; ');

    const getAiTaskHelper = async (helperType, task) => {
        ai.taskHelperLoading = true;
        try {
            if (!currentProjectMembers.value || currentProjectMembers.value.length === 0) {
                throw new Error("Список участников проекта пуст или не был загружен.");
            }
            const payload = {
                analysisType: helperType,
                task: task,
                projectMembers: currentProjectMembers.value.map(u => u.email)
            };
            const { data, error } = await aiService.invoke(payload);
            if (error) throw error;

            const suggestionData = {
                task_id: task.id,
                suggester_id: user.id,
                content: data.report,
                status: 'pending',
                type: helperType,
            };
            const { error: createError } = await aiSuggestionService.createSuggestion(suggestionData);
            if (createError) throw createError;

            showAlert('Предложение ИИ отправлено на рассмотрение. Оно появится в задаче после перезагрузки.');

        } catch (error) {
            console.error(`Error with AI task helper (${helperType}):`, error);
            showAlert(`Ошибка ИИ-помощника: ${error.message}`);
        } finally {
            ai.taskHelperLoading = false;
        }
    };

    const getProjectAiAnalysis = async (analysisType) => {
        ai.projectReportLoading = true;
        ai.projectReport = '';
        ai.projectMetrics = {}; // Reset metrics

        try {
            if (!currentProject.value || !currentProjectMembers.value) {
                throw new Error("Данные по текущему проекту не загружены.");
            }

            // --- Fetch text-based AI analysis ---
            const analysisPayload = {
                analysisType,
                allProjects: [currentProject.value],
                allUsers: currentProjectMembers.value,
                context: 'singleProject'
            };
            const aiAnalysisPromise = aiService.invoke(analysisPayload);

            // --- Fetch quantitative metrics ---
            const task_ids = currentProject.value?.tasks?.map(t => t.id) || [];
            let decompositionCountPromise;
            if (task_ids.length > 0) {
                 decompositionCountPromise = aiSuggestionService.countSuggestions({
                    task_ids,
                    status: 'approved',
                    type: 'decompose'
                });
            } else {
                // Resolve with a compatible structure if there are no tasks
                decompositionCountPromise = Promise.resolve({ count: 0, error: null });
            }

            // --- Await all results ---
            const [
                { data: analysisData, error: analysisError },
                { count: decompCount, error: countError }
            ] = await Promise.all([aiAnalysisPromise, decompositionCountPromise]);

            if (analysisError) throw analysisError;
            if (countError) throw countError;

            // --- Update state ---
            ai.projectReport = formatReport(analysisData.report);
            ai.projectMetrics.decomposition_count = decompCount;

        } catch (error) {
            console.error(`Error with AI project analysis (${analysisType}):`, error);
            ai.projectReport = `<p class='text-red-500'>Ошибка: ${error.message}</p>`;
        } finally {
            ai.projectReportLoading = false;
        }
    };

    // This function is for the admin panel, to analyze ALL projects
    const getGlobalAiAnalysis = async (analysisType, allUsers) => {
        ai.loading = true;
        ai.report = '';
        try {
            const { data: allProjectsData, error: rpcError } = await projectService.fetchAllProjectDetailsForAdmin();
            if (rpcError) throw rpcError;

            const payload = {
                analysisType,
                allUsers: allUsers,
                allProjects: allProjectsData,
                context: 'allProjects'
            };
            const { data, error } = await aiService.invoke(payload);
            if (error) throw error;
            ai.report = formatReport(data.report);
        } catch (error) {
            console.error(`Error with global AI analysis (${analysisType}):`, error);
            ai.report = `<p class='text-red-500'>Ошибка: ${error.message}</p>`;
        } finally {
            ai.loading = false;
        }
    };

    const resetTaskHelper = () => {
        ai.taskHelperLoading = false;
        ai.taskHelperSuggestion = '';
    };

    const resetProjectReport = () => {
        ai.projectReportLoading = false;
        ai.projectReport = '';
        ai.projectMetrics = {};
    };

    return {
        ai,
        getAiTaskHelper,
        getProjectAiAnalysis,
        getGlobalAiAnalysis,
        resetTaskHelper,
        resetProjectReport,
    };
}
