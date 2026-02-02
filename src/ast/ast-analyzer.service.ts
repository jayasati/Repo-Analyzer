import { Project, SyntaxKind , Node, ClassDeclaration  } from 'ts-morph';

type ConstructorParam = {
  name: string;
  type: string;
};

type AstClassInfo = {
  name: string;
  role: 'controller' | 'service' | 'module' | 'unknown';
  constructorParams?: ConstructorParam[];
  moduleMetadata?: Record<string, string[]>;
};

type AstFileInfo = {
  filePath: string;
  classes: AstClassInfo[];
};

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
        const moduleMetadata = role === 'module'
        ? this.extractModuleMetadata(cls)
        : null;

        return {
          name: cls.getName(),
          role,
          decorators,
          methods,
          properties,
          constructorParams,
          moduleMetadata,
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

    private extractModuleMetadata(cls: any) {
        const moduleDecorator = cls.getDecorator('Module');
        if (!moduleDecorator) return null;

        const arg = moduleDecorator.getArguments()[0];
        if (!arg) return null;

        const metadata: Record<string, string[]> = {};

        //Node is the base AST type in ts-morph
        arg.forEachChild((child:Node) => {
            if (!Node.isPropertyAssignment(child)) return;
            
            const key = child.getName();
            const value = child.getInitializer();

            if (!value) return;

            if (Node.isArrayLiteralExpression(value)) {
                metadata[key] = value
                            .getElements()
                            .map(el => el.getText());
            }
        });

        return metadata;
    }

    buildDependencyEdges(astResult: AstFileInfo[]) {
    const edges: { from: string; to: string; type: string }[] = [];

    for (const file of astResult) {
        for (const cls of file.classes) {

        // 🔹 Constructor-based dependency injection
        cls.constructorParams?.forEach(param => {
            edges.push({
            from: cls.name,
            to: param.type,
            type: 'constructor-injection',
            });
        });

        // 🔹 NestJS module wiring
        if (cls.role === 'module' && cls.moduleMetadata) {
            for (const [key, values] of Object.entries(cls.moduleMetadata)) {
            values.forEach(value => {
                edges.push({
                from: cls.name,
                to: value.replace(/[\[\]\s]/g, ''),
                type: `module-${key}`,
                });
            });
            }
        }
        }
    }

    return edges;
    }

    buildSemanticNodes(astResult: AstFileInfo[]) {
        const nodes: { id: string; type: string }[] = [];

        for (const file of astResult) {
            for (const cls of file.classes) {
            nodes.push({
                id: cls.name,
                type: cls.role, // controller | service | module | unknown
            });
            }
        }

        return nodes;
    }






}
