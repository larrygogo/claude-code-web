export interface Project {
  id: string;
  userId: string;
  name: string;
  path?: string;
  pathHash?: string;
  description?: string;
  instructions?: string;
  claudeMdContent?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProjectCreateInput {
  name: string;
  path?: string;
  description?: string;
  instructions?: string;
}

export interface ProjectUpdateInput {
  name?: string;
  description?: string;
  instructions?: string;
}

export interface ProjectListItem {
  id: string;
  name: string;
  path?: string;
  description?: string;
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
