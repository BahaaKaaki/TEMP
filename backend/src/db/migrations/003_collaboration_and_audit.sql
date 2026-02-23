-- Migration: Collaboration and Audit
-- Created: 2024-12-13

-- ============================================
-- SLIDE COMMENTS
-- ============================================

CREATE TABLE slide_comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slide_id UUID NOT NULL REFERENCES slides(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id),
    parent_comment_id UUID REFERENCES slide_comments(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    -- Resolution
    is_resolved BOOLEAN DEFAULT FALSE,
    resolved_by UUID REFERENCES users(id),
    resolved_at TIMESTAMPTZ,
    -- Position (for inline comments)
    position_data JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_comments_slide ON slide_comments(slide_id);
CREATE INDEX idx_comments_user ON slide_comments(user_id);
CREATE INDEX idx_comments_parent ON slide_comments(parent_comment_id);

-- ============================================
-- BRAND ASSETS
-- ============================================

CREATE TABLE brand_assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL CHECK (type IN ('logo', 'icon', 'image', 'color_palette', 'font')),
    file_url TEXT,
    file_size BIGINT,
    mime_type VARCHAR(100),
    metadata JSONB DEFAULT '{}',
    tags TEXT[] DEFAULT '{}',
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_brand_assets_org ON brand_assets(organization_id);
CREATE INDEX idx_brand_assets_type ON brand_assets(organization_id, type);

-- ============================================
-- AI CONFIGURATIONS
-- ============================================

CREATE TABLE ai_configurations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    provider VARCHAR(50) NOT NULL CHECK (provider IN ('openai', 'gemini', 'claude', 'custom')),
    -- Encrypted API key (use application-level encryption)
    api_key_encrypted TEXT NOT NULL,
    api_endpoint TEXT,
    -- Configuration
    default_model VARCHAR(100),
    settings JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT TRUE,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_ai_config_org ON ai_configurations(organization_id);
CREATE UNIQUE INDEX idx_ai_config_org_provider ON ai_configurations(organization_id, provider) WHERE is_active = TRUE;

-- ============================================
-- AUDIT LOGS
-- ============================================

CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    -- Event details
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(100) NOT NULL,
    entity_id UUID,
    -- Change tracking
    old_values JSONB,
    new_values JSONB,
    -- Context
    ip_address INET,
    user_agent TEXT,
    session_id VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Partition-friendly indexes
CREATE INDEX idx_audit_logs_org_date ON audit_logs(organization_id, created_at);
CREATE INDEX idx_audit_logs_user_date ON audit_logs(user_id, created_at);
CREATE INDEX idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_logs_action ON audit_logs(action, created_at);

-- ============================================
-- USAGE METRICS
-- ============================================

CREATE TABLE usage_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    -- Metric details
    metric_type VARCHAR(100) NOT NULL,
    metric_value DECIMAL(20, 4) NOT NULL,
    metadata JSONB DEFAULT '{}',
    recorded_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_usage_metrics_org_type ON usage_metrics(organization_id, metric_type, recorded_at);
CREATE INDEX idx_usage_metrics_user ON usage_metrics(user_id, recorded_at);

-- ============================================
-- NOTIFICATIONS
-- ============================================

CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(100) NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT,
    data JSONB DEFAULT '{}',
    is_read BOOLEAN DEFAULT FALSE,
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_notifications_user ON notifications(user_id, is_read, created_at);

-- ============================================
-- TRIGGERS
-- ============================================

CREATE TRIGGER update_comments_updated_at
    BEFORE UPDATE ON slide_comments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_ai_config_updated_at
    BEFORE UPDATE ON ai_configurations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
