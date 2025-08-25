import { reactive } from 'https://unpkg.com/vue@3/dist/vue.esm-browser.prod.js';
import { projectService, profileService } from '../services/supabaseService.js';
import { user } from './useAuth.js';

export function useMembers(currentProject, currentProjectMembers, showAlert) {
    const membersModal = reactive({
        isOpen: false,
        newUser: { email: '', role: 'member' },
    });

    const openMembersModal = () => membersModal.isOpen = true;
    const closeMembersModal = () => membersModal.isOpen = false;

    const inviteMember = async () => {
        if (!membersModal.newUser.email || !currentProject.value) return;

        try {
            // 1. Find user by email to get their ID
            const { data: profile, error: profileError } = await profileService.findProfileByEmail(membersModal.newUser.email);
            if (profileError || !profile) {
                showAlert('Пользователь с таким email не найден.');
                throw new Error('Profile not found for email: ' + membersModal.newUser.email);
            }

            // Check if user is already a member
            if (currentProjectMembers.value.some(m => m.id === profile.id)) {
                showAlert('Этот пользователь уже является участником проекта.');
                return;
            }

            // 2. Add member to project
            const { data: newMember, error: addError } = await projectService.addMember(
                currentProject.value.id,
                profile.id,
                membersModal.newUser.role
            );
            if (addError) throw addError;

            // 3. Update UI
            currentProjectMembers.value.push({
                id: newMember.profiles.id,
                email: newMember.profiles.email,
                role: newMember.role,
            });

            membersModal.newUser.email = '';
            membersModal.newUser.role = 'member';
            showAlert('Пользователь успешно добавлен!');

        } catch (error) {
            console.error('Error inviting member:', error);
            // Alert is already shown for not found user.
        }
    };

    const removeMember = async (memberToRemove) => {
        // Prevent removing self
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

    const updateMemberRole = async (memberToUpdate) => {
        // Prevent changing own role
        if (memberToUpdate.id === user.id) {
            showAlert('Вы не можете изменить свою собственную роль.');
            // Revert UI change
            const originalMember = currentProjectMembers.value.find(m => m.id === memberToUpdate.id);
            if(originalMember) memberToUpdate.role = originalMember.role;
            return;
        }

        try {
            const { error } = await projectService.updateMemberRole(
                currentProject.value.id,
                memberToUpdate.id,
                memberToUpdate.role
            );
            if (error) throw error;
            showAlert(`Роль для ${memberToUpdate.email} обновлена.`);
        } catch (error) {
            console.error('Error updating role:', error);
            showAlert('Не удалось обновить роль.');
            // Revert UI change on error
            const originalMember = currentProjectMembers.value.find(m => m.id === memberToUpdate.id);
            if(originalMember) memberToUpdate.role = originalMember.role;
        }
    };

    return {
        membersModal,
        openMembersModal,
        closeMembersModal,
        inviteMember,
        removeMember,
        updateMemberRole,
    };
}
