export function buildRepoUrlVariants(raw: string): string[] {
  const trimmed = raw.trim();
  if (!trimmed) return [];

  const noSlash = trimmed.replace(/\/+$/, '');
  const noGit = noSlash.replace(/\.git$/i, '');

  const variants = new Set<string>([trimmed, noSlash, noGit, `${noGit}.git`]);

  if (noGit.startsWith('http://github.com/')) {
    variants.add(noGit.replace('http://', 'https://'));
    variants.add(`${noGit.replace('http://', 'https://')}.git`);
  }
  if (noGit.startsWith('https://github.com/')) {
    variants.add(noGit.replace('https://', 'http://'));
    variants.add(`${noGit.replace('https://', 'http://')}.git`);
  }

  return [...variants].filter(Boolean);
}
