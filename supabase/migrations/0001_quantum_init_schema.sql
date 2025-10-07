-- =================================================================
-- Migration: Quantum Initial Schema
-- Description: Sets up the necessary tables and types for the Quantum PM Platform.
-- Version: 0001
-- =================================================================

BEGIN;

-- 1. Новая иерархия сущностей
-- 1.1. Организация (Workspace)
CREATE TABLE IF NOT EXISTS public.workspaces (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    owner_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);
COMMENT ON TABLE public.workspaces IS 'Global container for all projects and teams.';

-- 1.2. Команда (Team)
CREATE TABLE IF NOT EXISTS public.teams (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now()
);
COMMENT ON TABLE public.teams IS 'Groups of users assigned to projects.';

-- 1.3. Связующая таблица для команд и пользователей
CREATE TABLE IF NOT EXISTS public.team_members (
    team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    PRIMARY KEY (team_id, user_id)
);
COMMENT ON TABLE public.team_members IS 'Joins teams and users.';

-- 1.4. Расширение таблицы Проектов (Projects)
ALTER TABLE public.projects
ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS team_id uuid REFERENCES public.teams(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.projects.workspace_id IS 'The workspace this project belongs to.';
COMMENT ON COLUMN public.projects.team_id IS 'The team assigned to this project.';


-- 1.5. Расширение таблицы Задач (Tasks) для поддержки иерархии
ALTER TABLE public.tasks
ADD COLUMN IF NOT EXISTS parent_id uuid REFERENCES public.tasks(id) ON DELETE CASCADE;

COMMENT ON COLUMN public.tasks.parent_id IS 'Self-referencing key for task hierarchy (Epic -> Task -> Sub-task).';


-- 1.6. Таблица Зависимостей Задач (Task Dependencies)
CREATE TABLE IF NOT EXISTS public.task_dependencies (
    task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
    depends_on_task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('blocks', 'is_blocked_by')),
    PRIMARY KEY (task_id, depends_on_task_id)
);
COMMENT ON TABLE public.task_dependencies IS 'Stores dependencies between tasks.';


-- 2. Обновленная ролевая модель
-- 2.1. Создание нового типа ENUM для ролей
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'app_role') THEN
        CREATE TYPE public.app_role AS ENUM (
            'Owner',
            'Admin',
            'Project Manager',
            'Team Lead',
            'Member',
            'Observer'
        );
    END IF;
END$$;

-- 2.2. Обновление таблицы `profiles`
-- Сначала удаляем старый столбец `role`, если он существует и имеет тип text
ALTER TABLE public.profiles
DROP COLUMN IF EXISTS role;

-- Теперь добавляем новый столбец с типом app_role
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS role public.app_role NOT NULL DEFAULT 'Member';

COMMENT ON COLUMN public.profiles.role IS 'User role within the application, defining permissions.';


-- 3. Таблицы для аналитики и AI
-- 3.1. История изменений задач
CREATE TABLE IF NOT EXISTS public.task_history (
    id BIGSERIAL PRIMARY KEY,
    task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
    changed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    changed_at TIMESTAMPTZ DEFAULT now(),
    field_changed TEXT NOT NULL,
    old_value TEXT,
    new_value TEXT
);
COMMENT ON TABLE public.task_history IS 'Logs all changes to tasks for auditing and AI analysis.';

-- 3.2. Ежедневные срезы досок
CREATE TABLE IF NOT EXISTS public.daily_snapshots (
    id BIGSERIAL PRIMARY KEY,
    project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    snapshot_date DATE NOT NULL DEFAULT CURRENT_DATE,
    data JSONB NOT NULL,
    UNIQUE(project_id, snapshot_date)
);
COMMENT ON TABLE public.daily_snapshots IS 'Daily snapshots of project boards for training predictive models.';


COMMIT;