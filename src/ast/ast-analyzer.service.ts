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
      const classes = sourceFile.getClasses().map(cls => {
        const decorators = cls.getDecorators().map(d => ({
          name: d.getName(),
          arguments: d.getArguments().map(arg => arg.getText()),
        }));

        const methods = cls.getMethods().map(m => m.getName());
        const properties = cls.getProperties().map(p => p.getName());

        const constructor = cls.getConstructors()[0];
        const constructorParams =
          constructor?.getParameters().map(p => ({
            name: p.getName(),
            type: p.getType().getText(),
          })) ?? [];
        
        const role = this.classifyNestRole(decorators);

        return {
          name: cls.getName(),
          role,
          decorators,
          methods,
          properties,
          constructorParams,
        };
      });

      if (classes.length === 0) continue;

      result.push({
        filePath: sourceFile.getFilePath(),
        classes,
      });
    }

    return result;
  }
    private classifyNestRole(decorators: { name: string }[]) {
        const names = decorators.map(d => d.name);

        if (names.includes('Controller')) return 'controller';
        if (names.includes('Injectable')) return 'service';
        if (names.includes('Module')) return 'module';

        return 'unknown';
    }


}
