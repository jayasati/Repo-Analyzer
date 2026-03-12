import { Hotspot } from "./hotspot.types";
import { computeGraphStats } from "../utils/graph-stats";

import { Injectable } from '@nestjs/common';

@Injectable()
export class HotspotDetectorService {

  detect(edges: { from: string; to: string }[]): Hotspot[] {
    const stats = computeGraphStats(edges);
    const fanOut = stats.fanOut;
    const moduleCount = stats.modules.size;

    // Adaptive thresholds: scale with repo size so small repos
    // still surface hotspots meaningfully
    const highThreshold = Math.max(Math.ceil(moduleCount * 0.5), 6);
    const mediumThreshold = Math.max(Math.ceil(moduleCount * 0.3), 3);

    const hotspots: Hotspot[] = [];

    fanOut.forEach((count, module) => {
      let risk: 'low' | 'medium' | 'high';

      if (count >= highThreshold) risk = 'high';
      else if (count >= mediumThreshold) risk = 'medium';
      else risk = 'low';

      if (risk !== 'low') {
        hotspots.push({ module, fanOut: count, risk });
      }
    });

    return hotspots.sort((a, b) => b.fanOut - a.fanOut);
  }
}