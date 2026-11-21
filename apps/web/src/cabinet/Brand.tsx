import { ShieldCheck } from 'lucide-react'
import { SITE_NAME } from '../brand'

export function Brand() {
  return (
    <div className="flex items-center gap-2.5">
      <div className="w-10 h-10 rounded-2xl brand-gradient flex items-center justify-center shadow-lg shadow-teal-200">
        <ShieldCheck size={22} className="text-white" />
      </div>
      <span className="text-[22px] font-extrabold tracking-[-0.4px] text-[var(--ink)]">{SITE_NAME}</span>
    </div>
  )
}