import { Project } from 'ts-morph';
import {
  SemanticAnalyzer,
  SemanticResult,
} from '../interfaces/semantic-analyzer.interface';

export class TypescriptAnalyzer implements SemanticAnalyzer {

  supports(language: string): boolean {
    return language === 'TypeScript' || language === 'JavaScript';
  }

  analyze(projectPath: string): SemanticResult {

    const project = new Project({
      tsConfigFilePath: projectPath + '/tsconfig.json',
      skipAddingFilesFromTsConfig: false,
    });

    const nodes: any[] = [];
    const edges: any[] = [];

    project.getSourceFiles().forEach(file => {

      file.getClasses().forEach(cls => {

        nodes.push({
          id: cls.getName(),
          type: 'class',
        });

        cls.getConstructors().forEach(cons => {

          cons.getParameters().forEach(param => {

            edges.push({
              from: cls.getName(),
              to: param.getType().getText(),
              type: 'constructor-dependency',
            });

          });

        });

      });

    });

    return { nodes, edges };
  }
}