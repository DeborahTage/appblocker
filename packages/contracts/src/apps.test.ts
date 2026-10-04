import { describe, expect, it } from 'vitest';
import { displayNameForProcess, matchesAppList, normalizeProcessName } from './apps.js';

describe('app normalization', () => {
  it('maps known executables to display names', () => {
    expect(displayNameForProcess('Code.exe')).toBe('VS Code');
    expect(displayNameForProcess('chrome.exe')).toBe('Browser');
    expect(displayNameForProcess('Discord.exe')).toBe('Discord');
  });

  it('never returns paths', () => {
    expect(displayNameForProcess('C:\\Program Files\\App\\foo.exe')).toBe('foo');
  });

  it('matches allow/block lists case-insensitively', () => {
    expect(matchesAppList('code.exe', ['Code.exe'])).toBe(true);
    expect(normalizeProcessName('Code.EXE')).toBe('code.exe');
  });
});
