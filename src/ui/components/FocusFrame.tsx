import type { ReactNode } from 'react'
import type { ResumePoint } from '../../core/types'
import { InboxButton } from './Shell'
import { BackButton, Progress } from './ui'

/** Gleicher ruhiger Rahmen für Routine und Aufgabe; die Timer bleiben im bestehenden Store. */
export function FocusFrame({ back, context, capture, progress, children, footer, details }: {
  back: string; context: ReactNode; capture?: ResumePoint; progress?: number
  children: ReactNode; footer?: ReactNode; details?: ReactNode
}) {
  return <div className="focus-page mx-auto flex min-h-dvh min-w-0 max-w-xl flex-col gap-3 px-4 pb-6 safe-top">
    <header className="flex min-h-12 min-w-0 items-center gap-2">
      <BackButton to={back} />
      <p className="min-w-0 flex-1 break-words text-center text-sm text-muted">{context}</p>
      <div className="flex w-12 shrink-0">{capture && <InboxButton context={capture} />}</div>
    </header>
    {progress !== undefined && <Progress label="Fortschritt der Routine" value={progress} />}
    <section className="flex min-w-0 flex-1 flex-col justify-center gap-3 py-4 text-center">{children}</section>
    {footer && <div className="min-w-0 space-y-2">{footer}</div>}
    {details}
  </div>
}
