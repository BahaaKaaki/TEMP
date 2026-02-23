# Template/Vibe Bundle System - Implementation Plan

## Executive Summary

Transform the current system from "templates + CSS vibes" to "professionally designed template bundles per vibe". Each vibe will have 4-5 carefully crafted template variations that are solid, production-ready designs.

## Current State

### Templates (~50 total)
- Generic HTML templates in `slideTemplates.js`
- Single design per template type
- PPTX export code embedded as strings
- Vibes applied via CSS `data-vibe` attribute

### Vibes (5 total)
- **default**: Base Strategy& styling
- **bold**: Impact-focused, stronger visual weight
- **corporate**: Formal structure, traditional business
- **creative**: Dynamic layouts, visual storytelling
- **data**: Dark dashboard aesthetics

### Problem
- CSS-only vibes can only change colors/borders/shadows
- Cannot change layout, structure, or fundamental design
- Templates look similar across vibes - just recolored
- No deep, thoughtful design per vibe

---

## Proposed State

### New Architecture: Vibe Bundles

```
vibes/
├── default/
│   ├── index.js          # Vibe metadata & exports
│   ├── styles.css        # Vibe-specific CSS
│   └── templates/
│       ├── cover.js      # Cover slide template
│       ├── threeCards.js # Three cards template
│       ├── kpiMetrics.js # KPI metrics template
│       ├── timeline.js   # Timeline template
│       └── quote.js      # Quote template
├── bold/
│   ├── index.js
│   ├── styles.css
│   └── templates/
│       ├── cover.js      # DIFFERENT design than default
│       ├── threeCards.js # Bolder, more impactful
│       └── ...
├── corporate/
├── creative/
└── dark/                 # Renamed from "data"
```

### Template Bundle Structure

Each template file contains:

```javascript
// vibes/bold/templates/threeCards.js
export default {
  id: 'bold-threeCards',
  vibe: 'bold',
  type: 'three-cards',
  name: 'Three Cards',
  description: 'Bold impact cards with strong visual hierarchy',

  // The HTML template - carefully designed for this vibe
  html: `<div class="slide bold-three-cards">...</div>`,

  // The CSS specific to this template (if any beyond vibe CSS)
  css: `...`,

  // PPTX export function - NOT a string, actual code
  pptxRenderer: (pptx, slideData, slideNum, totalSlides) => {
    const slide = pptx.addSlide();
    // Actual PPTX generation code
    // Designed specifically for this template's layout
  },

  // Thumbnail preview (optional - could be generated)
  thumbnail: 'data:image/svg+xml,...',

  // Content schema for AI to fill
  contentSchema: {
    title: { type: 'string', maxLength: 60 },
    subtitle: { type: 'string', maxLength: 80 },
    cards: {
      type: 'array',
      minItems: 3,
      maxItems: 3,
      items: {
        icon: { type: 'emoji' },
        number: { type: 'string', maxLength: 2 },
        title: { type: 'string', maxLength: 30 },
        description: { type: 'string', maxLength: 100 },
        impact: { type: 'string', maxLength: 40 }
      }
    }
  }
};
```

---

## Core Template Types (5 per vibe = 25 total designs)

### Priority 1: Most Used Templates
1. **Cover** - Title slide, first impression
2. **Three Cards** - Framework, pillars, options
3. **KPI Metrics** - Numbers with context
4. **Timeline** - Phases, roadmap, history
5. **Quote/Callout** - Testimonial, key message

### Why These 5?
- Cover 80% of business presentation needs
- Each tests different design challenges
- Provides variety while being manageable
- Can expand to more templates later

---

## Design Principles Per Vibe

### Default (Base)
- Clean, professional, Strategy& brand
- Left accent bars (4px maroon)
- White cards with subtle shadows
- Georgia serif for titles, Arial for body
- Conservative, reliable, safe choice

### Bold
- Maximum visual impact
- Thick accent bars (6px+)
- Filled icon circles (maroon background)
- Larger numbers, heavier weights
- Strong shadows, high contrast
- For sales pitches, persuasion

### Corporate
- Formal, structured, traditional
- Thin borders, squared corners
- Section numbers (1.0, 1.1)
- Uppercase labels, letter-spacing
- Table-like organization
- For board meetings, regulatory

