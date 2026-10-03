import { useState } from 'react'
import { api } from './api'
import { Icon } from './icons'
import { Btn, Card, Empty, Progress, Section, inp } from './components'
import { ItemForm, NotesForm, TaskForm } from './forms'
import type { D, Item, Task } from './types'
import { askPermission, dayLabel, dur, dueAt, isOverdue, iso, onDay, parse, t12, today } from './util'

const dot = { high: 'bg-red-500', medium: 'bg-amber-500', low: 'bg-emerald-500' }
const act = async (d: D, f: () => Promise<any>) => { try { await f(); await d.reload() } catch (e: any) { alert(e.message) } }

export function TaskCard({ t, d }: { t: Task; d: D }) {
  const [edit, setEdit] = useState(false); const done = t.status === 'completed'
  const upd = (b: any) => act(d, () => api.put('/tasks/' + t.id, b))
  return <Card className="space-y-2">
    <div className="flex gap-3 items-start">
      <input type="checkbox" aria-label="Complete" className="size-6 mt-0.5" checked={done} onChange={() => upd({ status: done ? 'pending' : 'completed', completedAt: done ? null : new Date().toISOString() })} />
      <div className="flex-1 min-w-0">
        <p className={`font-medium break-words ${done ? 'line-through text-mute' : ''}`}><span className={`inline-block size-2.5 rounded-full mr-2 ${dot[t.priority]}`} title={t.priority + ' priority'} />{t.title}</p>
        <p className="text-sm text-mute">{t.dueDate ? `${t.dueDate === today() ? 'Today' : dayLabel(t.dueDate)}${t.dueTime ? ' · ' + t12(t.dueTime) : ''}` : 'No due date'}{t.estimatedMinutes ? ` · ${dur(t.estimatedMinutes)}` : ''}{t.category ? ` · ${t.category}` : ''}{t.status === 'in_progress' ? ' · In progress' : ''}</p>
        {isOverdue(t) && <span className="text-xs text-red-400 font-medium">Overdue</span>}
        {t.description && <p className="text-sm mt-1 break-words">{t.description}</p>}
        {t.subtasks.map((s, k) => <label key={k} className="flex items-center gap-2 text-sm min-h-9"><input type="checkbox" className="size-4" checked={s.d} onChange={() => upd({ subtasks: t.subtasks.map((x, i) => i === k ? { ...x, d: !x.d } : x) })} /><span className={s.d ? 'line-through text-mute' : ''}>{s.t}</span></label>)}
      </div></div>
    <div className="flex justify-end gap-1"><Btn v="ghost" onClick={() => setEdit(true)}>Edit</Btn><Btn v="danger" onClick={() => confirm('Delete this task?') && act(d, () => api.del('/tasks/' + t.id))}>Delete</Btn></div>
    {edit && <TaskForm d={d} task={t} close={() => setEdit(false)} />}
  </Card>
}

export function ItemCard({ i, date, d }: { i: Item; date: string; d: D }) {
  const [edit, setEdit] = useState(false); const [notes, setNotes] = useState(false)
  const done = d.done.some(x => x.scheduleId === i.id && x.date === date)
  return <Card className="space-y-2">
    <div><p className="text-xs text-mute">{t12(i.startTime)} – {t12(i.endTime)} · {i.kind}{i.recurring !== 'none' ? ' · repeats' : ''}</p>
      <p className="font-medium break-words">{i.title}{done && <span className="ml-2 text-xs text-emerald-400 font-normal">Completed</span>}</p>{i.location && <p className="text-sm text-mute flex items-center gap-1"><Icon n="pin" s={14} />{i.location}</p>}</div>
    <div className="flex flex-wrap justify-end gap-1">
      {done ? <><Btn v="ghost" onClick={() => setNotes(true)}>Notes</Btn><Btn v="ghost" onClick={() => act(d, () => api.del(`/done?scheduleId=${i.id}&date=${date}`))}>Undo</Btn></>
        : <Btn onClick={() => act(d, async () => { await api.post('/done', { scheduleId: i.id, date }); setNotes(true) })}>Complete</Btn>}
      <Btn v="ghost" onClick={() => setEdit(true)}>Edit</Btn>
      <Btn v="danger" onClick={() => confirm(i.recurring !== 'none' ? 'Delete this whole repeating series?' : 'Delete this activity?') && act(d, () => api.del('/schedule/' + i.id))}>Delete</Btn></div>
    {edit && <ItemForm d={d} item={i} close={() => setEdit(false)} />}
    {notes && <NotesForm d={d} item={i} date={date} close={() => setNotes(false)} />}
  </Card>
}

