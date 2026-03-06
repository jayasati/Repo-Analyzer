import { ArchitectureSmell } from "./smell.types";

export class SmellDetectorService {

  detect(packageEdges: { from: string; to: string }[]) {

    const smells: ArchitectureSmell[] = [];

    const fanOut = new Map<string, number>();
    const fanIn = new Map<string, number>();

    for (const edge of packageEdges) {

      fanOut.set(
        edge.from,
        (fanOut.get(edge.from) ?? 0) + 1
      );

      fanIn.set(
        edge.to,
        (fanIn.get(edge.to) ?? 0) + 1
      );
    }

    // God Module (high fan-out)
    for (const [module, count] of fanOut.entries()) {

      if (count >= 6) {

        smells.push({
          type: "god-module",
          message: `${module} depends on too many modules (${count})`,
          severity: "high",
          module
        });

      }

    }

    // Hub Dependency (high fan-in)
    for (const [module, count] of fanIn.entries()) {

      if (count >= 6) {

        smells.push({
          type: "hub-dependency",
          message: `${module} is depended on by many modules (${count})`,
          severity: "medium",
          module
        });

      }

    }

    //entry Module
    const entryModules = new Set<string>();

    fanOut.forEach((count, module) => {
      const incoming = fanIn.get(module) ?? 0;

      if (incoming === 0 && count > 0) {
        entryModules.add(module);
      }
    });

    // Dead Modules
    const allModules = new Set<string>();

    packageEdges.forEach(e => {
      allModules.add(e.from);
      allModules.add(e.to);
    });

    const usedModules = new Set<string>();

    packageEdges.forEach(e => usedModules.add(e.to));

    for (const module of allModules) {

      const incoming = fanIn.get(module) ?? 0;
      const outgoing = fanOut.get(module) ?? 0;

      const isEntry = entryModules.has(module);

      if (incoming === 0 && outgoing === 0 && !isEntry) {

        smells.push({
          type: "dead-module",
          message: `${module} appears unused`,
          severity: "low",
          module
        });

      }

    }

    return smells;
  }
}