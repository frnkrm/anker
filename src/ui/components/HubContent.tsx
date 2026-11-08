import type { ReactNode } from 'react'
import { Page } from './ui'

/** A feature keeps its own URL and can also appear inside a shared hub. */
export function HubContent({ embedded = false, title, back, children, className = '' }: {
  embedded?: boolean
  title: string
  back?: boolean | string
  children: ReactNode
  className?: string
}) {
  return embedded
    ? <section aria-label={title} className={`min-w-0 space-y-4 ${className}`}>{children}</section>
    : <Page title={title} back={back} className={className}>{children}</Page>
}
