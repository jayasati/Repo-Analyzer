import { Injectable } from '@nestjs/common';
import { FileNode } from '../core/types/file-node.type';
import { DetectionResult, DetectedLanguage } from './detection-result.type';

@Injectable()
export class LanguageDetectorService{
    
    private collectExtensions(node:FileNode,acc:Record<string,number>={}){
        if(node.type==='file'){
            const ext =node.path.split('.').pop() ?? '';

            //Increment count for this extension
            acc[ext]=(acc[ext] || 0)+1;
        }
        node.children?.forEach(child => this.collectExtensions(child,acc));
        return acc;
    }

    //Converts file extension counts into detected
    //programming languages with confidence scores.


    /// (extMap)INPUT: { 'ts': 45, 'js': 30, 'css': 10, 'md': 5 }
    private detectLanguages(extMap:Record<string,number>):DetectedLanguage[]{
        const total=Object.values(extMap).reduce((a,b)=>a+b,0);//give total count of languages


        const mapping: Record<string, string> = {
        ts: 'TypeScript',
        js: 'JavaScript',
        py: 'Python',
        java: 'Java',
        go: 'Go',
        rs: 'Rust',
        cpp: 'C++',
        c: 'C',
        };

        //Start processing - convert extMap to array of [key, value] pairs
        // Object.entries({ 'ts': 45, 'js': 30, 'css': 10, 'md': 5 })
        // → [['ts', 45], ['js', 30], ['css', 10], ['md', 5]]
        return Object.entries(extMap)
                .filter(([ext])=>mapping[ext])//// Keep only if extension exists in mapping
                .map(([ext,count])=>({
                    name:mapping[ext],
                    confidence:Number((count/total).toFixed(2)),//calculate percantage
                }))
                .sort((a, b) => b.confidence - a.confidence);//sort by confidence highest first
    }

    private hasNestJsSignals(node :FileNode):boolean{
        let found =false;

        const visit=(n:FileNode)=>{
            if(n.path.endsWith('app.module.ts')||
            n.path.endsWith('main.ts')){
                found=true;
                return;
            }
            n.children?.forEach(visit);
        }
        visit(node);
        return found;
    }

    private hasPrismaSignals(node:FileNode):boolean{
        let found=false;
        const visit=(n:FileNode)=>{
            if(n.path.endsWith('schema.prisma')){
                found=true;
                return;
            }
            n.children?.forEach(visit);
        };
        visit(node);
        return found;

    }
  detect(fileTree: FileNode): DetectionResult {
    const extensions = this.collectExtensions(fileTree);

    const languages = this.detectLanguages(extensions);
    const hasNest = this.hasNestJsSignals(fileTree);
    const hasPrisma = this.hasPrismaSignals(fileTree);

    return {
      languages,
      framework: hasNest ? 'nestjs' : undefined,
      orm: hasPrisma ? 'prisma' : undefined,
      analysisDepth: hasNest ? 'framework' : 'structural',
    };
  }


}