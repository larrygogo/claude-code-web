export interface Project {
  id: string;
  userId: string;
  name: string;
  path: string;
  pathHash: string;
  claudeMdContent?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProjectCreateInput {
  name: string;
  path: string;
}

export interface ProjectListItem {
  id: string;
  name: string;
  path: string;
  sessionCount: number;
  lastAccessedAt: Date;
}

export interface ProjectContext {
  project: Project;
  claudeMd?: string;
  fileTree?: FileTreeNode[];
}

export interface FileTreeNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  children?: FileTreeNode[];
}
