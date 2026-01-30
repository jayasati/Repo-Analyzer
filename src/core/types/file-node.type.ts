export type FileNodeType = 'file' | 'folder';

export interface FileNode {
  path: string;
  type: FileNodeType;
  children?: FileNode[];
}
