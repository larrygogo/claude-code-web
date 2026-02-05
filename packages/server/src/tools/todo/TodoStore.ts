/**
 * TodoStore - 会话级任务存储
 */

export interface TodoItem {
  id: string;
  subject: string;
  description?: string;
  status: 'pending' | 'in_progress' | 'completed';
  blockedBy?: string[];
  createdAt: Date;
  updatedAt: Date;
}

// 会话级别的任务存储
// key: sessionId, value: Map<todoId, TodoItem>
const sessionTodos = new Map<string, Map<string, TodoItem>>();

// ID 计数器（每个会话独立）
const idCounters = new Map<string, number>();

/**
 * 获取或创建会话的 todo 存储
 */
function getSessionStore(sessionId: string): Map<string, TodoItem> {
  if (!sessionTodos.has(sessionId)) {
    sessionTodos.set(sessionId, new Map());
    idCounters.set(sessionId, 0);
  }
  return sessionTodos.get(sessionId)!;
}

/**
 * 生成新的 todo ID
 */
function generateId(sessionId: string): string {
  const counter = (idCounters.get(sessionId) || 0) + 1;
  idCounters.set(sessionId, counter);
  return `todo-${counter}`;
}

/**
 * 创建新任务
 */
export function createTodo(
  sessionId: string,
  subject: string,
  description?: string,
  blockedBy?: string[]
): TodoItem {
  const store = getSessionStore(sessionId);
  const id = generateId(sessionId);
  const now = new Date();

  const todo: TodoItem = {
    id,
    subject,
    description,
    status: 'pending',
    blockedBy: blockedBy || [],
    createdAt: now,
    updatedAt: now,
  };

  store.set(id, todo);
  return todo;
}

/**
 * 获取任务
 */
export function getTodo(sessionId: string, todoId: string): TodoItem | undefined {
  const store = getSessionStore(sessionId);
  return store.get(todoId);
}

/**
 * 更新任务
 */
export function updateTodo(
  sessionId: string,
  todoId: string,
  updates: Partial<Pick<TodoItem, 'subject' | 'description' | 'status' | 'blockedBy'>>
): TodoItem | undefined {
  const store = getSessionStore(sessionId);
  const todo = store.get(todoId);

  if (!todo) return undefined;

  const updatedTodo: TodoItem = {
    ...todo,
    ...updates,
    updatedAt: new Date(),
  };

  store.set(todoId, updatedTodo);
  return updatedTodo;
}

/**
 * 删除任务
 */
export function deleteTodo(sessionId: string, todoId: string): boolean {
  const store = getSessionStore(sessionId);
  return store.delete(todoId);
}

/**
 * 获取所有任务
 */
export function getAllTodos(sessionId: string): TodoItem[] {
  const store = getSessionStore(sessionId);
  return Array.from(store.values()).sort((a, b) =>
    a.createdAt.getTime() - b.createdAt.getTime()
  );
}

/**
 * 按状态过滤任务
 */
export function getTodosByStatus(
  sessionId: string,
  status: 'pending' | 'in_progress' | 'completed'
): TodoItem[] {
  return getAllTodos(sessionId).filter(todo => todo.status === status);
}

/**
 * 清除会话的所有任务
 */
export function clearSessionTodos(sessionId: string): void {
  sessionTodos.delete(sessionId);
  idCounters.delete(sessionId);
}

/**
 * 获取任务统计
 */
export function getTodoStats(sessionId: string): {
  total: number;
  pending: number;
  inProgress: number;
  completed: number;
} {
  const todos = getAllTodos(sessionId);
  return {
    total: todos.length,
    pending: todos.filter(t => t.status === 'pending').length,
    inProgress: todos.filter(t => t.status === 'in_progress').length,
    completed: todos.filter(t => t.status === 'completed').length,
  };
}
