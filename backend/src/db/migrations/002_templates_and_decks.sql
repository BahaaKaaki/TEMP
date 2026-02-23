-- Migration: Templates and Decks
-- Created: 2024-12-13

-- ============================================
-- TEMPLATE CATEGORIES
-- ============================================

CREATE TABLE template_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(100) NOT NULL,
    description TEXT,
    display_order INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_template_categories_org ON template_categories(organization_id);

-- ============================================
-- SLIDE MASTERS
-- ============================================

CREATE TABLE slide_masters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    master_id VARCHAR(50) NOT NULL,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    layout JSONB NOT NULL DEFAULT '{}',
    styles JSONB NOT NULL DEFAULT '{}',
    is_system BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_slide_masters_org ON slide_masters(organization_id);

-- ============================================
-- TEMPLATES
-- ============================================

CREATE TABLE templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    category_id UUID REFERENCES template_categories(id) ON DELETE SET NULL,
    master_id UUID REFERENCES slide_masters(id) ON DELETE SET NULL,
    -- Template identification
    template_key VARCHAR(100) NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    note TEXT,
    type VARCHAR(100),
    -- Content
    html_content TEXT NOT NULL,
    pptx_renderer_code TEXT,
    thumbnail_url TEXT,
    -- Versioning
    version INT DEFAULT 1,
    is_published BOOLEAN DEFAULT TRUE,
    is_system BOOLEAN DEFAULT FALSE,
    -- Metadata
    tags TEXT[] DEFAULT '{}',
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_templates_org ON templates(organization_id);
CREATE INDEX idx_templates_category ON templates(category_id);
CREATE INDEX idx_templates_key ON templates(template_key);
CREATE INDEX idx_templates_search ON templates USING GIN(tags);
CREATE INDEX idx_templates_system ON templates(is_system) WHERE is_system = TRUE;

-- ============================================
-- TEMPLATE VERSIONS
-- ============================================

CREATE TABLE template_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id UUID NOT NULL REFERENCES templates(id) ON DELETE CASCADE,
    version INT NOT NULL,
    html_content TEXT NOT NULL,
    pptx_renderer_code TEXT,
    change_summary TEXT,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_template_versions_template ON template_versions(template_id);

-- ============================================
-- DECKS
-- ============================================

CREATE TABLE decks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    team_id UUID REFERENCES teams(id) ON DELETE SET NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    -- Sharing
    visibility VARCHAR(50) DEFAULT 'private' CHECK (visibility IN ('private', 'team', 'organization', 'public')),
    share_token VARCHAR(100) UNIQUE,
    -- Content
    shared_css TEXT DEFAULT '',
    storyline JSONB DEFAULT '[]',
    -- Status
    status VARCHAR(50) DEFAULT 'draft' CHECK (status IN ('draft', 'review', 'approved', 'archived')),
    -- Metadata
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_decks_org ON decks(organization_id);
CREATE INDEX idx_decks_team ON decks(team_id);
CREATE INDEX idx_decks_creator ON decks(created_by);
CREATE INDEX idx_decks_share_token ON decks(share_token) WHERE share_token IS NOT NULL;

-- ============================================
-- SLIDES
-- ============================================

CREATE TABLE slides (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    deck_id UUID NOT NULL REFERENCES decks(id) ON DELETE CASCADE,
    template_id UUID REFERENCES templates(id) ON DELETE SET NULL,
    -- Content
    title VARCHAR(500),
    type VARCHAR(100),
    html_content TEXT NOT NULL,
    custom_css TEXT DEFAULT '',
    pptx_export_code TEXT,
    summary TEXT,
    -- Positioning
    position INT NOT NULL DEFAULT 0,
    parent_id UUID REFERENCES slides(id) ON DELETE SET NULL,
    -- Storyline link
    story_point_id VARCHAR(100),
    -- State
    is_skeleton BOOLEAN DEFAULT FALSE,
    skeleton_approved BOOLEAN DEFAULT FALSE,
    -- Metadata
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_slides_deck ON slides(deck_id);
CREATE INDEX idx_slides_position ON slides(deck_id, position);
CREATE INDEX idx_slides_template ON slides(template_id);

-- ============================================
-- SLIDE VERSIONS
-- ============================================

CREATE TABLE slide_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slide_id UUID NOT NULL REFERENCES slides(id) ON DELETE CASCADE,
    version INT NOT NULL,
    html_content TEXT NOT NULL,
    custom_css TEXT,
    change_summary TEXT,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_slide_versions_slide ON slide_versions(slide_id);

-- ============================================
-- DECK VERSIONS (Snapshots)
-- ============================================

CREATE TABLE deck_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    deck_id UUID NOT NULL REFERENCES decks(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    version_number INT NOT NULL,
    snapshot JSONB NOT NULL,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_deck_versions_deck ON deck_versions(deck_id);

-- ============================================
-- DECK SHARES
-- ============================================

CREATE TABLE deck_shares (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    deck_id UUID NOT NULL REFERENCES decks(id) ON DELETE CASCADE,
    shared_with_user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    shared_with_team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
    permission VARCHAR(50) DEFAULT 'view' CHECK (permission IN ('view', 'comment', 'edit')),
    shared_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CHECK (shared_with_user_id IS NOT NULL OR shared_with_team_id IS NOT NULL)
);

CREATE INDEX idx_deck_shares_deck ON deck_shares(deck_id);
CREATE INDEX idx_deck_shares_user ON deck_shares(shared_with_user_id);
CREATE INDEX idx_deck_shares_team ON deck_shares(shared_with_team_id);

-- ============================================
-- TRIGGERS
-- ============================================

CREATE TRIGGER update_templates_updated_at
    BEFORE UPDATE ON templates
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_decks_updated_at
    BEFORE UPDATE ON decks
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_slides_updated_at
    BEFORE UPDATE ON slides
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_slide_masters_updated_at
    BEFORE UPDATE ON slide_masters
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
