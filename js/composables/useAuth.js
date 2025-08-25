import { ref, reactive, onMounted } from 'https://unpkg.com/vue@3/dist/vue.esm-browser.prod.js';
import { auth, profileService } from '../services/supabaseService.js';

// A reactive store for the user's profile to be accessible across modules if needed.
export const user = reactive({
    id: null,
    email: null,
    role: 'user', // Default role
});

export function useAuth() {
    const isAuthenticated = ref(false);
    const loginForm = reactive({ email: '', password: '', error: '', loading: false });

    const handleAuthSuccess = async (session) => {
        isAuthenticated.value = true;
        user.id = session.user.id;
        user.email = session.user.email;
        await fetchUserProfile(session.user.id);
    };

    const handleAuthSignOut = () => {
        isAuthenticated.value = false;
        user.id = null;
        user.email = null;
        user.role = 'user';
    };

    const fetchUserProfile = async (userId) => {
        try {
            const { data, error } = await profileService.fetchUserProfile(userId);
            if (error && error.code !== 'PGRST116') { // PGRST116 = "No rows found"
                throw error;
            }
            user.role = data ? data.role : 'user';
        } catch (error) {
            console.error('Error fetching user profile:', error);
            user.role = 'user'; // Fallback to default role
        }
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
