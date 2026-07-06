import { useState, useCallback, useRef, useContext } from 'react';
import { analyzePptx, transformPptx, buildColorMap, generateThemeGrid, refineColorMapWithAI } from '../services/pptxTransformService';
import { loadTemplateFromStorage } from '../services/pptxTemplateService';
import { callWithModelFallback, hasAnyApiKey } from '../services/aiService';
import SlideContext from '../context/SlideContext';

// ── Color swatch component ──────────────────────────────────────────────────

function ColorSwatch({ hex, label, size = 20 }) {
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      <div
        style={{
          width: size,
          height: size,
          borderRadius: 4,
          background: `#${hex}`,
          border: '1px solid rgba(0,0,0,0.15)',
          flexShrink: 0,
        }}
      />
      {label && <span style={{ fontSize: 11, color: '#666', fontFamily: 'monospace' }}>#{hex}</span>}
    </div>
  );
}

// ── Drop zone component ─────────────────────────────────────────────────────

function DropZone({ label, description, file, onFile, onClear, analysis, loading }) {
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef(null);

  const handleDrag = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDragIn = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragOut = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const droppedFile = e.dataTransfer.files?.[0];
    if (droppedFile && (droppedFile.name.endsWith('.pptx') || droppedFile.name.endsWith('.potx'))) {
      onFile(droppedFile);
    }
  }, [onFile]);

  const handleFileSelect = useCallback((e) => {
    const selected = e.target.files?.[0];
    if (selected) onFile(selected);
    e.target.value = '';
  }, [onFile]);

  const themeGrid = analysis?.themeGrid || (analysis?.colors ? generateThemeGrid(analysis.colors) : null);
  const extraColors = analysis?.hexValues
    ? [...new Set(analysis.hexValues)].filter(h => !themeGrid?.flat?.has?.(h) && h !== 'FFFFFF' && h !== '000000').slice(0, 10)
    : [];

  return (
    <div
      style={{
        flex: 1,
        minWidth: 280,
        border: `2px dashed ${isDragging ? '#8E1E1E' : file ? '#22c55e' : '#d1d5db'}`,
        borderRadius: 12,
        padding: 20,
        background: isDragging ? 'rgba(142,30,30,0.04)' : file ? 'rgba(34,197,94,0.03)' : '#fafafa',
        transition: 'all 0.2s',
        cursor: file ? 'default' : 'pointer',
      }}
      onDragEnter={handleDragIn}
      onDragLeave={handleDragOut}
      onDragOver={handleDrag}
      onDrop={handleDrop}
      onClick={() => !file && inputRef.current?.click()}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".pptx,.potx"
        onChange={handleFileSelect}
        style={{ display: 'none' }}
      />

      <div style={{ fontSize: 13, fontWeight: 600, color: '#333', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 11, color: '#888', marginBottom: 12 }}>{description}</div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '20px 0', color: '#888', fontSize: 13 }}>
          Analyzing...
        </div>
      ) : file ? (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
            </svg>
            <span style={{ fontSize: 13, fontWeight: 500, color: '#333', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {file.name}
            </span>
            <button
              onClick={(e) => { e.stopPropagation(); onClear(); }}
              style={{
                background: 'none', border: 'none', color: '#999', cursor: 'pointer',
                padding: '2px 6px', borderRadius: 4, fontSize: 16, lineHeight: 1,
              }}
              title="Remove"
            >
              &times;
            </button>
          </div>

          {analysis && (
            <div style={{ fontSize: 12, color: '#555' }}>
              <div style={{ marginBottom: 6 }}>
                <strong>{analysis.slideCount}</strong> slides, <strong>{analysis.layoutCount}</strong> layouts
              </div>

              {analysis.fonts?.major && (
                <div style={{ marginBottom: 6, color: '#777', fontSize: 11 }}>
                  Fonts: {analysis.fonts.major}{analysis.fonts.minor && analysis.fonts.minor !== analysis.fonts.major ? ` / ${analysis.fonts.minor}` : ''}
                </div>
              )}

              {themeGrid && (
                <div>
                  <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>Theme palette:</div>
                  {/* 10-column × 5-row grid (like PowerPoint's color picker) */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {themeGrid.grid.map((row, ri) => (
                      <div key={ri} style={{ display: 'flex', gap: 2 }}>
                        {row.map((hex, ci) => (
                          <div
                            key={ci}
                            title={hex ? `${themeGrid.slots[ci]}: #${hex}${ri === 0 ? '' : ri < 4 ? ` (tint ${[100,80,60,40][ri]}%)` : ' (shade 75%)'}` : ''}
                            style={{
                              width: 18,
                              height: 18,
                              borderRadius: ri === 0 ? '4px 4px 0 0' : ri === 4 ? '0 0 4px 4px' : 0,
                              background: hex ? `#${hex}` : '#f0f0f0',
                              border: '1px solid rgba(0,0,0,0.10)',
                              borderBottom: ri < 4 ? 'none' : undefined,
                            }}
                          />
                        ))}
                      </div>
                    ))}
                  </div>
                  {extraColors.length > 0 && (
                    <div style={{ marginTop: 4 }}>
                      <div style={{ fontSize: 10, color: '#aaa', marginBottom: 2 }}>Additional:</div>
                      <div style={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                        {extraColors.map(hex => (
                          <div
                            key={hex}
                            title={`#${hex}`}
                            style={{
                              width: 18,
                              height: 18,
                              borderRadius: 4,
                              background: `#${hex}`,
                              border: '1px solid rgba(0,0,0,0.12)',
                            }}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {analysis.layouts?.length > 0 && (
                <div style={{ marginTop: 8 }}>
                  <div style={{ fontSize: 11, color: '#888', marginBottom: 2 }}>Layouts:</div>
                  <div style={{ fontSize: 11, color: '#666', lineHeight: 1.6 }}>
                    {analysis.layouts.map(l => l.name).join(', ')}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        <div style={{ textAlign: 'center', padding: '16px 0', color: '#aaa' }}>
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ margin: '0 auto 8px', display: 'block' }}>
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>
          <div style={{ fontSize: 12 }}>Drop .pptx file here or click to browse</div>
        </div>
      )}
    </div>
  );
}

// ── Color map preview ───────────────────────────────────────────────────────

function ColorMapPreview({ sourceColors, targetColors, sourceHexValues, targetHexValues, includeExtraColors }) {
  // Build the color map (theme-only or theme+extra, same as transform does)
  const srcHex = sourceHexValues ? new Set(sourceHexValues) : undefined;
  const tgtHex = targetHexValues ? new Set(targetHexValues) : undefined;
  const colorMap = buildColorMap(sourceColors, targetColors, srcHex, tgtHex, { includeExtraColors });
  const entries = Object.entries(colorMap);

  if (entries.length === 0) {
    return <div style={{ fontSize: 12, color: '#888', fontStyle: 'italic' }}>No color differences detected</div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div style={{ fontSize: 11, color: '#999', marginBottom: 2, fontWeight: 600 }}>
        Color mappings ({entries.length} total, OKLab proximity)
      </div>
      {entries.map(([src, tgt]) => (
        <div key={src} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
          <ColorSwatch hex={src} label />
          <span style={{ color: '#999', fontSize: 14 }}>&rarr;</span>
          <ColorSwatch hex={tgt} label />
        </div>
      ))}
    </div>
  );
}

// ── Main component ──────────────────────────────────────────────────────────

export default function PptxTransformer({ onClose }) {
  const { state } = useContext(SlideContext);
  const settings = state.settings;

  // Source file
  const [sourceFile, setSourceFile] = useState(null);
  const [sourceBuffer, setSourceBuffer] = useState(null);
  const [sourceAnalysis, setSourceAnalysis] = useState(null);
  const [sourceLoading, setSourceLoading] = useState(false);

  // Target template
  const [targetFile, setTargetFile] = useState(null);
  const [targetBuffer, setTargetBuffer] = useState(null);
  const [targetAnalysis, setTargetAnalysis] = useState(null);
  const [targetLoading, setTargetLoading] = useState(false);

  // Transform state
  const [isTransforming, setIsTransforming] = useState(false);
  const [progress, setProgress] = useState(null);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [keepSourcePositions, setKeepSourcePositions] = useState(false);
  const [includeExtraColors, setIncludeExtraColors] = useState(false);
  const [headerSizePt, setHeaderSizePt] = useState(28);
  const [colorGuidance, setColorGuidance] = useState('');
  // Content area (inches) — same as standard slide creation (13.33" × 7.5" slide)
  const [contentArea, setContentArea] = useState({ x: 0.48, y: 1.90, w: 12.36, h: 4.50 });
  // AI analysis toggles — which parts of GPT analysis to use
  const [useAiStructure, setUseAiStructure] = useState(true);
  const [useAiColors, setUseAiColors] = useState(true);
  // Smart resize toggle — proportionally resize content shapes to fit target content area
  const [enableResize, setEnableResize] = useState(false);

  // Handle source file upload
  const handleSourceFile = useCallback(async (file) => {
    setSourceFile(file);
    setSourceLoading(true);
    setError(null);
    setResult(null);
    try {
      const buf = await file.arrayBuffer();
      setSourceBuffer(buf);
      const analysis = await analyzePptx(buf);
      setSourceAnalysis(analysis);
    } catch (err) {
      setError('Failed to parse source PPTX: ' + err.message);
      setSourceFile(null);
      setSourceBuffer(null);
    } finally {
      setSourceLoading(false);
    }
  }, []);

  // Handle target file upload
  const handleTargetFile = useCallback(async (file) => {
    setTargetFile(file);
    setTargetLoading(true);
    setError(null);
    setResult(null);
    try {
      const buf = await file.arrayBuffer();
      setTargetBuffer(buf);
      const analysis = await analyzePptx(buf);
      setTargetAnalysis(analysis);
    } catch (err) {
      setError('Failed to parse target template: ' + err.message);
      setTargetFile(null);
      setTargetBuffer(null);
    } finally {
      setTargetLoading(false);
    }
  }, []);

  // Load target from settings (existing template upload)
  const handleLoadFromSettings = useCallback(async () => {
    setTargetLoading(true);
    setError(null);
    try {
      const stored = await loadTemplateFromStorage();
      if (!stored || !stored.data) {
        setError('No template found in settings. Upload one in Settings > PPTX Template first.');
        return;
      }
      setTargetFile({ name: stored.fileName || 'Settings template' });
      setTargetBuffer(stored.data);
      const analysis = await analyzePptx(stored.data);
      setTargetAnalysis(analysis);
    } catch (err) {
      setError('Failed to load settings template: ' + err.message);
    } finally {
      setTargetLoading(false);
    }
  }, []);

  // Run transform
  const handleTransform = useCallback(async () => {
    if (!sourceBuffer || !targetBuffer) return;
    setIsTransforming(true);
    setError(null);
    setResult(null);
    try {
      const needsAI = (useAiStructure || useAiColors) && hasAnyApiKey(settings);
      const output = await transformPptx(sourceBuffer, targetBuffer, setProgress, {
        keepSourcePositions,
        includeExtraColors,
        headerSizePt,
        contentArea,
        colorGuidance: colorGuidance.trim(),
        callAI: needsAI ? (sys, usr) => callWithModelFallback(settings, sys, usr) : null,
        aiStructure: useAiStructure,
        aiColors: useAiColors,
        enableResize,
      });
      setResult(output);
    } catch (err) {
      console.error('[Transform] Error:', err);
      setError('Transform failed: ' + err.message);
    } finally {
      setIsTransforming(false);
    }
  }, [sourceBuffer, targetBuffer, keepSourcePositions, includeExtraColors, headerSizePt, contentArea, colorGuidance, settings, useAiStructure, useAiColors, enableResize]);

  // Download result
  const handleDownload = useCallback(() => {
    if (!result?.buffer) return;
    const blob = new Blob([result.buffer], {
      type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const baseName = sourceFile?.name?.replace(/\.pptx$/i, '') || 'presentation';
    a.download = `${baseName}_transformed.pptx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [result, sourceFile]);

  const canTransform = sourceBuffer && targetBuffer && !isTransforming;

  return (
    <div
      className="modal-overlay"
      onClick={onClose}
      style={{ zIndex: 1100 }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'white',
          borderRadius: 16,
          width: '92%',
          maxWidth: 800,
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 25px 60px rgba(0,0,0,0.3)',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div style={{
          padding: '18px 24px',
          borderBottom: '1px solid #e6e9ee',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#111' }}>
              Transform Presentation
            </h2>
            <p style={{ margin: '4px 0 0', fontSize: 12, color: '#888' }}>
              Recolor and rebrand an existing PPTX with a target template
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none', border: 'none', color: '#999', cursor: 'pointer',
              fontSize: 22, lineHeight: 1, padding: '4px 8px', borderRadius: 6,
            }}
          >
            &times;
          </button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflow: 'auto', padding: 24 }}>

          {/* Upload zones */}
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 20 }}>
            <DropZone
              label="Source Presentation"
              description="The PPTX you want to transform"
              file={sourceFile}
              onFile={handleSourceFile}
              onClear={() => { setSourceFile(null); setSourceBuffer(null); setSourceAnalysis(null); setResult(null); }}
              analysis={sourceAnalysis}
              loading={sourceLoading}
            />
            <DropZone
              label="Target Template"
              description="The template to apply (colors, master, layouts)"
              file={targetFile}
              onFile={handleTargetFile}
              onClear={() => { setTargetFile(null); setTargetBuffer(null); setTargetAnalysis(null); setResult(null); }}
              analysis={targetAnalysis}
              loading={targetLoading}
            />
          </div>

          {/* Load from settings button */}
          {!targetFile && (
            <div style={{ textAlign: 'center', marginBottom: 20 }}>
              <button
                onClick={handleLoadFromSettings}
                disabled={targetLoading}
                style={{
                  background: 'none',
                  border: '1px solid #d1d5db',
                  borderRadius: 8,
                  padding: '8px 16px',
                  fontSize: 12,
                  color: '#555',
                  cursor: 'pointer',
                }}
              >
                Or load template from Settings
              </button>
            </div>
          )}

          {/* Color mapping preview */}
          {sourceAnalysis && targetAnalysis && (
            <div style={{
              background: '#f9fafb',
              borderRadius: 10,
              padding: 16,
              marginBottom: 20,
              border: '1px solid #e6e9ee',
            }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#333', marginBottom: 10 }}>
                Color Mapping Preview
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10, fontSize: 12, color: '#555', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={includeExtraColors}
                  onChange={e => setIncludeExtraColors(e.target.checked)}
                  style={{ margin: 0 }}
                />
                Include non-theme colors in target palette
              </label>
              <ColorMapPreview
                sourceColors={sourceAnalysis.colors}
                targetColors={targetAnalysis.colors}
                sourceHexValues={sourceAnalysis.hexValues}
                targetHexValues={targetAnalysis.hexValues}
                includeExtraColors={includeExtraColors}
              />

              {/* AI color guidance */}
              <div style={{ marginTop: 12 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#666', marginBottom: 4 }}>
                  Color mapping guidance (AI)
                </div>
                <textarea
                  value={colorGuidance}
                  onChange={e => setColorGuidance(e.target.value)}
                  placeholder='e.g. "Map blues to dark navy, keep subtitle burgundy, warm tones preferred"'
                  style={{
                    width: '100%',
                    minHeight: 48,
                    padding: '8px 10px',
                    fontSize: 12,
                    border: '1px solid #d1d5db',
                    borderRadius: 6,
                    resize: 'vertical',
                    fontFamily: 'inherit',
                    boxSizing: 'border-box',
                  }}
                />
                {colorGuidance.trim() && !hasAnyApiKey(settings) && (
                  <div style={{ fontSize: 11, color: '#b45309', marginTop: 4 }}>
                    No API key configured — guidance will be ignored. Add one in Settings.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Transform options */}
          {sourceAnalysis && targetAnalysis && (
            <div style={{
              background: '#f9fafb',
              borderRadius: 10,
              padding: 16,
              marginBottom: 20,
              border: '1px solid #e6e9ee',
            }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#333', marginBottom: 10 }}>
                Layout Parameters
              </div>
              <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap', marginBottom: 10 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#555' }}>
                  Header size (pt)
                  <input
                    type="number"
                    min={10}
                    max={72}
                    value={headerSizePt}
                    onChange={e => setHeaderSizePt(Math.max(10, Math.min(72, parseInt(e.target.value) || 28)))}
                    style={{ width: 52, padding: '4px 6px', fontSize: 12, border: '1px solid #d1d5db', borderRadius: 4, textAlign: 'center' }}
                  />
                </label>
              </div>
              <div style={{ fontSize: 11, fontWeight: 600, color: '#666', marginBottom: 6 }}>
                Content area (inches) — where body content fits
              </div>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                {[
                  { key: 'x', label: 'Left (x)' },
                  { key: 'y', label: 'Top (y)' },
                  { key: 'w', label: 'Width' },
                  { key: 'h', label: 'Height' },
                ].map(({ key, label }) => (
                  <label key={key} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#555' }}>
                    {label}
                    <input
                      type="number"
                      step={0.1}
                      min={0}
                      max={key === 'w' ? 13.33 : key === 'h' ? 7.5 : key === 'x' ? 6 : 5}
                      value={contentArea[key]}
                      onChange={e => setContentArea(prev => ({ ...prev, [key]: parseFloat(e.target.value) || prev[key] }))}
                      style={{ width: 56, padding: '3px 5px', fontSize: 11, border: '1px solid #d1d5db', borderRadius: 4, textAlign: 'center' }}
                    />
                  </label>
                ))}
              </div>
              <div style={{ fontSize: 10, color: '#999', marginTop: 4 }}>
                Standard: x=0.48, y=1.90, w=12.36, h=4.50 (on 13.33" × 7.5" slide)
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div style={{
              background: '#fef2f2',
              border: '1px solid #fecaca',
              borderRadius: 8,
              padding: '12px 16px',
              marginBottom: 16,
              color: '#991b1b',
              fontSize: 13,
            }}>
              {error}
            </div>
          )}

          {/* Progress */}
          {isTransforming && progress && (
            <div style={{
              background: '#f0f4ff',
              border: '1px solid #c7d2fe',
              borderRadius: 8,
              padding: '16px',
              marginBottom: 16,
              textAlign: 'center',
            }}>
              <div style={{ fontSize: 13, fontWeight: 500, color: '#333', marginBottom: 8 }}>
                {progress.message}
              </div>
              {progress.total && (
                <div style={{
                  height: 6,
                  background: '#e0e7ff',
                  borderRadius: 3,
                  overflow: 'hidden',
                  maxWidth: 300,
                  margin: '0 auto',
                }}>
                  <div style={{
                    height: '100%',
                    background: '#4f46e5',
                    borderRadius: 3,
                    width: `${(progress.current / progress.total) * 100}%`,
                    transition: 'width 0.3s ease',
                  }} />
                </div>
              )}
            </div>
          )}

          {/* Result */}
          {result && (
            <div style={{
              background: '#f0fdf4',
              border: '1px solid #bbf7d0',
              borderRadius: 8,
              padding: '16px',
              marginBottom: 16,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M9 12l2 2 4-4" />
                </svg>
                <span style={{ fontSize: 14, fontWeight: 600, color: '#166534' }}>
                  Transform complete!
                </span>
              </div>
              <div style={{ fontSize: 12, color: '#555', marginBottom: 12 }}>
                {result.metadata.slideCount} slides transformed.
                {Object.keys(result.metadata.colorMap).length > 0
                  ? ` ${Object.keys(result.metadata.colorMap).length} color slots remapped.`
                  : ' No hardcoded colors needed remapping.'}
              </div>
              <button
                onClick={handleDownload}
                style={{
                  background: '#166534',
                  color: 'white',
                  border: 'none',
                  borderRadius: 8,
                  padding: '10px 24px',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Download Transformed PPTX
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '14px 24px',
          borderTop: '1px solid #e6e9ee',
          display: 'flex',
          justifyContent: 'flex-end',
          gap: 10,
        }}>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: '1px solid #d1d5db',
              borderRadius: 8,
              padding: '9px 20px',
              fontSize: 13,
              color: '#555',
              cursor: 'pointer',
            }}
          >
            Close
          </button>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#555', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={keepSourcePositions}
              onChange={e => setKeepSourcePositions(e.target.checked)}
            />
            Keep source positions
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#555', cursor: 'pointer' }} title="Proportionally resize content shapes to fit target content area. Only affects content-zone shapes on classic template slides.">
            <input
              type="checkbox"
              checked={enableResize}
              onChange={e => setEnableResize(e.target.checked)}
            />
            Resize content
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: hasAnyApiKey(settings) ? '#555' : '#aaa', cursor: hasAnyApiKey(settings) ? 'pointer' : 'default' }}>
            <input
              type="checkbox"
              checked={useAiStructure}
              onChange={e => setUseAiStructure(e.target.checked)}
              disabled={!hasAnyApiKey(settings)}
            />
            AI structure
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: hasAnyApiKey(settings) ? '#555' : '#aaa', cursor: hasAnyApiKey(settings) ? 'pointer' : 'default' }}>
            <input
              type="checkbox"
              checked={useAiColors}
              onChange={e => setUseAiColors(e.target.checked)}
              disabled={!hasAnyApiKey(settings)}
            />
            AI colors
          </label>
          <button
            onClick={handleTransform}
            disabled={!canTransform}
            style={{
              background: canTransform ? '#8E1E1E' : '#ccc',
              color: 'white',
              border: 'none',
              borderRadius: 8,
              padding: '9px 24px',
              fontSize: 13,
              fontWeight: 600,
              cursor: canTransform ? 'pointer' : 'not-allowed',
              opacity: canTransform ? 1 : 0.6,
            }}
          >
            {isTransforming ? 'Transforming...' : 'Transform'}
          </button>
        </div>
      </div>
    </div>
  );
}
