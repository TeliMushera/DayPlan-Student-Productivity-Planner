import { ReactNode } from 'react'
import { Icon } from './icons'
export const inp = 'w-full mt-1.5 min-h-11 px-3 rounded-lg border border-line bg-raised text-ink placeholder:text-mute text-base focus:outline-none focus:border-accent'
export const Card = ({ children, className = '' }: { children: ReactNode; className?: string }) =>
  <div className={`rounded-xl bg-surface border border-line p-4 ${className}`}>{children}</div>
export const Btn = ({ v = 'primary', className = '', ...p }: any) =>
  <button {...p} className={`min-h-11 px-4 rounded-xl text-sm font-medium transition active:scale-[.98] disabled:opacity-50 ${v === 'primary' ? 'bg-accent text-bg hover:brightness-110' : v === 'danger' ? 'text-red-400 hover:bg-red-500/10' : 'bg-raised text-ink hover:bg-line'} ${className}`} />
export const Progress = ({ pct }: { pct: number }) =>
  <div className="progress-track overflow-hidden"><div className="h-full transition-all duration-500" style={{ width: pct + '%' }} /></div>
export const Empty = ({ text, cta }: { text: string; cta?: boolean }) =>
  <div className="flex flex-col items-center gap-4 py-10 text-center">
    {cta && <button aria-label="Add" onClick={() => window.dispatchEvent(new Event('dp:add'))} className="size-14 rounded-full bg-accent text-bg grid place-items-center shadow-[0_0_0_8px_rgba(139,157,255,.12)] hover:brightness-110 active:scale-95 transition"><Icon n="plus" s={26} /></button>}
    <p className="text-sm text-mute max-w-[16rem]">{text}</p></div>
export function Modal({ title, close, children }: { title: string; close: () => void; children: ReactNode }) {
  return <div className="modal-backdrop fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-end md:items-center justify-center" onClick={close}>
    <div className="modal-panel w-full md:max-w-lg max-h-[92vh] overflow-y-auto rounded-t-2xl md:rounded-2xl bg-surface border border-line p-5" onClick={e => e.stopPropagation()}>
      <div className="flex justify-between items-center mb-4"><h2 className="font-semibold">{title}</h2><button aria-label="Close" className="min-h-11 min-w-11 grid place-items-center text-mute hover:text-ink" onClick={close}><Icon n="x" /></button></div>
      {children}</div></div>
}
export const Section = ({ title, children }: { title: string; children: ReactNode }) =>
  <details open className="group"><summary className="text-xs uppercase tracking-widest text-mute py-2 cursor-pointer list-none flex justify-between items-center md:pointer-events-none">{title}<span className="md:hidden group-open:rotate-180 transition"><Icon n="down" s={16} /></span></summary><div className="space-y-2">{children}</div></details>
