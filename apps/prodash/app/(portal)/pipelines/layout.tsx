import type { Metadata } from 'next'
export const metadata: Metadata = { title: 'Pipelines' }
export default function PipelinesLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
