import { Hotspot } from "./hotspot.types";
import { computeGraphStats } from "../utils/graph-stats";

export class HotspotDetectorService {

  detect(
    edges: { from: string; to: string }[]
  ): Hotspot[] {

    const stats = computeGraphStats(edges);

    const fanOut = stats.fanOut;

    const hotspots: Hotspot[] = [];

    fanOut.forEach((count, module) => {

      let risk: "low" | "medium" | "high";

      if (count >= 15) risk = "high";
      else if (count >= 8) risk = "medium";
      else risk = "low";

      if (risk !== "low") {
        hotspots.push({
          module,
          fanOut: count,
          risk
        });
      }

    });

    return hotspots.sort((a, b) =>
      b.fanOut - a.fanOut
    );

  }

}