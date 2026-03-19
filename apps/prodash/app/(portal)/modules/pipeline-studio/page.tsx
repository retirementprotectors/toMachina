import type { Metadata } from 'next'
import { PipelineStudio, AppWrapper } from '@tomachina/ui'
export const metadata: Metadata = { title: 'Pipeline Studio' }
export default function PipelineStudioPage() {
  return (
    <AppWrapper appKey="pipeline-studio">
      <PipelineStudio portal="prodashx" />
    </AppWrapper>
  )
}
