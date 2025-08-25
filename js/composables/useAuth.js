import { ref, reactive, onMounted } from 'https://unpkg.com/vue@3/dist/vue.esm-browser.prod.js';
import { auth, profileService } from '../services/supabaseService.js';

// A reactive store for the user's profile to be accessible across modules if needed.
export const user = reactive({
    id: null,
    email: null,
    // role is no longer global, it's per-project
});

export function useAuth() {
    const isAuthenticated = ref(false);
    const loginForm = reactive({ email: '', password: '', error: '', loading: false });

    const checkSession = async () => {
        const { data: { session } } = await auth.getSession();
        if (session) {
            await handleAuthSuccess(session);
        } else {
            handleAuthSignOut();
        }
    };

    const handleAuthSuccess = async (session) => {
        isAuthenticated.value = true;
        user.id = session.user.id;
        user.email = session.user.email;
        // No longer fetching global role
    };

    const handleAuthSignOut = () => {
        isAuthenticated.value = false;
        user.id = null;
        user.email = null;
        // No longer setting global role
    };

    const login = async () => {
        loginForm.error = '';
        loginForm.loading = true;
        try {
            const { error } = await auth.signIn(loginForm.email, loginForm.password);
            if (error) throw error;
            // onAuthStateChange will trigger handleAuthSuccess
        } catch (error) {
            loginForm.error = 'Неверный email или пароль.';
            console.error('Login error:', error);
        } finally {
            loginForm.loading = false;
        }
    };

    const logout = async () => {
        try {
            const { error } = await auth.signOut();
            if (error) throw error;
            handleAuthSignOut(); // Force UI update immediately
        } catch (error) {
            console.error('Logout error:', error);
            // Optionally, notify the user here.
        }
    };

    onMounted(() => {
        auth.onAuthStateChange((event, session) => {
            if (session) {
                handleAuthSuccess(session);
            } else {
                handleAuthSignOut();
            }
        });
    });

    return {
        user,
        isAuthenticated,
        loginForm,
        login,
        logout,
    };
}
