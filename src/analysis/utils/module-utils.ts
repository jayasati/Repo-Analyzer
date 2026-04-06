export function extractModules(
  edges: { from: string; to: string }[],
): string[] {
  const modules = new Set<string>();

  edges.forEach((edge) => {
    modules.add(edge.from);
    modules.add(edge.to);
  });

  return Array.from(modules);
}
