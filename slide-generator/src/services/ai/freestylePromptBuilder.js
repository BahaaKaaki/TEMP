import DEFAULT_SHELL from '../../guides/freestyle-shell.md?raw';
import DEFAULT_THEME from '../../guides/freestyle-theme.md?raw';
import DEFAULT_VIBE from '../../guides/freestyle-vibe.md?raw';
import DEFAULT_WRITING from '../../guides/freestyle-writing.md?raw';

export { DEFAULT_SHELL, DEFAULT_THEME, DEFAULT_VIBE, DEFAULT_WRITING };

export function buildFreestyleSystemPrompt(settings = {}) {
  const shellCustom = !!(settings.freestyleShell && settings.freestyleShell.trim());
  const themeCustom = !!(settings.freestyleTheme && settings.freestyleTheme.trim());
  const vibeCustom = !!(settings.freestyleVibe && settings.freestyleVibe.trim());
  const writingCustom = !!(settings.freestyleWriting && settings.freestyleWriting.trim());

  const shell = shellCustom ? settings.freestyleShell : DEFAULT_SHELL;
  const theme = themeCustom ? settings.freestyleTheme : DEFAULT_THEME;
  const vibe = vibeCustom ? settings.freestyleVibe : DEFAULT_VIBE;
  const writing = writingCustom ? settings.freestyleWriting : DEFAULT_WRITING;

  const assembled = [shell, theme, vibe, writing].join('\n\n---\n\n');

  console.groupCollapsed(
    '[FreestylePrompt] Assembled system prompt (%d chars) — Shell:%s Theme:%s Vibe:%s Writing:%s',
    assembled.length,
    shellCustom ? 'CUSTOM' : 'default',
    themeCustom ? 'CUSTOM' : 'default',
    vibeCustom ? 'CUSTOM' : 'default',
    writingCustom ? 'CUSTOM' : 'default'
  );
  console.groupCollapsed('Shell (%d chars)', shell.length);
  console.log(shell);
  console.groupEnd();
  console.groupCollapsed('Theme (%d chars)', theme.length);
  console.log(theme);
  console.groupEnd();
  console.groupCollapsed('Vibe (%d chars)', vibe.length);
  console.log(vibe);
  console.groupEnd();
  console.groupCollapsed('Writing (%d chars)', writing.length);
  console.log(writing);
  console.groupEnd();
  console.groupEnd();

  return assembled;
}
