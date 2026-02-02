import { count } from 'console';
import { UnifiedGraph } from '../graph/unified-graph.types';

export interface ArchitectureSmell {
  type: string;
  message: string;
  severity: 'low' | 'medium' | 'high';
  node?: string;
}


export class SmellDewtectorService{
    detect(graph : UnifiedGraph): ArchitectureSmell[]{
        const smells :ArchitectureSmell[]=[];

        const outgoingCount=new Map<string,number>();

        for(const edge of graph.edges){
            outgoingCount.set(
                edge.from,
                (outgoingCount.get(edge.from)??0)+1,
            );
        }

        //God Object Smell 

        for(const [node,count] of outgoingCount.entries()){

            if(count>=10){
                smells.push({
                    type: 'god-object',
                    message: `${node} has too many outgoing dependencies (${count})`,
                    severity: 'high',
                    node,
                    });
                }

            }
        return smells;
    }
    
}