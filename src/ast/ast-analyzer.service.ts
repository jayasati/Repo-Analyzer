import { Project, SyntaxKind } from 'ts-morph';

export class AstAnalyzerService {
  private project: Project;

  constructor(tsconfigPath = 'tsconfig.json') {
    this.project = new Project({
      tsConfigFilePath: tsconfigPath,
      skipAddingFilesFromTsConfig: false,
    });
  }

  analyze() {
    const result: any[] = [];

    for (const sourceFile of this.project.getSourceFiles()) {
      const fileInfo = {
        filePath: sourceFile.getFilePath(),
        imports: sourceFile
          .getImportDeclarations()
          .map(i => i.getModuleSpecifierValue()),
        classes: sourceFile.getClasses().map(cls => cls.getName()),
        functions: sourceFile
          .getFunctions()
          .map(fn => fn.getName()),
      };

      result.push(fileInfo);
    }

    return result;
  }
}
