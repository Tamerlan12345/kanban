-- Enable pgcrypto extension for UUID generation if not already enabled
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Create schemas
CREATE SCHEMA IF NOT EXISTS app_auth;
CREATE SCHEMA IF NOT EXISTS app_projects;
CREATE SCHEMA IF NOT EXISTS app_tasks;
CREATE SCHEMA IF NOT EXISTS app_analytics;
CREATE SCHEMA IF NOT EXISTS app_ai;

-- =============================================
-- Schema 1: app_auth - Authentication and Users
-- =============================================

CREATE TABLE app_auth.organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  domain VARCHAR(100) UNIQUE,
  settings JSONB DEFAULT '{}',
  subscription_tier VARCHAR(50) DEFAULT 'basic',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE app_auth.users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  full_name VARCHAR(255) NOT NULL,
  avatar_url TEXT,
  organization_id UUID REFERENCES app_auth.organizations(id) ON DELETE CASCADE,
  role VARCHAR(50) NOT NULL CHECK (role IN ('admin', 'team_lead', 'senior', 'middle', 'junior', 'observer')),
  department VARCHAR(100),
  ai_assistant_mode VARCHAR(50) DEFAULT 'general',
  preferences JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_login TIMESTAMPTZ
);

CREATE INDEX idx_users_org ON app_auth.users(organization_id);
CREATE INDEX idx_users_role ON app_auth.users(role);

-- =============================================
-- Schema 2: app_projects - Projects and Boards
-- =============================================