export function Dashboard({ d }: { d: D }) {
  const t = today(); const tt = d.tasks.filter(x => x.dueDate === t).sort((a, b) => (a.dueTime || '99').localeCompare(b.dueTime || '99'))
  const n = tt.filter(x => x.status === 'completed').length; const pct = tt.length ? Math.round(n / tt.length * 100) : 0
  const sched = onDay(d.items, t); const over = d.tasks.filter(isOverdue)
  const soonT = d.tasks.filter(x => x.status !== 'completed' && x.dueDate && x.dueDate > t).sort((a, b) => +dueAt(a) - +dueAt(b)).slice(0, 3)
  const soonC = [1, 2, 3, 4, 5, 6, 7].flatMap(k => { const dt = iso(new Date(Date.now() + k * 864e5)); return onDay(d.items, dt).map(i => ({ i, dt })) }).slice(0, 3)
  return <div className="space-y-5">
    <div className="dashboard-heading">
      <div><p className="eyebrow">{new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</p><h2>Your day, in focus.</h2><p>Make space for what matters today.</p></div>
    </div>
    <Card className="progress-card !p-5 md:!p-7">
      <div className="relative z-[1] flex items-center justify-between gap-5">
        <div><p className="text-xs uppercase tracking-[.16em] text-mute">Today's progress</p><p className="text-4xl font-semibold mt-3 tabular-nums tracking-tight">{n}<span className="text-mute text-2xl"> / {tt.length}</span></p><p className="text-sm text-mute mt-1">tasks completed</p></div>
        <div className="progress-ring" style={{ background: `conic-gradient(var(--color-accent) ${pct}%, rgba(255,255,255,.09) 0)` }}><div className="progress-ring-inner">{pct}%</div></div>
      </div>
      <div className="relative z-[1] mt-5"><Progress pct={pct} /></div>
    </Card>
    <div className="grid md:grid-cols-2 gap-4 items-start">
      <div className="space-y-4">
        <Section title="Today's Tasks">{tt.length ? tt.map(x => <TaskCard key={x.id} t={x} d={d} />) : <Empty cta text="Nothing due today. Add a task to get started." />}</Section>
        {over.length > 0 && <Section title="Overdue">{over.map(x => <TaskCard key={x.id} t={x} d={d} />)}</Section>}</div>
      <div className="space-y-4">
        <Section title="Today's Schedule">{sched.length ? sched.map(i => <ItemCard key={i.id} i={i} date={t} d={d} />) : <Empty cta text="Nothing scheduled today." />}</Section>
        <Section title="Upcoming">{soonT.length + soonC.length ? <>{soonC.map(({ i, dt }) => <Card key={i.id + dt}><p className="font-medium">{i.title}</p><p className="text-sm text-mute">{dayLabel(dt)} · {t12(i.startTime)}</p></Card>)}{soonT.map(x => <Card key={x.id}><p className="font-medium">{x.title}</p><p className="text-sm text-mute">Due {dayLabel(x.dueDate!)}{x.dueTime ? ' · ' + t12(x.dueTime) : ''}</p></Card>)}</> : <Empty text="Nothing coming up yet." />}</Section></div></div></div>
}

const FILTERS = ['all', 'today', 'upcoming', 'completed', 'overdue', 'high'] as const
export function Tasks({ d }: { d: D }) {
  const [q, setQ] = useState(''); const [f, setF] = useState<typeof FILTERS[number]>('all'); const t = today()
  const list = d.tasks.filter(x => x.title.toLowerCase().includes(q.toLowerCase()) && ({ all: true, today: x.dueDate === t, upcoming: x.status !== 'completed' && !!x.dueDate && x.dueDate > t, completed: x.status === 'completed', overdue: isOverdue(x), high: x.priority === 'high' && x.status !== 'completed' })[f])
    .sort((a, b) => (a.dueDate || '9').localeCompare(b.dueDate || '9') || (a.dueTime || '').localeCompare(b.dueTime || ''))
  return <div className="space-y-3">
    <input className={inp} placeholder="Search tasks by title" value={q} onChange={e => setQ(e.target.value)} />
    <div className="flex gap-2 overflow-x-auto pb-1">{FILTERS.map(x => <button key={x} onClick={() => setF(x)} className={`min-h-10 px-4 rounded-full text-sm whitespace-nowrap border ${f === x ? 'bg-accent text-bg border-accent' : 'border-line'}`}>{x === 'high' ? 'High priority' : x[0].toUpperCase() + x.slice(1)}</button>)}</div>
    <div className="grid lg:grid-cols-2 gap-3">{list.map(x => <TaskCard key={x.id} t={x} d={d} />)}</div>
    {!list.length && <Empty cta text="No tasks found." />}</div>
}

export function Calendar({ d }: { d: D }) {
  const [m, setM] = useState(() => { const n = new Date(); return new Date(n.getFullYear(), n.getMonth(), 1) }); const [sel, setSel] = useState(today()); const [add, setAdd] = useState(false)
  const cells = [...Array(m.getDay()).fill(null), ...Array.from({ length: new Date(m.getFullYear(), m.getMonth() + 1, 0).getDate() }, (_, i) => iso(new Date(m.getFullYear(), m.getMonth(), i + 1)))]
  const items = onDay(d.items, sel); const tasks = d.tasks.filter(x => x.dueDate === sel)
  return <div className="grid lg:grid-cols-[1fr_380px] gap-4 items-start">
    <Card><div className="flex justify-between items-center mb-2"><Btn v="ghost" aria-label="Previous month" onClick={() => setM(new Date(m.getFullYear(), m.getMonth() - 1, 1))}><Icon n="left" /></Btn><b>{m.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</b><Btn v="ghost" aria-label="Next month" onClick={() => setM(new Date(m.getFullYear(), m.getMonth() + 1, 1))}><Icon n="right" /></Btn></div>
      <div className="grid grid-cols-7 gap-1 text-center text-xs text-mute mb-1">{'SMTWTFS'.split('').map((c, i) => <span key={i}>{c}</span>)}</div>
      <div className="grid grid-cols-7 gap-1">{cells.map((c, i) => c ? <button key={c} onClick={() => setSel(c)} className={`h-12 md:h-16 rounded-xl text-sm flex flex-col items-center justify-center ${c === sel ? 'bg-accent text-bg' : c === today() ? 'ring-2 ring-accent' : 'hover:bg-raised'}`}>{+c.slice(8)}{(onDay(d.items, c).length > 0 || d.tasks.some(x => x.dueDate === c)) && <span className="size-1.5 rounded-full bg-current opacity-60" />}</button> : <span key={i} />)}</div></Card>
    <div className="space-y-3"><div className="flex justify-between items-center"><h2 className="font-semibold">{dayLabel(sel).toUpperCase()}</h2><Btn onClick={() => setAdd(true)}>+ Add</Btn></div>
      {items.map(i => <div key={i.id} className="flex gap-3"><span className="w-14 text-xs text-mute pt-4 shrink-0">{t12(i.startTime)}</span><div className="flex-1 min-w-0 border-l-2 border-line pl-3"><ItemCard i={i} date={sel} d={d} /></div></div>)}
      {tasks.map(x => <TaskCard key={x.id} t={x} d={d} />)}
      {!items.length && !tasks.length && <Empty text="Nothing planned for this day." />}</div>
    {add && <ItemForm d={d} date={sel} close={() => setAdd(false)} />}</div>
}

export function History({ d }: { d: D }) {
  type Row = { key: string; date: string; title: string; sub: string; body: any }
  const rows: Row[] = [
    ...d.tasks.filter(t => t.status === 'completed').map(t => { const c = t.completedAt ? new Date(t.completedAt.replace(' ', 'T') + (t.completedAt.endsWith('Z') ? '' : 'Z')) : null; return { key: 't' + t.id, date: c ? iso(c) : t.dueDate || '', title: t.title, sub: c ? 'Completed at ' + c.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : 'Completed', body: <p className="text-sm">{[t.description, `Priority: ${t.priority}`, t.category && `Category: ${t.category}`, t.estimatedMinutes && `Estimated: ${dur(t.estimatedMinutes)}`].filter(Boolean).join(' · ')}</p> } }),
    ...d.done.flatMap(x => { const i = d.items.find(z => z.id === x.scheduleId); if (!i) return []; const n = d.notes.find(z => z.scheduleId === i.id && z.date === x.date)
      return [{ key: `i${i.id}${x.date}`, date: x.date, title: i.title, sub: n?.whatLearned ? 'What I learned: ' + n.whatLearned.slice(0, 80) : `${t12(i.startTime)} – ${t12(i.endTime)}`, body: <div className="text-sm space-y-1"><p>{t12(i.startTime)} – {t12(i.endTime)}{i.location ? ' · ' + i.location : ''}</p>{n ? <>{[['What I learned', n.whatLearned], ['Important points', n.importantPoints], ['Doubts', n.doubts], ['Follow-up', n.followUp]].map(([k, v]) => v && <p key={k} className="whitespace-pre-wrap"><b>{k}:</b> {v}</p>)}</> : <p className="text-mute">No learning notes saved.</p>}</div> }] })]
  const dates = [...new Set(rows.map(r => r.date))].sort().reverse()
  return <div className="space-y-4 max-w-2xl">{dates.map(dt => <div key={dt}><h2 className="font-semibold mb-2">{dt ? dayLabel(dt) : 'Earlier'}</h2><div className="space-y-2">{rows.filter(r => r.date === dt).map(r => <Card key={r.key}><details><summary className="cursor-pointer"><span className="font-medium">{r.title}</span><span className="block text-sm text-mute">{r.sub}</span></summary><div className="mt-3">{r.body}</div></details></Card>)}</div></div>)}
    {!rows.length && <Empty text="Completed tasks and classes will show up here." />}</div>
}

export function SettingsPage({ d }: { d: D }) {
  const s = d.settings; const [perm, setPerm] = useState('Notification' in window ? Notification.permission : 'unsupported')
  const save = (b: any) => act(d, () => api.put('/settings', { ...s, ...b }))
  return <div className="space-y-4 max-w-xl"><Card className="space-y-2"><h2 className="font-semibold">Notifications</h2>
    <p className="text-sm text-mute">{perm === 'granted' ? 'Notifications are on for this browser.' : perm === 'denied' ? 'Notifications are blocked. Allow them in your browser’s site settings to get reminders.' : perm === 'unsupported' ? 'This browser does not support notifications.' : 'Allow notifications to get reminders while DayPlan is open.'}</p>
    {perm === 'default' && <Btn onClick={async () => setPerm(await askPermission())}>Enable notifications</Btn>}
    {([['task', 'Task reminders'], ['class', 'Class reminders'], ['event', 'Event reminders'], ['summary', 'Daily summary'], ['overdue', 'Overdue reminders']] as const).map(([k, l]) => <label key={k} className="flex justify-between items-center min-h-11"><span>{l}</span><input type="checkbox" className="size-6" checked={s[k]} onChange={e => save({ [k]: e.target.checked })} /></label>)}
    <label className="block text-sm"><span className="text-mute">Default reminder</span><select className={inp} value={s.defaultReminder} onChange={e => save({ defaultReminder: +e.target.value })}>{[0, 5, 10, 15, 30, 60].map(n => <option key={n} value={n}>{n === 0 ? 'At start time' : n === 60 ? '1 hour before' : n + ' minutes before'}</option>)}</select></label></Card></div>
}
