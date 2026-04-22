# AI Slide Generator

A React application for creating professional presentation slides using AI. Generate slides by prompting GPT models, edit them manually with a built-in code editor, and download them as a single HTML file.

## Features

- **AI-Powered Generation**: Generate professional slides by describing your presentation topic
- **Manual Editing**: Full code editor with syntax highlighting for HTML and CSS
- **Multiple Layouts**: 7 professional slide templates (Cover, Three Cards, KPI Metrics, Timeline, Quote, Bullets, 2x2 Grid)
- **Optimized Storage**: Slides stored individually with shared CSS infrastructure
- **Live Preview**: Real-time preview of your slides as you edit
- **Split View**: Edit code and see preview side-by-side
- **AI Assistant Open by Default**: The right-side AI panel is open on first load so users do not have to discover the floating action button
- **Download All**: Export all slides as a single HTML file with embedded styles
- **Import/Export**: Save and load slides as JSON for backup or sharing
- **Drag & Drop**: Reorder slides easily
- **Local Storage**: Auto-saves your work in the browser
- **PPTX Export Guidance Comments**: AI-generated HTML can include lightweight `<!-- pptx ... -->` comments on risky labels so PPTX export preserves one-line chips, badges, and step numbers more faithfully

## Getting Started

### Installation

```bash
cd slide-generator
npm install
```

### Development

```bash
npm run dev
```

Open http://localhost:5173 in your browser.

### Build for Production

```bash
npm run build
```

## Configuration

Before using AI generation, configure your API settings:

1. Click the **Settings** (gear icon) button in the header
2. Enter your **API Key** (OpenAI or compatible)
3. Set the **API Endpoint** (default: OpenAI)
4. Choose your **Model** (GPT-4 recommended)
5. Click **Test Connection** to verify
6. Click **Save Settings**

Supported endpoints:
- OpenAI: `https://api.openai.com/v1/chat/completions`
- Azure OpenAI: Your Azure endpoint
- Any OpenAI-compatible API

## Usage

### Creating Slides with AI

1. Enter a description of your presentation in the prompt box
2. Select the number of slides to generate
3. Click **Generate**
4. Edit the generated slides as needed

### Creating Slides Manually

1. Click **+ New** in the sidebar
2. Choose a template from the dropdown
3. Edit the HTML in the **Edit Code** tab
4. Add custom CSS if needed

### Editing Slides

- **Preview Tab**: View the rendered slide
- **Edit Code Tab**: Edit HTML directly with Monaco editor
- **Split View**: See both preview and code side-by-side
- **AI Assistant**: Opens by default for new users; after that, the open/closed state is remembered locally
- **Custom CSS**: Add slide-specific styles
- **Shared CSS**: Modify styles that apply to all slides

### PPTX Export Hints

Slides that are generated or edited by AI may include lightweight
`<!-- pptx ... -->` comments in the HTML. These comments are invisible in the
browser preview and are only used during PPTX export.

The hints are intentionally sparse and focus on elements that PowerPoint tends
to distort, such as:

- chips / swatches / filled pill labels
- badges / compact tags
- tight one-line step numbers

Typical hint comments look like:

```html
<!-- pptx chip nowrap exact-text center tight-box -->
<div class="d-swatch">TURQUOISE</div>
```

The export pipeline reads these comments as guidance for PptxGenJS so the
exporter keeps the text on one line, preserves exact label text, and avoids
adding extra text inset where tight browser labels would otherwise drift in
PowerPoint.

### Downloading

Click **Download** in the header to:
- **Download HTML**: Single HTML file with all slides and styles
- **Download JSON**: Backup file for import later

### Importing

Click **Import** to load a previously exported JSON file.

## Slide Types

| Type | Description |
|------|-------------|
| Cover | Title slide with branding |
| Three Cards | Three-column comparison layout |
| KPI Metrics | Key metrics with details |
| Timeline | Project phases or roadmap |
| Quote | Testimonial or callout |
| Bullets | Simple bullet point list |
| 2x2 Grid | Four-quadrant layout |

## CSS Variables

The slide system uses CSS custom properties for consistent theming:

```css
--maroon: #8E1E1E    /* Accent color */
--red: #A32020       /* Subtitle color */
--main: #111111      /* Primary text */
--meta: #4A4F57      /* Muted text */
--zone1: #F7F9FB     /* Light background */
--zone2: #EEF2F6     /* Alternate background */
--border: #E6E9EE    /* Border color */
```

## Tech Stack

- React 18
- Vite
- Monaco Editor (code editing)
- UUID (unique IDs)
- File Saver (downloads)

## License

MIT
