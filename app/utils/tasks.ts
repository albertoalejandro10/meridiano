import type { TaskPriority } from '~~/shared/schemas'

// Client-side shape of a task row returned by /api/v1/tasks.
export interface TaskView {
  id: string
  categoryId: string | null
  longTaskId: string | null
  title: string
  notes: string | null
  priority: string
  month: string
  dueDate: string | null
  done: boolean
  completedAt: string | null
  carriedFromMonth: string | null
  createdAt: string
  updatedAt: string
}

// Client-side shape of a long task from /api/v1/long-tasks (linked counts are
// the derived progress over its monthly next actions).
export interface LongTaskView {
  id: string
  categoryId: string | null
  title: string
  notes: string | null
  priority: string
  targetDate: string | null
  done: boolean
  completedAt: string | null
  linkedCount: number
  linkedDoneCount: number
}

// Client-side shape of a task category from /api/v1/task-categories.
export interface TaskCategoryView {
  id: string
  name: string
  icon: string | null
  color: string | null
}

interface TaskPriorityMeta {
  /** i18n key — render with t(labelKey) */
  labelKey: string
  /** UBadge color for the priority pill */
  color: 'error' | 'warning' | 'neutral'
  /** Sort rank within a group (lower = first) */
  rank: number
}

export const taskPriorityMeta: Record<TaskPriority, TaskPriorityMeta> = {
  HIGH: { labelKey: 'tasks.priorities.HIGH', color: 'error', rank: 0 },
  MEDIUM: { labelKey: 'tasks.priorities.MEDIUM', color: 'warning', rank: 1 },
  LOW: { labelKey: 'tasks.priorities.LOW', color: 'neutral', rank: 2 },
}

export function taskPriority(priority: string): TaskPriorityMeta {
  return taskPriorityMeta[priority as TaskPriority] ?? taskPriorityMeta.MEDIUM
}

/** Past its due day and still pending ('yyyy-MM-dd' string compare is safe). */
export function isTaskOverdue(task: Pick<TaskView, 'done' | 'dueDate'>): boolean {
  return !task.done && !!task.dueDate && task.dueDate < toISODate(today())
}

/** Long-task variant: past its target date and still pending. */
export function isLongTaskOverdue(task: Pick<LongTaskView, 'done' | 'targetDate'>): boolean {
  return !task.done && !!task.targetDate && task.targetDate < toISODate(today())
}
