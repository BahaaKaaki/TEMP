import DEFAULT_SHELL from '../../guides/freestyle-shell.md?raw';
import DEFAULT_THEME from '../../guides/freestyle-theme.md?raw';
import DEFAULT_WRITING from '../../guides/freestyle-writing.md?raw';

export { DEFAULT_SHELL, DEFAULT_THEME, DEFAULT_WRITING };

export function buildFreestyleSystemPrompt(settings = {}) {
  const shell = settings.freestyleShell || DEFAULT_SHELL;
  const theme = settings.freestyleTheme || DEFAULT_THEME;
  const writing = settings.freestyleWriting || DEFAULT_WRITING;

  return [shell, theme, writing].join('\n\n---\n\n');
}
