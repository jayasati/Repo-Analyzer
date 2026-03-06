import { ArchitectureMetrics } from "./architecture-metrics.types";
import { extractModules } from "../utils/module-utils";

export class ArchitectureMetricsService {

    //improving modularity by introducing this fan-in/fan-out module(Reusable)
    computeFanInOut(edges: { from: string; to: string }[]) {

        const fanIn = new Map<string, number>();
        const fanOut = new Map<string, number>();

        for (const edge of edges) {

            fanOut.set(
            edge.from,
            (fanOut.get(edge.from) ?? 0) + 1
            );

            fanIn.set(
            edge.to,
            (fanIn.get(edge.to) ?? 0) + 1
            );

        }

        return { fanIn, fanOut };
    }

    compute(
        edges: { from: string; to: string }[],
        cycles: { nodes: string[] }[]
    ): ArchitectureMetrics {

        const { fanIn, fanOut } = this.computeFanInOut(edges);

        const avgFanIn =Array.from(fanIn.values()).reduce((a, b) => a + b, 0) /(fanIn.size || 1);

        const avgFanOut =Array.from(fanOut.values()).reduce((a, b) => a + b, 0) /(fanOut.size || 1);

        const maxFanOut =Math.max(...Array.from(fanOut.values()), 0);

        const modules = extractModules(edges);
        const moduleCount = modules.length;
        const dependencyCount = edges.length;

        const maxPossibleDependencies =
        moduleCount * (moduleCount - 1);

        const dependencyDensity =
        dependencyCount / (maxPossibleDependencies || 1);

        return {

            moduleCount,

            dependencyCount,

            cycleCount: cycles.length,

            averageFanIn: Number(avgFanIn.toFixed(2)),

            averageFanOut: Number(avgFanOut.toFixed(2)),

            dependencyDensity: Number(dependencyDensity.toFixed(3)),

            maxFanOut,
        };

    }

}