CREATE TABLE app_projects.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES app_auth.organizations(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  project_type VARCHAR(50) CHECK (project_type IN ('insurance', 'development', 'analytics', 'operations')),
  status VARCHAR(50) DEFAULT 'active',
  owner_id UUID REFERENCES app_auth.users(id),
  start_date DATE,
  end_date DATE,
  budget DECIMAL(12,2),
  ai_insights JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE app_projects.boards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES app_projects.projects(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  board_type VARCHAR(50) DEFAULT 'kanban',
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE app_projects.board_columns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id UUID REFERENCES app_projects.boards(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  position FLOAT NOT NULL,
  wip_limit INTEGER,
  color VARCHAR(7),
  automation_rules JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_columns_board ON app_projects.board_columns(board_id);
CREATE INDEX idx_columns_position ON app_projects.board_columns(board_id, position);

-- =============================================
-- Schema 3: app_tasks - Tasks and Cards
-- =============================================

CREATE TABLE app_tasks.tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id UUID REFERENCES app_projects.boards(id) ON DELETE CASCADE,
  column_id UUID REFERENCES app_projects.board_columns(id) ON DELETE SET NULL,
  organization_id UUID REFERENCES app_auth.organizations(id) ON DELETE CASCADE,
  title VARCHAR(500) NOT NULL,
  description TEXT,
  task_type VARCHAR(50) CHECK (task_type IN ('feature', 'bug', 'improvement', 'research', 'documentation')),
  priority VARCHAR(20) DEFAULT 'P3' CHECK (priority IN ('P1', 'P2', 'P3', 'P4')),
  status VARCHAR(50) DEFAULT 'todo',
  weight FLOAT NOT NULL DEFAULT 65536,
  estimated_hours DECIMAL(6,2),
  ai_predicted_hours DECIMAL(6,2),
  actual_hours DECIMAL(6,2),
  complexity_score INTEGER CHECK (complexity_score BETWEEN 1 AND 10),
  due_date TIMESTAMPTZ,
  created_by UUID REFERENCES app_auth.users(id),
  assigned_to UUID REFERENCES app_auth.users(id),
  parent_task_id UUID REFERENCES app_tasks.tasks(id),
  ai_decomposition JSONB DEFAULT '[]',
  ai_suggestions JSONB DEFAULT '[]',
  tags TEXT[] DEFAULT '{}',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE TABLE app_tasks.task_relations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_task_id UUID REFERENCES app_tasks.tasks(id) ON DELETE CASCADE,
  target_task_id UUID REFERENCES app_tasks.tasks(id) ON DELETE CASCADE,
  relation_type VARCHAR(50) CHECK (relation_type IN ('blocks', 'blocked_by', 'relates_to', 'duplicates', 'subtask_of')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(source_task_id, target_task_id, relation_type)
);

CREATE TABLE app_tasks.comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID REFERENCES app_tasks.tasks(id) ON DELETE CASCADE,
  user_id UUID REFERENCES app_auth.users(id),
  content TEXT NOT NULL,
  ai_generated BOOLEAN DEFAULT FALSE,
  mentions UUID[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_tasks_board ON app_tasks.tasks(board_id);
CREATE INDEX idx_tasks_column ON app_tasks.tasks(column_id);
CREATE INDEX idx_tasks_assigned ON app_tasks.tasks(assigned_to);
CREATE INDEX idx_tasks_weight ON app_tasks.tasks(column_id, weight);
CREATE INDEX idx_tasks_org ON app_tasks.tasks(organization_id);

-- =============================================
-- Schema 4: app_analytics - Analytics and KPI
-- =============================================

CREATE TABLE app_analytics.team_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES app_auth.organizations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES app_auth.users(id) ON DELETE CASCADE,
  project_id UUID REFERENCES app_projects.projects(id) ON DELETE CASCADE,
  metric_date DATE NOT NULL,
  tasks_completed INTEGER DEFAULT 0,
  tasks_created INTEGER DEFAULT 0,
  avg_completion_time DECIMAL(6,2),
  velocity_score DECIMAL(6,2),
  quality_score DECIMAL(4,2),
  collaboration_score DECIMAL(4,2),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, project_id, metric_date)
);

CREATE TABLE app_analytics.kpis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES app_auth.organizations(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  kpi_type VARCHAR(50) CHECK (kpi_type IN ('velocity', 'quality', 'efficiency', 'delivery', 'custom')),
  target_value DECIMAL(10,2),
  current_value DECIMAL(10,2),
  measurement_period VARCHAR(50) DEFAULT 'monthly',
  calculation_formula TEXT,
  responsible_user_id UUID REFERENCES app_auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE app_analytics.ai_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES app_auth.organizations(id) ON DELETE CASCADE,
  insight_type VARCHAR(50) CHECK (insight_type IN ('risk', 'opportunity', 'bottleneck', 'prediction', 'recommendation')),
  entity_type VARCHAR(50),
  entity_id UUID,
  title VARCHAR(500) NOT NULL,
  description TEXT,
  confidence_score DECIMAL(4,3),
  priority VARCHAR(20),
  status VARCHAR(50) DEFAULT 'new',
  ai_model_version VARCHAR(50),
  generated_at TIMESTAMPTZ DEFAULT NOW(),
  acknowledged_by UUID REFERENCES app_auth.users(id),
  acknowledged_at TIMESTAMPTZ
);

CREATE INDEX idx_metrics_user ON app_analytics.team_metrics(user_id, metric_date);
CREATE INDEX idx_metrics_project ON app_analytics.team_metrics(project_id, metric_date);
CREATE INDEX idx_insights_org ON app_analytics.ai_insights(organization_id, generated_at);

-- =============================================
-- Schema 5: app_ai - AI Configurations and Prompts
-- =============================================

CREATE TABLE app_ai.assistants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  assistant_type VARCHAR(50) CHECK (assistant_type IN ('business_analyst', 'task_decomposer', 'admin_analytics', 'code_reviewer', 'risk_assessor')),
  description TEXT,
  system_prompt TEXT NOT NULL,
  model_config JSONB DEFAULT '{"model": "gemini-1.5-pro", "temperature": 0.7}',
  available_for_roles TEXT[] DEFAULT '{}',
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE app_ai.ai_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES app_auth.organizations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES app_auth.users(id),
  assistant_id UUID REFERENCES app_ai.assistants(id),
  request_type VARCHAR(50),
  input_data JSONB NOT NULL,
  output_data JSONB,
  tokens_used INTEGER,
  processing_time_ms INTEGER,
  status VARCHAR(50) DEFAULT 'pending',
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_ai_requests_user ON app_ai.ai_requests(user_id, created_at);
CREATE INDEX idx_ai_requests_org ON app_ai.ai_requests(organization_id, created_at);

-- =============================================
-- Row Level Security (RLS) Policies
-- =============================================

ALTER TABLE app_tasks.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_analytics.team_metrics ENABLE ROW LEVEL SECURITY;

-- Policy for tasks: users can view tasks in their organization
CREATE POLICY "Users can view tasks in their organization"
ON app_tasks.tasks FOR SELECT
USING (organization_id IN (
  SELECT organization_id FROM app_auth.users WHERE id = auth.uid()
));

-- Policy for editing: only assigned or creators
CREATE POLICY "Users can update their assigned tasks"
ON app_tasks.tasks FOR UPDATE
USING (
  assigned_to = auth.uid() OR
  created_by = auth.uid() OR
  EXISTS (
    SELECT 1 FROM app_auth.users
    WHERE id = auth.uid() AND role IN ('admin', 'team_lead')
  )
);

-- Policy for analytics: only admin and team_lead
CREATE POLICY "Analytics access for leaders"
ON app_analytics.team_metrics FOR SELECT
USING (
  user_id = auth.uid() OR
  EXISTS (
    SELECT 1 FROM app_auth.users
    WHERE id = auth.uid() AND role IN ('admin', 'team_lead')
    AND organization_id = team_metrics.organization_id
  )
);

-- =============================================
-- Functions
-- =============================================

-- Weight-based card positioning algorithm
CREATE OR REPLACE FUNCTION app_tasks.reposition_task(
  task_id UUID,
  new_column_id UUID,
  new_position INTEGER
) RETURNS FLOAT AS $$
DECLARE
  lower_bound FLOAT;
  upper_bound FLOAT;
  new_weight FLOAT;
BEGIN
  IF new_position < 2 THEN
    -- First position
    lower_bound := 0;
    SELECT MIN(weight) INTO upper_bound
    FROM app_tasks.tasks WHERE column_id = new_column_id;
    IF upper_bound IS NULL THEN upper_bound := 65536; END IF;
  ELSE
    -- Between existing
    SELECT weight INTO lower_bound
    FROM app_tasks.tasks
    WHERE column_id = new_column_id
    ORDER BY weight
    LIMIT 1 OFFSET (new_position - 1);

    IF lower_bound IS NULL THEN lower_bound := 0; END IF;
    upper_bound := 131072;
  END IF;

  new_weight := lower_bound + (upper_bound - lower_bound) / 2;

  UPDATE app_tasks.tasks
  SET weight = new_weight, column_id = new_column_id, updated_at = NOW()
  WHERE id = task_id;

  RETURN new_weight;
END;
$$ LANGUAGE plpgsql;
