import { useState } from 'react'
import { api } from './api'
import { Btn, Modal, inp } from './components'
import type { D, Item, Task } from './types'
import { today, dayLabel, t12 } from './util'

const Lbl = ({ t, children }: any) => <label className="block text-sm"><span className="text-mute">{t}</span>{children}</label>
const PRE = [0, 5, 10, 15, 30, 60]
function Reminder({ v, set }: { v: number | null; set: (n: number | null) => void }) {
  const [c, setC] = useState(v != null && !PRE.includes(v))
  return <div><select className={inp} value={c ? 'c' : v == null ? '' : String(v)} onChange={e => { const x = e.target.value; if (x === 'c') { setC(true); set(20) } else { setC(false); set(x === '' ? null : +x) } }}>
    <option value="">No reminder</option><option value="0">At start / due time</option>
    {PRE.slice(1).map(n => <option key={n} value={n}>{n === 60 ? '1 hour' : n + ' minutes'} before</option>)}<option value="c">Custom…</option></select>
    {c && <input type="number" min={1} max={10080} className={inp} value={v ?? ''} placeholder="Minutes before" onChange={e => set(e.target.value ? +e.target.value : null)} />}</div>
}
function useSave(d: D, close: () => void) {
  const [err, setErr] = useState(''); const [busy, setBusy] = useState(false)
  return { err, busy, run: async (f: () => Promise<any>) => { setBusy(true); setErr(''); try { await f(); await d.reload(); close() } catch (e: any) { setErr(e.message) } setBusy(false) } }
}
const Foot = ({ err, busy, close }: any) => <>{err && <p className="text-sm text-red-400" role="alert">{err}</p>}<div className="flex gap-2 pt-2"><Btn v="ghost" type="button" onClick={close} className="flex-1">Cancel</Btn><Btn type="submit" disabled={busy} className="flex-1">{busy ? 'Saving…' : 'Save'}</Btn></div></>

export function TaskForm({ d, task, close }: { d: D; task?: Task; close: () => void }) {
  const [f, setF] = useState<any>(task ?? { title: '', description: '', priority: 'medium', status: 'pending', dueDate: today(), dueTime: '', estimatedMinutes: null, category: '', reminder: d.settings.defaultReminder, subtasks: [] })
  const [sub, setSub] = useState(''); const s = useSave(d, close); const [localErr, setLocalErr] = useState('')
  const set = (k: string, v: any) => setF((x: any) => ({ ...x, [k]: v }))
  const submit = (e: any) => {
    e.preventDefault(); setLocalErr('')
    if (!f.title.trim()) return setLocalErr('Please enter a task title.')
    if (f.reminder != null && !f.dueTime) return setLocalErr('Add a due time to use a reminder.')
    const body = { ...f, dueDate: f.dueDate || null, dueTime: f.dueTime || null, completedAt: f.status === 'completed' ? (f.completedAt || new Date().toISOString()) : null }
    s.run(() => task ? api.put('/tasks/' + task.id, body) : api.post('/tasks', body))
  }
  return <Modal title={task ? 'Edit task' : 'New task'} close={close}><form onSubmit={submit} className="space-y-3">
    <Lbl t="Title"><input className={inp} value={f.title} onChange={e => set('title', e.target.value)} /></Lbl>
    <Lbl t="Description"><textarea className={inp} rows={2} value={f.description} onChange={e => set('description', e.target.value)} /></Lbl>
    <div className="grid grid-cols-2 gap-3">
      <Lbl t="Priority"><select className={inp} value={f.priority} onChange={e => set('priority', e.target.value)}><option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option></select></Lbl>
      <Lbl t="Status"><select className={inp} value={f.status} onChange={e => set('status', e.target.value)}><option value="pending">Pending</option><option value="in_progress">In progress</option><option value="completed">Completed</option></select></Lbl>
      <Lbl t="Due date"><input type="date" className={inp} value={f.dueDate || ''} onChange={e => set('dueDate', e.target.value)} /></Lbl>
      <Lbl t="Due time"><input type="time" className={inp} value={f.dueTime || ''} onChange={e => set('dueTime', e.target.value)} /></Lbl>
      <Lbl t="Estimate (minutes)"><input type="number" min={1} className={inp} value={f.estimatedMinutes ?? ''} onChange={e => set('estimatedMinutes', e.target.value ? +e.target.value : null)} /></Lbl>
      <Lbl t="Category"><input className={inp} value={f.category} onChange={e => set('category', e.target.value)} /></Lbl></div>
    <Lbl t="Reminder"><Reminder v={f.reminder} set={n => set('reminder', n)} /></Lbl>
    <Lbl t="Subtasks"><div className="space-y-1">{f.subtasks.map((x: any, i: number) => <div key={i} className="flex justify-between text-sm"><span>• {x.t}</span><button type="button" className="text-red-400 px-2" onClick={() => set('subtasks', f.subtasks.filter((_: any, j: number) => j !== i))}>Remove</button></div>)}
      <div className="flex gap-2"><input className={inp} value={sub} placeholder="Add a subtask" onChange={e => setSub(e.target.value)} /><Btn v="ghost" type="button" onClick={() => { if (sub.trim()) { set('subtasks', [...f.subtasks, { t: sub.trim(), d: false }]); setSub('') } }}>Add</Btn></div></div></Lbl>
    <Foot err={localErr || s.err} busy={s.busy} close={close} /></form></Modal>
}

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
export function ItemForm({ d, item, date, kind, close }: { d: D; item?: Item; date?: string; kind?: string; close: () => void }) {
  const [f, setF] = useState<any>(item ?? { title: '', kind: kind || 'class', date: date || today(), startTime: '09:00', endTime: '10:00', location: '', description: '', reminder: d.settings.defaultReminder, recurring: 'none', recurDays: [] })
  const s = useSave(d, close); const [localErr, setLocalErr] = useState('')
  const set = (k: string, v: any) => setF((x: any) => ({ ...x, [k]: v }))
  const submit = (e: any) => {
    e.preventDefault(); setLocalErr('')
    if (!f.title.trim()) return setLocalErr('Please enter a title.')
    if (!f.date || !f.startTime || !f.endTime) return setLocalErr('Please set a date, start time and end time.')
    if (f.endTime <= f.startTime) return setLocalErr('End time must be after the start time.')
    if (f.recurring === 'days' && !f.recurDays.length) return setLocalErr('Pick at least one day of the week.')
    s.run(() => item ? api.put('/schedule/' + item.id, f) : api.post('/schedule', f))
  }
  return <Modal title={item ? 'Edit activity' : 'New activity'} close={close}><form onSubmit={submit} className="space-y-3">
    <Lbl t="Title"><input className={inp} value={f.title} onChange={e => set('title', e.target.value)} /></Lbl>
    <div className="grid grid-cols-2 gap-3">
      <Lbl t="Type"><select className={inp} value={f.kind} onChange={e => set('kind', e.target.value)}>{['class', 'lab', 'study', 'meeting', 'exam', 'personal'].map(k => <option key={k} value={k}>{k[0].toUpperCase() + k.slice(1)}</option>)}</select></Lbl>
      <Lbl t="Date"><input type="date" className={inp} value={f.date} onChange={e => set('date', e.target.value)} /></Lbl>
      <Lbl t="Start"><input type="time" className={inp} value={f.startTime} onChange={e => set('startTime', e.target.value)} /></Lbl>
      <Lbl t="End"><input type="time" className={inp} value={f.endTime} onChange={e => set('endTime', e.target.value)} /></Lbl></div>
    <Lbl t="Location (optional)"><input className={inp} value={f.location} onChange={e => set('location', e.target.value)} /></Lbl>
    <Lbl t="Description (optional)"><textarea rows={2} className={inp} value={f.description} onChange={e => set('description', e.target.value)} /></Lbl>
    <Lbl t="Repeats"><select className={inp} value={f.recurring} onChange={e => set('recurring', e.target.value)}><option value="none">Does not repeat</option><option value="daily">Daily</option><option value="weekdays">Weekdays</option><option value="weekly">Weekly</option><option value="days">Selected days</option></select></Lbl>
    {f.recurring === 'days' && <div className="flex flex-wrap gap-2">{DOW.map((n, i) => <button type="button" key={n} onClick={() => set('recurDays', f.recurDays.includes(i) ? f.recurDays.filter((x: number) => x !== i) : [...f.recurDays, i])} className={`min-h-11 px-3 rounded-xl text-sm border ${f.recurDays.includes(i) ? 'bg-accent text-bg border-accent' : 'border-line'}`}>{n}</button>)}</div>}
    <Lbl t="Reminder"><Reminder v={f.reminder} set={n => set('reminder', n)} /></Lbl>
    <Foot err={localErr || s.err} busy={s.busy} close={close} /></form></Modal>
}

