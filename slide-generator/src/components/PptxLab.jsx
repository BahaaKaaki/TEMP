import { useState, useRef, useCallback, useEffect } from 'react';
import PptxGenJS from 'pptxgenjs';
import { useSlides } from '../context/SlideContext';
import {
  DEFAULT_PPTX_SYSTEM_PROMPT,
  COMPLETE_TRANSLATION_EXAMPLE,
  KPI_TRANSLATION_EXAMPLE,
  COVER_TRANSLATION_EXAMPLE,
  themeToPptxPalette,
  buildSlidePrompt,
  extractJSArray,
  validateGeneratedCode,
  callAI,
  getCredentialsForModel,
  hasAnyCredentials,
} from '../services/pptxService';
import { addFooter, COLORS } from '../services/pptxRenderers';

const SAMPLES = [
  { id: 'card-row', label: 'Card Row (3 cards)', html: COMPLETE_TRANSLATION_EXAMPLE.html, refCode: COMPLETE_TRANSLATION_EXAMPLE.code },
  { id: 'kpi', label: 'KPI Two-Column', html: KPI_TRANSLATION_EXAMPLE.html, refCode: KPI_TRANSLATION_EXAMPLE.code },
  { id: 'cover', label: 'Cover Slide', html: COVER_TRANSLATION_EXAMPLE.html, refCode: COVER_TRANSLATION_EXAMPLE.code },
  { id: 'custom', label: 'Custom (paste HTML)', html: '', refCode: null },
];

const MODELS = [
  'pwc:openai.gpt-5.5',
  'pwc:bedrock.anthropic.claude-opus-4-7',
  'pwc:vertex_ai.anthropic.claude-opus-4-7',
  'pwc:vertex_ai.gemini-3.1-pro-preview',
  'pwc:openai.gpt-5.4',
  'pwc:openai.gpt-5.4-mini',
];

const TABS = [
  { id: 'prompt', label: 'User Prompt' },
  { id: 'system', label: 'System Prompt' },
  { id: 'response', label: 'LLM Response' },
  { id: 'code', label: 'Extracted Code' },
  { id: 'validation', label: 'Validation' },
];

