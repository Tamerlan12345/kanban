import { reactive } from 'https://unpkg.com/vue@3/dist/vue.esm-browser.prod.js';
import { projectService, profileService } from '../services/supabaseService.js';
import { user } from './useAuth.js';

export function useMembers(currentProject, currentProjectMembers, showAlert) {
    const membersModal = reactive({
        isOpen: false,
        newUser: { email: '' }, // Reverted: role removed
    });

    const openMembersModal = () => membersModal.isOpen = true;
    const closeMembersModal = () => membersModal.isOpen = false;

    const inviteMember = async () => {
        if (!membersModal.newUser.email || !currentProject.value) return;

        try {
            const { data: profile, error: profileError } = await profileService.findProfileByEmail(membersModal.newUser.email);
            if (profileError || !profile) {
                showAlert('Пользователь с таким email не найден.');
                throw new Error('Profile not found for email: ' + membersModal.newUser.email);
            }

            if (currentProjectMembers.value.some(m => m.id === profile.id)) {
                showAlert('Этот пользователь уже является участником проекта.');
                return;
            }

            // Reverted: No longer passing role
            const { data: newMember, error: addError } = await projectService.addMember(
                currentProject.value.id,
                profile.id
            );
            if (addError) throw addError;

            // The member list from useProjects already contains the global role from profiles
            currentProjectMembers.value.push(newMember.profiles);

            membersModal.newUser.email = '';
            showAlert('Пользователь успешно добавлен!');

        } catch (error) {
            console.error('Error inviting member:', error);
        }
    };

    const removeMember = async (memberToRemove) => {
        if (memberToRemove.id === user.id) {
            showAlert('Вы не можете удалить самого себя из проекта.');
            return;
        }

        if (!confirm(`Вы уверены, что хотите удалить ${memberToRemove.email} из проекта?`)) return;

        try {
            const { error } = await projectService.removeMember(currentProject.value.id, memberToRemove.id);
            if (error) throw error;

            currentProjectMembers.value = currentProjectMembers.value.filter(m => m.id !== memberToRemove.id);
            showAlert('Пользователь удален.');
        } catch (error) {
            console.error('Error removing member:', error);
            showAlert('Не удалось удалить пользователя.');
        }
    };

    // Reverted: updateMemberRole removed.

    return {
        membersModal,
        openMembersModal,
        closeMembersModal,
        inviteMember,
        removeMember,
    };
}