### Creative
- Dynamic, modern, friendly
- Very rounded corners (16px)
- Gradient accents
- Asymmetric layouts possible
- Soft shadows, white space
- For startups, brand presentations

### Dark
- Dashboard aesthetics
- Dark background (#0F172A)
- Light text on dark
- Monospace numbers
- High contrast accents
- For data presentations, tech

---

## Implementation Phases

### Phase 1: Architecture (1-2 days)
- [ ] Create new folder structure `src/vibes/`
- [ ] Define TypeScript interfaces for template bundles
- [ ] Create vibe loader/registry system
- [ ] Update template picker to use new structure
- [ ] Migrate one template (threeCards) as proof of concept

### Phase 2: Default Vibe (2-3 days)
- [ ] Design and implement Cover template
- [ ] Design and implement Three Cards template
- [ ] Design and implement KPI Metrics template
- [ ] Design and implement Timeline template
- [ ] Design and implement Quote template
- [ ] Write PPTX export code for each
- [ ] Test HTML rendering and PPTX export

### Phase 3: Bold Vibe (2-3 days)
- [ ] Design Cover with maximum impact
- [ ] Design Three Cards with bold styling
- [ ] Design KPI Metrics with large numbers
- [ ] Design Timeline with heavy markers
- [ ] Design Quote with strong visual
- [ ] PPTX export for each

### Phase 4: Corporate Vibe (2-3 days)
- [ ] Design Cover with formal structure
- [ ] Design Three Cards with section numbers
- [ ] Design KPI Metrics in table format
- [ ] Design Timeline with formal markers
- [ ] Design Quote with attribution block
- [ ] PPTX export for each

### Phase 5: Creative Vibe (2-3 days)
- [ ] Design Cover with dynamic layout
- [ ] Design Three Cards with rounded style
- [ ] Design KPI Metrics with visual flair
- [ ] Design Timeline as journey
- [ ] Design Quote with modern styling
- [ ] PPTX export for each

### Phase 6: Dark Vibe (2-3 days)
- [ ] Design Cover for dark theme
- [ ] Design Three Cards on dark background
- [ ] Design KPI Metrics dashboard style
- [ ] Design Timeline with glow effects
- [ ] Design Quote for dark theme
- [ ] PPTX export for each

### Phase 7: Integration & Polish (2-3 days)
- [ ] Update AI service to use new templates
- [ ] Update template picker UI
- [ ] Add vibe switcher that shows appropriate templates
- [ ] Migration path for existing slides
- [ ] Documentation
- [ ] Testing all combinations

---

## File Structure After Implementation

```
src/
├── vibes/
│   ├── index.js                 # Vibe registry, exports all vibes
│   ├── types.ts                 # TypeScript interfaces
│   ├── default/
│   │   ├── index.js             # Vibe config (name, colors, etc.)
│   │   ├── styles.css           # Vibe-specific CSS
│   │   └── templates/
│   │       ├── index.js         # Exports all templates
│   │       ├── cover.js
│   │       ├── threeCards.js
│   │       ├── kpiMetrics.js
│   │       ├── timeline.js
│   │       └── quote.js
│   ├── bold/
│   │   └── ... (same structure)
│   ├── corporate/
│   │   └── ...
│   ├── creative/
│   │   └── ...
│   └── dark/
│       └── ...
├── components/
│   ├── TemplatePicker.jsx       # Updated to show vibe-grouped templates
│   ├── VibeSwitcher.jsx         # New: switch vibes, shows templates
│   └── ...
├── services/
│   ├── pptxService.js           # Updated to use template.pptxRenderer
│   └── ...
└── utils/
    ├── vibeLoader.js            # Load and register vibes
    └── templateRegistry.js      # Central template registry
```

---

## Template Design Specifications

### Cover Template Variations

#### Default Cover
```
┌─────────────────────────────────────┐
│                                     │
│  [CATEGORY TAG]                     │
│                                     │
│  Large Title Text                   │
│  Spans Multiple Lines               │
│                                     │
│                                     │
│  [Company]              [Date]      │
└─────────────────────────────────────┘
```

#### Bold Cover
```
┌─────────────────────────────────────┐
│██████████████████████████████████████│ <- thick maroon bar
│                                     │
│  ▌CATEGORY                          │
│                                     │
│  LARGE BOLD TITLE                   │
│  IN UPPERCASE                       │
│                                     │
│  ━━━━━━━━━━━━━━━                    │ <- thick divider
│  [Company]              [Date]      │
└─────────────────────────────────────┘
```

#### Corporate Cover
```
┌─────────────────────────────────────┐
│ ┌─────────────────────────────────┐ │
│ │ 1.0  CATEGORY                   │ │ <- numbered
│ └─────────────────────────────────┘ │
│                                     │
│  Title Text                         │
│  _________________________________  │ <- underline
│                                     │
│  Prepared for: [Audience]           │
│  Date: [Date]                       │
│  [Company]                          │
└─────────────────────────────────────┘
```

#### Creative Cover
```
┌─────────────────────────────────────┐
│                    ╭───────────────╮│
│                    │  [CATEGORY]   ││ <- rounded pill
│                    ╰───────────────╯│
│                                     │
│     Title Text                      │
│     With Gradient Accent            │
│     ═══════════════                 │ <- gradient bar
│                                     │
│  ○ [Company]            ○ [Date]    │ <- dots
└─────────────────────────────────────┘
```

#### Dark Cover
```
┌─────────────────────────────────────┐ (dark bg)
│                                     │
│  ┃ CATEGORY                         │ <- glowing accent
│                                     │
│  Title Text                         │
│  In Light Color                     │
│                                     │
│  ▪▪▪▪▪▪▪▪▪▪▪▪▪                      │ <- subtle dots
│  [Company]              [Date]      │
└─────────────────────────────────────┘
```

### Three Cards Template Variations

(Similar detailed specs for each vibe...)

---

## API Changes

### New Template Selection

```javascript
// Before
const template = SLIDE_TEMPLATES.threeCards;

// After
import { getTemplate } from './vibes';
const template = getTemplate('bold', 'threeCards');
// or
const template = getTemplateById('bold-threeCards');
```

### New PPTX Export

```javascript
// Before
const pptxCode = template.pptxRendererCode; // string
eval(pptxCode)(pptx, slideNum, totalSlides);

// After
template.pptxRenderer(pptx, slideData, slideNum, totalSlides);
// Actual function, not string - better type safety, debugging
```

### Vibe-Aware Template Picker

```javascript
// Get all templates for current vibe
const templates = getTemplatesForVibe(currentVibe);

// Get all vibes with their templates
const vibesWithTemplates = getAllVibesWithTemplates();
// Returns: { default: [...], bold: [...], corporate: [...], ... }
```

---

## Migration Strategy

### Existing Slides
- Slides created with old system continue to work
- CSS vibes still apply for backwards compatibility
- New slides use bundled templates

### Gradual Rollout
1. New templates available alongside old
2. Old templates marked as "Classic"
3. Eventually deprecate old system

---

## Success Criteria

1. **Visual Quality**: Each template looks professionally designed, not just recolored
2. **Consistency**: Templates within a vibe feel cohesive
3. **Differentiation**: Vibes look distinctly different from each other
4. **PPTX Fidelity**: Exported PPTX matches HTML preview closely
5. **Performance**: No degradation in load time or rendering
6. **Maintainability**: Clear structure, easy to add new templates/vibes

---

## Estimated Timeline

| Phase | Duration | Deliverable |
|-------|----------|-------------|
| Architecture | 1-2 days | New folder structure, loader system |
| Default Vibe | 2-3 days | 5 production-ready templates |
| Bold Vibe | 2-3 days | 5 production-ready templates |
| Corporate Vibe | 2-3 days | 5 production-ready templates |
| Creative Vibe | 2-3 days | 5 production-ready templates |
| Dark Vibe | 2-3 days | 5 production-ready templates |
| Integration | 2-3 days | Full system working |
| **Total** | **~15-20 days** | 25 professional template designs |

---

## Next Steps

1. **Review this plan** - Get feedback, adjust scope
2. **Start Phase 1** - Architecture setup
3. **Design first template** - Three Cards in Default vibe as proof of concept
4. **Iterate** - Build remaining templates

---

## Questions to Resolve

1. Should we keep backwards compatibility with CSS-only vibes?
2. Should templates be lazy-loaded per vibe?
3. Do we need thumbnail previews, or generate them?
4. How should AI select templates? By vibe first, then type?
5. Should users be able to mix vibes (e.g., bold card in corporate deck)?