const FREESTYLE_EXAMPLE_LIBRARY = `// --- PRIMITIVE 1: Card row (N equal cards) ---
function(pptx, slideNum, totalSlides) {
  const slide = pptx.addSlide();
  slide.addText('Headline', {x:0.48, y:0.42, w:12.36, h:0.8, fontFace:'Georgia', fontSize:28, color:c.main});
  slide.addText('Subtitle', {x:0.48, y:1.40, w:12.36, h:0.4, fontFace:'Arial', fontSize:18, color:c.accent, bold:true});
  const items = [{title:'A', body:'...'}, {title:'B', body:'...'}, {title:'C', body:'...'}];
  const startX=0.48, cardW=3.95, gap=0.25, cardY=1.90, cardH=4.2;
  items.forEach((d,i) => {
    const x = startX + i*(cardW+gap);
    slide.addShape('roundRect', {x, y:cardY, w:cardW, h:cardH, fill:{color:c.surface}, line:{color:c.border,width:1}, rectRadius:0.05});
    slide.addShape('rect', {x, y:cardY, w:cardW, h:0.08, fill:{color:c.accent}});
    slide.addText(d.title, {x:x+0.25, y:cardY+0.2, w:cardW-0.5, h:0.4, fontFace:'Arial', fontSize:14, color:c.main, bold:true});
    slide.addText(d.body, {x:x+0.25, y:cardY+0.75, w:cardW-0.5, h:cardH-1, fontFace:'Arial', fontSize:12, color:c.body, valign:'top'});
  });
  addFooter(slide, slideNum, totalSlides);
}

// --- PRIMITIVE 2: Two-column split (left summary, right details) ---
function(pptx, slideNum, totalSlides) {
  const slide = pptx.addSlide();
  slide.addText('Headline', {x:0.48, y:0.42, w:12.36, h:0.8, fontFace:'Georgia', fontSize:28, color:c.main});
  slide.addText('47%', {x:0.48, y:2.0, w:4.5, h:1.2, fontFace:'Georgia', fontSize:48, color:c.accent, bold:true});
  slide.addText('Key finding', {x:0.48, y:3.2, w:4.5, h:0.5, fontFace:'Arial', fontSize:14, color:c.muted});
  slide.addShape('line', {x:5.2, y:1.9, w:0, h:4.3, line:{color:'E6E9EE', width:1}});
  const rows = [{t:'Detail A', d:'...'}, {t:'Detail B', d:'...'}, {t:'Detail C', d:'...'}];
  rows.forEach((r,i) => {
    const y = 2.0 + i*1.2;
    slide.addText(r.t, {x:5.5, y, w:7, h:0.3, fontFace:'Arial', fontSize:14, color:c.main, bold:true});
    slide.addText(r.d, {x:5.5, y:y+0.35, w:7, h:0.7, fontFace:'Arial', fontSize:12, color:c.body, valign:'top'});
  });
  addFooter(slide, slideNum, totalSlides);
}

// --- PRIMITIVE 3: Native bar chart ---
function(pptx, slideNum, totalSlides) {
  const slide = pptx.addSlide();
  slide.addText('Chart title', {x:0.48, y:0.42, w:12.36, h:0.8, fontFace:'Georgia', fontSize:28, color:c.main});
  const chartData = [{name:'Value', labels:['A','B','C','D','E'], values:[1.0, 0.73, 0.51, 0.36, 0.23]}];
  slide.addChart(pptx.ChartType.bar, chartData, {
    x:0.5, y:2.0, w:12.3, h:3.8, barDir:'col', barGrouping:'clustered',
    chartColors:['8E1E1E'], showLegend:false, showValue:true,
  });
  addFooter(slide, slideNum, totalSlides);
}

// --- PRIMITIVE 4: KPI block (big stat + label) ---
function(pptx, slideNum, totalSlides) {
  const slide = pptx.addSlide();
  slide.addText('Headline', {x:0.48, y:0.42, w:12.36, h:0.8, fontFace:'Georgia', fontSize:28, color:c.main});
  slide.addShape('roundRect', {x:0.48, y:2.0, w:4.5, h:2.5, fill:{color:c.surfaceSoft}, rectRadius:0.08});
  slide.addText('4.35x', {x:0.48, y:2.2, w:4.5, h:1.6, fontFace:'Georgia', fontSize:64, color:c.accent, bold:true, align:'center', valign:'middle'});
  slide.addText('Label', {x:0.48, y:3.8, w:4.5, h:0.4, fontFace:'Arial', fontSize:13, color:c.muted, align:'center'});
  addFooter(slide, slideNum, totalSlides);
}

// Pick the closest primitive(s) as a starting point or IMPROVISE freely.
// The slide's actual HTML/CSS layout always wins over these examples.`;

