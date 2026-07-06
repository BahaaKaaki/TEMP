import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { api, Theme, ParsedTheme } from '../services/apiClient';
import { parseDocument, isFileSupported } from '../services/documentParser';

interface ThemeCreatorProps {
  onClose: () => void;
  onThemeSelect?: (css: string) => void;
}

export default function ThemeCreator({ onClose, onThemeSelect }: ThemeCreatorProps) {
  const { isAuthenticated } = useAuth();
  const [mode, setMode] = useState<'list' | 'create' | 'preview'>('list');
  const [themes, setThemes] = useState<Theme[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Create form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [htmlContent, setHtmlContent] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const [parsedResult, setParsedResult] = useState<ParsedTheme | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [isUploadingFile, setIsUploadingFile] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!isFileSupported(file)) {
      setError('Unsupported file type. Supported: PDF, Word, Excel, PowerPoint, Text, Images');
      return;
    }

    setIsUploadingFile(true);
    setError(null);

    try {
      const result = await parseDocument(file, {});
      if (result?.content) {
        setHtmlContent(result.content);
      } else {
        setError('Could not extract content from file');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to parse file');
    } finally {
      setIsUploadingFile(false);
      // Reset file input so the same file can be re-uploaded
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Load themes on mount
  useEffect(() => {
    if (isAuthenticated) {
      loadThemes();
    }
  }, [isAuthenticated]);

  const loadThemes = async () => {
    setLoading(true);
    try {
      const data = await api.themes.list();
      setThemes(data);
    } catch (err) {
      console.error('Failed to load themes:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleParse = async () => {
    if (!htmlContent.trim()) {
      setError('Please paste HTML content from your style guide');
      return;
    }

    setIsParsing(true);
    setError(null);

    try {
      const result = await api.themes.parse(htmlContent);
      setParsedResult(result);
      setMode('preview');
    } catch (err: any) {
      setError(err.message || 'Failed to parse style guide');
    } finally {
      setIsParsing(false);
    }
  };

  const handleCreate = async () => {
    if (!name.trim()) {
      setError('Please enter a theme name');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await api.themes.create({
        name,
        description: description || undefined,
        htmlContent,
        isPublic,
      });
      await loadThemes();
      setMode('list');
      // Reset form
      setName('');
      setDescription('');
      setHtmlContent('');
      setParsedResult(null);
    } catch (err: any) {
      setError(err.message || 'Failed to create theme');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this theme?')) return;

    try {
      await api.themes.delete(id);
      setThemes(themes.filter(t => t.id !== id));
    } catch (err: any) {
      setError(err.message || 'Failed to delete theme');
    }
  };

  const handleApplyTheme = (theme: Theme) => {
    if (onThemeSelect) {
      onThemeSelect(theme.generatedCSS);
      onClose();
    }
  };

  const renderColorSwatch = (colors: Record<string, string>) => {
    const entries = Object.entries(colors).slice(0, 8);
    return (
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {entries.map(([name, value]) => (
          <div key={name} style={{ textAlign: 'center' }}>
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 8,
                backgroundColor: value,
                border: '1px solid #ddd',
                boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
              }}
            />
            <div style={{ fontSize: 10, color: '#666', marginTop: 4 }}>{name}</div>
          </div>
        ))}
      </div>
    );
  };

  if (!isAuthenticated) {
    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 400 }}>
          <h2>Sign In Required</h2>
          <p style={{ color: '#666', marginBottom: 20 }}>
            Please sign in to create and manage themes.
          </p>
          <button className="btn btn-primary" onClick={onClose}>Close</button>
        </div>
        <style>{modalStyles}</style>
      </div>
    );
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content theme-creator" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>
            {mode === 'list' && 'Theme Manager'}
            {mode === 'create' && 'Create Theme from Style Guide'}
            {mode === 'preview' && 'Preview Extracted Styles'}
          </h2>
          <button className="close-btn" onClick={onClose}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {error && (
          <div className="error-banner">{error}</div>
        )}

        {mode === 'list' && (
          <>
            <div className="modal-actions">
              <button className="btn btn-primary" onClick={() => setMode('create')}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 5v14M5 12h14" />
                </svg>
                Create from Style Guide
              </button>
            </div>

            {loading ? (
              <div className="loading">Loading themes...</div>
            ) : themes.length === 0 ? (
              <div className="empty-state">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#ccc" strokeWidth="1.5">
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                </svg>
                <p>No themes yet</p>
                <p className="hint">Create a theme by uploading HTML from your brand style guide</p>
              </div>
            ) : (
              <div className="themes-grid">
                {themes.map(theme => (
                  <div key={theme.id} className="theme-card">
                    <div className="theme-card-header">
                      <h3>{theme.name}</h3>
                      {theme.isPublic && <span className="badge">Public</span>}
                    </div>
                    {theme.description && (
                      <p className="theme-description">{theme.description}</p>
                    )}
                    <div className="theme-colors">
                      {renderColorSwatch(theme.extractedStyles.colors)}
                    </div>
                    <div className="theme-fonts">
                      {theme.extractedStyles.fonts.heading && (
                        <span style={{ fontFamily: theme.extractedStyles.fonts.heading }}>
                          Heading: {theme.extractedStyles.fonts.heading.split(',')[0]}
                        </span>
                      )}
                    </div>
                    <div className="theme-card-actions">
                      <button className="btn btn-sm btn-primary" onClick={() => handleApplyTheme(theme)}>
                        Apply
                      </button>
                      <button className="btn btn-sm btn-ghost" onClick={() => handleDelete(theme.id)}>
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {mode === 'create' && (
          <div className="create-form">
            <div className="form-group">
              <label>Theme Name *</label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="e.g., Corporate Brand 2024"
              />
            </div>

            <div className="form-group">
              <label>Description</label>
              <input
                type="text"
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Brief description of this theme"
              />
            </div>

            <div className="form-group">
              <label>Style Guide Content *</label>
              <p className="hint">
                Paste HTML from your brand style guide, or upload a PDF / Word / text file.
                The system will extract colors, fonts, spacing, and CSS variables.
              </p>
              <div className="upload-row">
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploadingFile}
                  type="button"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="17 8 12 3 7 8" />
                    <line x1="12" y1="3" x2="12" y2="15" />
                  </svg>
                  {isUploadingFile ? 'Parsing file...' : 'Upload PDF / Document'}
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.doc,.docx,.txt,.md,.rtf,.html,.htm"
                  onChange={handleFileUpload}
                  style={{ display: 'none' }}
                />
              </div>
              <textarea
                value={htmlContent}
                onChange={e => setHtmlContent(e.target.value)}
                placeholder={`<html>
<head>
  <style>
    :root {
      --primary-color: #8E1E1E;
      --secondary-color: #4A4F57;
      --font-heading: "Helvetica Neue", sans-serif;
      /* ... more variables */
    }
  </style>
</head>
<body>
  <!-- Color swatches, typography samples, etc. -->
</body>
</html>`}
                rows={12}
              />
            </div>

            <div className="form-group checkbox-group">
              <label>
                <input
                  type="checkbox"
                  checked={isPublic}
                  onChange={e => setIsPublic(e.target.checked)}
                />
                Make this theme public (visible to all users)
              </label>
            </div>

            <div className="form-actions">
              <button className="btn btn-ghost" onClick={() => setMode('list')}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={handleParse} disabled={isParsing}>
                {isParsing ? 'Parsing...' : 'Preview Extracted Styles'}
              </button>
            </div>
          </div>
        )}

        {mode === 'preview' && parsedResult && (
          <div className="preview-content">
            <div className="preview-section">
              <h3>Extracted Colors</h3>
              {renderColorSwatch(parsedResult.extractedStyles.colors)}
            </div>

            <div className="preview-section">
              <h3>Fonts</h3>
              <div className="font-preview">
                {Object.entries(parsedResult.extractedStyles.fonts).map(([key, value]) => (
                  <div key={key}>
                    <span className="font-label">{key}:</span>
                    <span style={{ fontFamily: value }}>{value}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="preview-section">
              <h3>Spacing</h3>
              <div className="spacing-preview">
                {Object.entries(parsedResult.extractedStyles.spacing).map(([key, value]) => (
                  <div key={key}>
                    <span>{key}: {value}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="preview-section">
              <h3>Generated CSS</h3>
              <pre className="css-preview">{parsedResult.generatedCSS}</pre>
            </div>

            <div className="form-actions">
              <button className="btn btn-ghost" onClick={() => setMode('create')}>
                Back to Edit
              </button>
              <button className="btn btn-primary" onClick={handleCreate} disabled={loading}>
                {loading ? 'Saving...' : 'Save Theme'}
              </button>
            </div>
          </div>
        )}
      </div>
      <style>{modalStyles}</style>
    </div>
  );
}

const modalStyles = `
  .modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.6);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 200;
    padding: 20px;
  }

  .modal-content.theme-creator {
    background: white;
    border-radius: 12px;
    width: 100%;
    max-width: 700px;
    max-height: 85vh;
    overflow-y: auto;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  }

  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 20px 24px;
    border-bottom: 1px solid #eee;
    position: sticky;
    top: 0;
    background: white;
    z-index: 1;
  }

  .modal-header h2 {
    margin: 0;
    font-size: 20px;
    font-weight: 600;
  }

  .close-btn {
    background: none;
    border: none;
    cursor: pointer;
    color: #666;
    padding: 4px;
    border-radius: 4px;
  }

  .close-btn:hover {
    background: #f0f0f0;
    color: #333;
  }

  .error-banner {
    background: #fef2f2;
    border: 1px solid #fecaca;
    color: #dc2626;
    padding: 12px 24px;
    font-size: 14px;
  }

  .modal-actions {
    padding: 16px 24px;
    border-bottom: 1px solid #eee;
  }

  .loading, .empty-state {
    padding: 48px 24px;
    text-align: center;
    color: #666;
  }

  .empty-state svg {
    margin-bottom: 16px;
  }

  .empty-state p {
    margin: 8px 0;
  }

  .empty-state .hint {
    font-size: 13px;
    color: #999;
  }

  .themes-grid {
    padding: 16px 24px;
    display: grid;
    gap: 16px;
  }

  .theme-card {
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    padding: 16px;
  }

  .theme-card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 8px;
  }

  .theme-card-header h3 {
    margin: 0;
    font-size: 16px;
    font-weight: 600;
  }

  .badge {
    background: #dbeafe;
    color: #1d4ed8;
    padding: 2px 8px;
    border-radius: 4px;
    font-size: 11px;
    font-weight: 500;
  }

  .theme-description {
    color: #666;
    font-size: 13px;
    margin: 0 0 12px 0;
  }

  .theme-colors {
    margin-bottom: 12px;
  }

  .theme-fonts {
    font-size: 12px;
    color: #666;
    margin-bottom: 12px;
  }

  .theme-card-actions {
    display: flex;
    gap: 8px;
  }

  .create-form, .preview-content {
    padding: 24px;
  }

  .form-group {
    margin-bottom: 20px;
  }

  .upload-row {
    margin-bottom: 8px;
  }

  .form-group label {
    display: block;
    font-weight: 500;
    margin-bottom: 6px;
    font-size: 14px;
  }

  .form-group input[type="text"],
  .form-group textarea {
    width: 100%;
    padding: 10px 12px;
    border: 1px solid #ddd;
    border-radius: 6px;
    font-size: 14px;
    font-family: inherit;
  }

  .form-group textarea {
    font-family: 'SF Mono', Monaco, monospace;
    font-size: 12px;
    line-height: 1.5;
  }

  .form-group input:focus,
  .form-group textarea:focus {
    outline: none;
    border-color: #8E1E1E;
    box-shadow: 0 0 0 2px rgba(142, 30, 30, 0.1);
  }

  .form-group .hint {
    font-size: 12px;
    color: #666;
    margin-bottom: 8px;
  }

  .checkbox-group label {
    display: flex;
    align-items: center;
    gap: 8px;
    cursor: pointer;
    font-weight: normal;
  }

  .form-actions {
    display: flex;
    justify-content: flex-end;
    gap: 12px;
    padding-top: 16px;
    border-top: 1px solid #eee;
    margin-top: 24px;
  }

  .preview-section {
    margin-bottom: 24px;
  }

  .preview-section h3 {
    font-size: 14px;
    font-weight: 600;
    margin-bottom: 12px;
    color: #333;
  }

  .font-preview, .spacing-preview {
    font-size: 13px;
    color: #666;
  }

  .font-preview > div, .spacing-preview > div {
    margin-bottom: 4px;
  }

  .font-label {
    font-weight: 500;
    margin-right: 8px;
  }

  .css-preview {
    background: #1e1e1e;
    color: #d4d4d4;
    padding: 16px;
    border-radius: 8px;
    font-size: 12px;
    overflow-x: auto;
    white-space: pre-wrap;
    max-height: 200px;
    overflow-y: auto;
  }

  .btn {
    padding: 8px 16px;
    border-radius: 6px;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    border: none;
    transition: all 0.2s;
  }

  .btn-primary {
    background: #8E1E1E;
    color: white;
  }

  .btn-primary:hover:not(:disabled) {
    background: #7a1a1a;
  }

  .btn-primary:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .btn-ghost {
    background: transparent;
    color: #666;
  }

  .btn-ghost:hover {
    background: #f0f0f0;
  }

  .btn-sm {
    padding: 6px 12px;
    font-size: 13px;
  }
`;