export function NotesForm({ d, item, date, close }: { d: D; item: Item; date: string; close: () => void }) {
  const n = d.notes.find(x => x.scheduleId === item.id && x.date === date)
  const [f, setF] = useState({ whatLearned: n?.whatLearned || '', importantPoints: n?.importantPoints || '', doubts: n?.doubts || '', followUp: n?.followUp || '' })
  const [mk, setMk] = useState(false); const s = useSave(d, close)
  const set = (k: string, v: string) => setF(x => ({ ...x, [k]: v }))
  const save = (e: any) => { e.preventDefault(); s.run(async () => {
    await api.put('/notes', { scheduleId: item.id, date, ...f })
    if (mk && f.followUp.trim()) await api.post('/tasks', { title: f.followUp.trim(), description: `Follow-up from ${item.title}`, priority: 'medium', status: 'pending', dueDate: date, category: 'Follow-up', subtasks: [] })
  }) }
  return <Modal title={`Notes: ${item.title}`} close={close}><form onSubmit={save} className="space-y-3">
    <p className="text-sm text-mute">{dayLabel(date)} · {t12(item.startTime)} – {t12(item.endTime)}</p>
    <Lbl t="What I learned"><textarea rows={4} className={inp} value={f.whatLearned} onChange={e => set('whatLearned', e.target.value)} /></Lbl>
    <Lbl t="Important points (optional)"><textarea rows={3} className={inp} value={f.importantPoints} onChange={e => set('importantPoints', e.target.value)} /></Lbl>
    <Lbl t="Doubts (optional)"><textarea rows={2} className={inp} value={f.doubts} onChange={e => set('doubts', e.target.value)} /></Lbl>
    <Lbl t="Follow-up (optional)"><input className={inp} value={f.followUp} onChange={e => set('followUp', e.target.value)} /></Lbl>
    {f.followUp.trim() && <label className="flex items-center gap-2 text-sm min-h-11"><input type="checkbox" checked={mk} onChange={e => setMk(e.target.checked)} className="size-5" />Also create this as a task</label>}
    <Foot err={s.err} busy={s.busy} close={close} /></form></Modal>
}