export default function PptxLab() {
  const { state } = useSlides();
  const settings = state.settings || {};

  const [sampleId, setSampleId] = useState('card-row');
  const [htmlInput, setHtmlInput] = useState(SAMPLES[0].html);
  const [cssInput, setCssInput] = useState('');
  const [model, setModel] = useState(MODELS[0]);
  const [systemPrompt, setSystemPrompt] = useState(DEFAULT_PPTX_SYSTEM_PROMPT);
  const [activeTab, setActiveTab] = useState('prompt');
  const [freestyle, setFreestyle] = useState(true);
  const [running, setRunning] = useState(false);

  const [result, setResult] = useState({
    userPrompt: '',
    rawResponse: '',
    extractedCode: '',
    validation: null,
    error: null,
    durationMs: null,
  });

  const previewRef = useRef(null);

  const handleSampleChange = useCallback((id) => {
    setSampleId(id);
    const sample = SAMPLES.find(s => s.id === id);
    if (sample) setHtmlInput(sample.html);
  }, []);

  const updatePreview = useCallback(() => {
    if (!previewRef.current) return;
    const doc = previewRef.current.contentDocument;
    if (!doc) return;
    doc.open();
    doc.write(`<!DOCTYPE html><html><head>
      <style>
        body { margin:0; background:#fff; overflow:hidden; }
        .slide { width:960px; height:540px; position:relative; font-family:Arial,sans-serif; overflow:hidden; }
        .title { position:absolute; left:28px; top:24px; width:904px; font-family:Georgia,serif; font-size:28px; color:#111; }
        .subtitle { position:absolute; left:28px; top:95px; width:904px; font-family:Arial,sans-serif; font-size:18px; color:#A32020; font-weight:bold; }
        .frame { position:absolute; left:28px; top:127px; width:904px; height:366px; }
        .footer { position:absolute; bottom:0; left:28px; width:904px; font-size:10px; color:#4A4F57; display:flex; justify-content:space-between; }
        .card-row { display:flex; gap:12px; height:100%; }
        .card { flex:1; background:#F7F9FB; border:1px solid #E6E9EE; border-radius:4px; padding:16px; position:relative; overflow:hidden; }
        .card::before { content:''; position:absolute; top:0; left:0; right:0; height:4px; background:#8E1E1E; }
        .card-header-row { display:flex; align-items:center; justify-content:space-between; margin-bottom:8px; }
        .card-icon-circle { width:32px; height:32px; border-radius:50%; background:#F8E3E3; display:flex; align-items:center; justify-content:center; font-size:14px; }
        .card-num { font-family:Georgia,serif; font-size:32px; color:#8E1E1E; font-weight:bold; }
        h3 { font-size:16px; color:#111; margin:8px 0; }
        p { font-size:12px; color:#222; line-height:1.5; margin:4px 0; }
        .impact-box { margin-top:8px; padding-top:8px; border-top:1px solid #dcdcdc; font-size:11px; color:#4B4F55; font-weight:bold; }
        .two-col { display:flex; gap:16px; height:100%; }
        .col-left, .col-right { flex:1; }
        .kpi-block { background:#F7F9FB; border-left:4px solid #8E1E1E; padding:12px 16px; margin-bottom:12px; border-radius:0 4px 4px 0; }
        .kpi-value { font-family:Georgia,serif; font-size:42px; color:#8E1E1E; font-weight:bold; }
        .kpi-label { font-size:13px; color:#4A4F57; margin-top:4px; }
        .detail-item { margin-bottom:12px; }
        .detail-item h4 { font-size:14px; color:#111; margin:0 0 4px; }
        .detail-item p { font-size:12px; color:#222; }
        .cover-slide { width:960px; height:540px; position:relative; background:#fff; }
        .cover-category { position:absolute; left:28px; top:200px; font-size:18px; color:#A32020; font-weight:bold; letter-spacing:1.5px; }
        .cover-title { position:absolute; left:28px; top:240px; width:600px; font-family:Georgia,serif; font-size:42px; color:#111; line-height:1.15; }
        .cover-branding { position:absolute; left:28px; bottom:40px; font-size:16px; color:#4A4F57; font-weight:bold; }
        .cover-date { position:absolute; right:28px; bottom:40px; font-size:13px; color:#4A4F57; }
        ${cssInput}
      </style>
    </head><body>${htmlInput}</body></html>`);
    doc.close();
  }, [htmlInput, cssInput]);

  const patchFreestyle = useCallback((prompt) => {
    if (!freestyle) return prompt;
    return prompt.replace(
      /========== REFERENCE EXAMPLE ==========\n[\s\S]*?\n========== SLIDE/,
      `========== REFERENCE EXAMPLE LIBRARY (freestyle) ==========\n${FREESTYLE_EXAMPLE_LIBRARY}\n\n========== SLIDE`
    );
  }, [freestyle]);

  const [promptPreviewText, setPromptPreviewText] = useState('');
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const labSettings = { ...settings, customTemplates: freestyle ? [] : settings.customTemplates };
      const slide = { html: htmlInput, customCSS: cssInput };
      try {
        const raw = await buildSlidePrompt(slide, 1, 1, labSettings, null);
        if (!cancelled) setPromptPreviewText(patchFreestyle(raw));
      } catch (e) {
        if (!cancelled) setPromptPreviewText(`[Error building prompt: ${e.message}]`);
      }
    })();
    return () => { cancelled = true; };
  }, [htmlInput, cssInput, settings, freestyle, patchFreestyle]);

  const handleRun = useCallback(async () => {
    setRunning(true);
    setActiveTab('response');
    setResult({ userPrompt: '', rawResponse: '', extractedCode: '', validation: null, error: null, durationMs: null });

    const overrideSettings = { ...settings, pptxSystemPrompt: systemPrompt, customTemplates: freestyle ? [] : settings.customTemplates };
    const slide = { html: htmlInput, customCSS: cssInput };
    const rawPrompt = await buildSlidePrompt(slide, 1, 1, overrideSettings, null);
    const userPrompt = patchFreestyle(rawPrompt);

    setResult(prev => ({ ...prev, userPrompt }));

    const modelRef = model;
    let credentials;
    try {
      credentials = getCredentialsForModel(overrideSettings, modelRef);
    } catch (e) {
      setResult(prev => ({ ...prev, error: `Credential error: ${e.message}` }));
      setRunning(false);
      return;
    }

    const start = Date.now();
    try {
      const raw = await callAI(overrideSettings, credentials, systemPrompt, userPrompt);
      const elapsed = Date.now() - start;
      setResult(prev => ({ ...prev, rawResponse: raw, durationMs: elapsed }));

      let codeString;
      try {
        codeString = extractJSArray(raw);
        setResult(prev => ({ ...prev, extractedCode: codeString }));
      } catch (e) {
        setResult(prev => ({ ...prev, extractedCode: `[Extraction failed: ${e.message}]`, validation: { valid: false, errors: [{ type: 'ExtractionError', message: e.message }] } }));
        setActiveTab('code');
        setRunning(false);
        return;
      }

      const validation = validateGeneratedCode(codeString, htmlInput);
      setResult(prev => ({ ...prev, validation }));
      setActiveTab('validation');
    } catch (e) {
      setResult(prev => ({ ...prev, error: e.message, durationMs: Date.now() - start }));
      setActiveTab('response');
    }

    setRunning(false);
  }, [htmlInput, cssInput, model, systemPrompt, settings]);

  const handleDownload = useCallback(() => {
    if (!result.extractedCode || !result.validation?.valid) return;
    try {
      const pptx = new PptxGenJS();
      pptx.defineLayout({ name: 'CUSTOM', width: 13.333, height: 7.5 });
      pptx.layout = 'CUSTOM';
      pptx.defineSlideMaster({ title: 'BLANK_SLIDE', objects: [] });

      const execContext = { addFooter, COLORS };
      const wrapped = `const { addFooter, COLORS } = context; return ${result.extractedCode};`;
      const fns = new Function('context', wrapped)(execContext);
      fns[0](pptx, 1, 1);

      pptx.writeFile({ fileName: 'pptx-lab-test.pptx' });
    } catch (e) {
      alert(`Download failed: ${e.message}`);
    }
  }, [result]);

  const promptPreview = promptPreviewText;

  const tabContent = {
    prompt: result.userPrompt || promptPreview || '(build prompt preview — select HTML and click Run)',
    system: systemPrompt,
    response: result.rawResponse || (result.error ? `ERROR: ${result.error}` : '(not yet run)'),
    code: result.extractedCode || '(not yet run)',
    validation: result.validation
      ? `Valid: ${result.validation.valid}\n\nErrors (${result.validation.errors?.length || 0}):\n${(result.validation.errors || []).map((e, i) => `  ${i + 1}. [${e.type}] ${e.message}${e.details ? `\n     ${e.details}` : ''}`).join('\n') || '  (none)'}`
      : '(not yet run)',
  };

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <div style={styles.headerLeft}>
          <h1 style={styles.title}>PPTX Lab</h1>
          <select value={sampleId} onChange={e => handleSampleChange(e.target.value)} style={styles.select}>
            {SAMPLES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
          <select value={model} onChange={e => setModel(e.target.value)} style={styles.select}>
            {MODELS.map(m => <option key={m} value={m}>{m.replace('pwc:', '')}</option>)}
          </select>
          <label style={styles.toggle}>
            <input type="checkbox" checked={freestyle} onChange={e => setFreestyle(e.target.checked)} />
            <span style={{ marginLeft: 4 }}>Freestyle</span>
          </label>
        </div>
        <div style={styles.headerRight}>
          {result.durationMs != null && (
            <span style={styles.timing}>{(result.durationMs / 1000).toFixed(1)}s</span>
          )}
          {result.validation && (
            <span style={{ ...styles.badge, background: result.validation.valid ? '#059669' : '#dc2626' }}>
              {result.validation.valid ? 'VALID' : 'FAILED'}
            </span>
          )}
          <button onClick={handleRun} disabled={running || !htmlInput.trim()} style={{ ...styles.btn, ...styles.btnPrimary, opacity: running ? 0.6 : 1 }}>
            {running ? 'Running...' : 'Run'}
          </button>
          <button onClick={handleDownload} disabled={!result.validation?.valid} style={{ ...styles.btn, opacity: result.validation?.valid ? 1 : 0.4 }}>
            Download PPTX
          </button>
          <a href="/" style={{ ...styles.btn, textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}>Back</a>
        </div>
      </div>

      {/* Main area */}
      <div style={styles.main}>
        {/* Left: Input + Preview */}
        <div style={styles.left}>
          <div style={styles.inputSection}>
            <div style={styles.sectionHeader}>
              <span>HTML Input</span>
              <button onClick={updatePreview} style={styles.btnSmall}>Refresh Preview</button>
            </div>
            <textarea
              value={htmlInput}
              onChange={e => setHtmlInput(e.target.value)}
              style={styles.textarea}
              placeholder="Paste slide HTML here..."
              spellCheck={false}
            />
          </div>
          <div style={styles.inputSection}>
            <div style={styles.sectionHeader}>
              <span>Custom CSS (optional)</span>
            </div>
            <textarea
              value={cssInput}
              onChange={e => setCssInput(e.target.value)}
              style={{ ...styles.textarea, height: 60 }}
              placeholder=".my-class { color: red; }"
              spellCheck={false}
            />
          </div>
          <div style={styles.previewSection}>
            <div style={styles.sectionHeader}>HTML Preview (960×540)</div>
            <div style={styles.previewContainer}>
              <iframe
                ref={previewRef}
                title="slide-preview"
                style={styles.previewIframe}
                sandbox="allow-same-origin"
                onLoad={updatePreview}
              />
            </div>
          </div>
        </div>

        {/* Right: Output tabs */}
        <div style={styles.right}>
          <div style={styles.tabBar}>
            {TABS.map(t => (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id)}
                style={{ ...styles.tab, ...(activeTab === t.id ? styles.tabActive : {}) }}
              >
                {t.label}
                {t.id === 'validation' && result.validation && (
                  <span style={{ marginLeft: 6, width: 8, height: 8, borderRadius: '50%', display: 'inline-block', background: result.validation.valid ? '#059669' : '#dc2626' }} />
                )}
              </button>
            ))}
          </div>
          <div style={styles.tabContent}>
            {activeTab === 'system' ? (
              <textarea
                value={systemPrompt}
                onChange={e => setSystemPrompt(e.target.value)}
                style={{ ...styles.outputArea, background: '#1a1a2e' }}
                spellCheck={false}
              />
            ) : (
              <pre style={styles.outputArea}>{tabContent[activeTab]}</pre>
            )}
          </div>

          {/* Reference code from sample */}
          {SAMPLES.find(s => s.id === sampleId)?.refCode && (
            <div style={styles.refSection}>
              <div style={styles.sectionHeader}>Reference PptxGenJS (expected output)</div>
              <pre style={{ ...styles.outputArea, maxHeight: 200, fontSize: 11 }}>
                {SAMPLES.find(s => s.id === sampleId)?.refCode}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const styles = {
  container: { display: 'flex', flexDirection: 'column', height: '100vh', background: '#0d1117', color: '#e6edf3', fontFamily: 'system-ui, -apple-system, sans-serif' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 16px', background: '#161b22', borderBottom: '1px solid #30363d', flexShrink: 0, gap: 12, flexWrap: 'wrap' },
  headerLeft: { display: 'flex', alignItems: 'center', gap: 12 },
  headerRight: { display: 'flex', alignItems: 'center', gap: 10 },
  title: { fontSize: 16, fontWeight: 700, margin: 0, color: '#58a6ff' },
  select: { padding: '5px 10px', fontSize: 12, background: '#21262d', color: '#e6edf3', border: '1px solid #30363d', borderRadius: 6, outline: 'none' },
  btn: { padding: '6px 14px', fontSize: 12, fontWeight: 600, background: '#21262d', color: '#e6edf3', border: '1px solid #30363d', borderRadius: 6, cursor: 'pointer' },
  btnPrimary: { background: '#238636', borderColor: '#2ea043', color: '#fff' },
  btnSmall: { padding: '2px 8px', fontSize: 11, background: '#21262d', color: '#8b949e', border: '1px solid #30363d', borderRadius: 4, cursor: 'pointer' },
  badge: { padding: '3px 10px', fontSize: 11, fontWeight: 700, borderRadius: 10, color: '#fff' },
  toggle: { display: 'flex', alignItems: 'center', fontSize: 12, color: '#8b949e', cursor: 'pointer', userSelect: 'none' },
  timing: { fontSize: 12, color: '#8b949e', fontFamily: 'monospace' },
  main: { display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden' },
  left: { width: '45%', display: 'flex', flexDirection: 'column', borderRight: '1px solid #30363d', overflow: 'auto' },
  right: { width: '55%', display: 'flex', flexDirection: 'column', overflow: 'hidden' },
  inputSection: { padding: '8px 12px', borderBottom: '1px solid #30363d' },
  sectionHeader: { fontSize: 11, fontWeight: 600, color: '#8b949e', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  textarea: { width: '100%', height: 140, background: '#0d1117', color: '#e6edf3', border: '1px solid #30363d', borderRadius: 6, padding: 8, fontSize: 12, fontFamily: 'monospace', resize: 'vertical', outline: 'none', boxSizing: 'border-box' },
  previewSection: { flex: 1, padding: '8px 12px', display: 'flex', flexDirection: 'column', minHeight: 200 },
  previewContainer: { flex: 1, background: '#fff', borderRadius: 6, overflow: 'hidden', position: 'relative', border: '1px solid #30363d' },
  previewIframe: { width: 960, height: 540, border: 'none', transformOrigin: '0 0', transform: 'scale(0.45)', position: 'absolute', top: 0, left: 0 },
  tabBar: { display: 'flex', background: '#161b22', borderBottom: '1px solid #30363d', flexShrink: 0, overflowX: 'auto' },
  tab: { padding: '8px 16px', fontSize: 12, fontWeight: 500, color: '#8b949e', background: 'none', border: 'none', borderBottom: '2px solid transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', whiteSpace: 'nowrap' },
  tabActive: { color: '#e6edf3', borderBottom: '2px solid #58a6ff' },
  tabContent: { flex: 1, overflow: 'auto', minHeight: 0 },
  outputArea: { width: '100%', height: '100%', background: '#0d1117', color: '#e6edf3', border: 'none', padding: 12, fontSize: 12, fontFamily: 'monospace', whiteSpace: 'pre-wrap', wordBreak: 'break-word', margin: 0, outline: 'none', resize: 'none', boxSizing: 'border-box', overflow: 'auto' },
  refSection: { borderTop: '1px solid #30363d', padding: '8px 12px', flexShrink: 0 },
};
