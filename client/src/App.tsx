import { useCallback, useEffect, useState } from 'react'
import { api } from './api'
import { Btn, Modal } from './components'
import { Icon } from './icons'
import { ItemForm, TaskForm } from './forms'
import { Calendar, Dashboard, History, SettingsPage, Tasks } from './pages'
import type { D } from './types'
import { dueAt, isOverdue, itemMsg, onDay, overdueMsg, show, t12, taskMsg, today } from './util'

const NAV = [['home', 'home', 'Home'], ['tasks', 'tasks', 'Tasks'], ['calendar', 'calendar', 'Calendar'], ['history', 'history', 'History']]

function useNotifier(d: D | null) {
  useEffect(() => {
    if (!d || !('Notification' in window)) return
    const tick = () => {
      if (Notification.permission !== 'granted') return
      const seen: string[] = JSON.parse(localStorage.getItem('dp_seen') || '[]'); const now = Date.now(); const s = d.settings
      const fire = (k: string, body: string) => { if (!seen.includes(k)) { seen.push(k); show(body).catch(() => {}) } }
      const due = (at: number) => now >= at && now - at < 30 * 60000
      for (const t of d.tasks) {
        if (t.status === 'completed' || !t.dueDate) continue
        const end = +dueAt(t)
        if (s.task && t.reminder != null && t.dueTime && due(end - t.reminder * 60000) && now < end) fire(`t${t.id}r`, taskMsg(t))
        if (s.overdue && isOverdue(t)) fire(`t${t.id}o`, overdueMsg(t))
      }
      const td = today()
      for (const i of onDay(d.items, td)) {
        if (i.reminder == null || d.done.some(x => x.scheduleId === i.id && x.date === td)) continue
        const start = +new Date(`${td}T${i.startTime}`)
        if ((['class', 'lab', 'study'].includes(i.kind) ? s.class : s.event) && due(start - i.reminder * 60000) && now < start) fire(`i${i.id}${td}`, itemMsg(i, i.reminder))
      }
      if (s.summary && new Date().getHours() >= 8) {
        const nt = d.tasks.filter(x => x.dueDate === td && x.status !== 'completed').length, na = onDay(d.items, td).length
        if (nt + na) fire('s' + td, `Good morning! You have ${nt} task${nt === 1 ? '' : 's'} and ${na} scheduled activit${na === 1 ? 'y' : 'ies'} today.`)
      }
      localStorage.setItem('dp_seen', JSON.stringify(seen.slice(-300)))
    }
    tick(); const id = setInterval(tick, 30000); return () => clearInterval(id)
  }, [d])
}

export default function App() {
  const [tab, setTab] = useState('home'); const [d, setD] = useState<D | null>(null); const [err, setErr] = useState('')
  const [add, setAdd] = useState<null | 'pick' | 'task' | 'class' | 'personal'>(null)
  const reload = useCallback(async () => {
    try { const [tasks, items, done, notes, settings] = await Promise.all(['/tasks', '/schedule', '/done', '/notes', '/settings'].map(api.get)); setD({ tasks, items, done, notes, settings, reload }); setErr('') }
    catch (e: any) { setErr(e.message) }
  }, [])
  useEffect(() => { reload() }, [reload]); useNotifier(d)
  useEffect(() => { const f = () => setAdd('pick'); window.addEventListener('dp:add', f); return () => window.removeEventListener('dp:add', f) }, [])
  const page = d && ({ home: <Dashboard d={d} />, tasks: <Tasks d={d} />, calendar: <Calendar d={d} />, history: <History d={d} />, settings: <SettingsPage d={d} /> } as any)[tab]
  const title = tab === 'settings' ? 'Settings' : NAV.find(n => n[0] === tab)?.[2]
  const subtitle = tab === 'home' ? 'A little more intention, one day at a time.' : tab === 'tasks' ? 'Keep your priorities moving forward.' : tab === 'calendar' ? 'See what’s ahead and make time for it.' : tab === 'history' ? 'Look back on how far you’ve come.' : 'Make DayPlan work the way you do.'
  return <div className="app-shell min-h-screen md:flex bg-bg">
    <aside className="sidebar hidden md:flex flex-col w-64 shrink-0 px-5 py-7 gap-1 sticky top-0 h-screen">
      <div className="brand-lockup mb-10 px-2">
        <span className="brand-mark"><Icon n="calendar" s={19} /></span>
        <span><strong>DayPlan</strong><small>YOUR DAILY SPACE</small></span>
      </div>
      <p className="nav-caption px-3 mb-2">WORKSPACE</p>
      {[...NAV, ['settings', 'settings', 'Settings']].map(([k, i, l]) => <button key={k} onClick={() => setTab(k)} className={`side-link ${tab === k ? 'is-active' : ''}`}><Icon n={i} s={18} /><span>{l}</span>{tab === k && <span className="nav-indicator" />}</button>)}
      <div className="sidebar-note mt-auto">
        <span className="sidebar-note-mark"><Icon n="history" s={17} /></span>
        <p>Small steps add up.<br /><strong>Keep showing up.</strong></p>
      </div>
    </aside>
    <div className="flex-1 min-w-0">
      <header className="topbar sticky top-0 z-10">
        <div className="topbar-title">
          <span className="brand-mark mobile-brand md:hidden"><Icon n="calendar" s={17} /></span>
          <div><h1>{title}</h1><p>{subtitle}</p></div>
        </div>
        <div className="topbar-actions">
          <span className="today-chip hidden sm:inline-flex">{new Date().toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}</span>
          {d ? <button onClick={() => setAdd('pick')} className="new-button"><Icon n="plus" s={18} /><span>New</span></button> : <span />}
          <button className="icon-button" aria-label="Notification settings" onClick={() => setTab('settings')}><Icon n="bell" s={19} /></button>
        </div>
      </header>
      <main className="page-content px-4 md:px-8 pt-7 pb-28 md:pb-10">
        {err && <div className="rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 p-4 mb-4 text-sm" role="alert">{err} <Btn v="ghost" onClick={reload} className="ml-2">Retry</Btn></div>}
        {d ? page : !err && <p className="text-mute p-8 text-center text-sm">Loading your day…</p>}</main></div>
    <nav className="mobile-nav md:hidden fixed bottom-0 inset-x-0 grid grid-cols-4 pb-[env(safe-area-inset-bottom)] z-20">
      {NAV.map(([k, i, l]) => <button key={k} onClick={() => setTab(k)} className={`mobile-nav-link ${tab === k ? 'is-active' : ''}`}><Icon n={i} s={19} /><span>{l}</span></button>)}</nav>
    {add === 'pick' && <Modal title="What would you like to add?" close={() => setAdd(null)}><div className="space-y-2">{([['task', 'Task'], ['class', 'Class / Schedule'], ['personal', 'Event']] as const).map(([k, l]) => <Btn key={k} v="ghost" className="w-full text-base !justify-start text-left" onClick={() => setAdd(k)}>{l}</Btn>)}</div></Modal>}
    {d && add === 'task' && <TaskForm d={d} close={() => setAdd(null)} />}
    {d && (add === 'class' || add === 'personal') && <ItemForm d={d} kind={add} close={() => setAdd(null)} />}
  </div>
}
