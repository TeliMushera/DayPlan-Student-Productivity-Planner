import type { Item, Task } from './types'
const p = (n: number) => String(n).padStart(2, '0')
export const iso = (d: Date) => `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
export const today = () => iso(new Date())
export const parse = (s: string) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d) }
export const t12 = (t: string) => { const [h, m] = t.split(':').map(Number); return `${h % 12 || 12}:${p(m)} ${h < 12 ? 'AM' : 'PM'}` }
export const dayLabel = (s: string) => parse(s).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })
export const occursOn = (i: Item, date: string) => {
  if (date < i.date) return false
  const dow = parse(date).getDay()
  switch (i.recurring) {
    case 'none': return date === i.date
    case 'daily': return true
    case 'weekdays': return dow > 0 && dow < 6
    case 'weekly': return dow === parse(i.date).getDay()
    default: return i.recurDays.includes(dow)
  }
}
export const onDay = (items: Item[], date: string) => items.filter(i => occursOn(i, date)).sort((a, b) => a.startTime.localeCompare(b.startTime))
export const dueAt = (t: Task) => new Date(`${t.dueDate}T${t.dueTime || '23:59'}`)
export const isOverdue = (t: Task) => t.status !== 'completed' && !!t.dueDate && dueAt(t) < new Date()
export const dur = (m: number) => m % 60 === 0 ? `${m / 60} hour${m === 60 ? '' : 's'}` : m < 60 ? `${m} min` : `${(m / 60).toFixed(1)} hours`

export const askPermission = async () => ('Notification' in window ? await Notification.requestPermission() : 'unsupported')
export async function show(body: string) {
  const reg = await navigator.serviceWorker?.getRegistration()
  if (reg) await reg.showNotification('DayPlan', { body }); else new Notification('DayPlan', { body })
}
export const taskMsg = (t: Task) => `Your ${t.title} is due at ${t12(t.dueTime || '23:59')}.${t.estimatedMinutes ? ` You estimated ${dur(t.estimatedMinutes)} to complete it.` : ''}`
export const overdueMsg = (t: Task) => `Your ${t.title} was due at ${t12(t.dueTime || '23:59')} and is still incomplete.`
export const itemMsg = (i: Item, mins: number) => ['class', 'lab', 'study'].includes(i.kind)
  ? `${i.title} starts at ${t12(i.startTime)}${i.location ? ` in ${i.location}` : ''}. ${mins > 0 ? `You have ${mins} minutes before it begins.` : 'It is starting now.'}`
  : `${i.title} is scheduled from ${t12(i.startTime)} to ${t12(i.endTime)} today.`
