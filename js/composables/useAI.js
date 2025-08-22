import { reactive } from 'https://unpkg.com/vue@3/dist/vue.esm-browser.prod.js';
import { aiService, projectService } from '../services/supabaseService.js';

export function useAI(currentProject, currentProjectMembers) {
    const ai = reactive({
        loading: false,
        report: '',
        projectReportLoading: false,
        projectReport: '',
        taskHelperLoading: false,
        taskHelperSuggestion: '',
    });

    const formatReport = (report) => report.replace(/\n/g, '<br>').replace(/\* \s*/g, '<br>&bull; ');

    const getAiTaskHelper = async (helperType, task) => {
        ai.taskHelperLoading = true;
        ai.taskHelperSuggestion = '';
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
            ai.taskHelperSuggestion = formatReport(data.report);
        } catch (error) {
            console.error(`Error with AI task helper (${helperType}):`, error);
            ai.taskHelperSuggestion = `<p class='text-red-500'>Ошибка: ${error.message}</p>`;
        } finally {
            ai.taskHelperLoading = false;
        }
    };

    const getProjectAiAnalysis = async (analysisType) => {
        ai.projectReportLoading = true;
        ai.projectReport = '';
        try {
            if (!currentProject.value || !currentProjectMembers.value) {
                throw new Error("Данные по текущему проекту не загружены.");
            }
            const payload = {
                analysisType,
                allProjects: [currentProject.value],
                allUsers: currentProjectMembers.value,
                context: 'singleProject'
            };
            const { data, error } = await aiService.invoke(payload);
            if (error) throw error;
            ai.projectReport = formatReport(data.report);
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
            // 1. Fetch the most up-to-date and complete data for all projects
            const { data: allProjectsData, error: rpcError } = await projectService.fetchAllProjectDetailsForAdmin();
            if (rpcError) throw rpcError;

            // 2. Invoke the AI handler with the complete dataset
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

    // Resets AI state, e.g., when closing a modal or leaving a view
    const resetTaskHelper = () => {
        ai.taskHelperLoading = false;
        ai.taskHelperSuggestion = '';
    };

    const resetProjectReport = () => {
        ai.projectReportLoading = false;
        ai.projectReport = '';
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
