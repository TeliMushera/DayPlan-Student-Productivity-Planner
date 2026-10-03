export type Task = { id: string; title: string; description: string; priority: 'high'|'medium'|'low'; status: 'pending'|'in_progress'|'completed'; dueDate: string|null; dueTime: string|null; estimatedMinutes: number|null; category: string; reminder: number|null; subtasks: { t: string; d: boolean }[]; createdAt: string; completedAt: string|null }
export type Item = { id: string; title: string; kind: string; date: string; startTime: string; endTime: string; location: string; description: string; reminder: number|null; recurring: 'none'|'daily'|'weekdays'|'weekly'|'days'; recurDays: number[] }
export type Done = { scheduleId: string; date: string; completedAt: string }
export type Note = { id: string; scheduleId: string; date: string; whatLearned: string; importantPoints: string; doubts: string; followUp: string }
export type Settings = { task: boolean; class: boolean; event: boolean; summary: boolean; overdue: boolean; defaultReminder: number }
export type D = { tasks: Task[]; items: Item[]; done: Done[]; notes: Note[]; settings: Settings; reload: () => Promise<void> }
export type InstallPromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }> }
export type AuthStatus = { required: boolean; authenticated: boolean }
