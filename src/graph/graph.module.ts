// NEW FILE: src/graph/graph.module.ts

import { Module } from '@nestjs/common';
import { GraphMergeService } from './graph-merge.service';

@Module({
  providers: [GraphMergeService],
  exports: [GraphMergeService],
})
export class GraphModule {}