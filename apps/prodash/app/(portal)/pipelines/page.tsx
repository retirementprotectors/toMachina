'use client'

import { useRouter } from 'next/navigation'
import { PipelineAdmin, AppWrapper } from '@tomachina/ui'
import { toSlug } from './pipeline-keys'

export default function PipelinesPage() {
  const router = useRouter()

  return (
    <AppWrapper appKey="pipelines">
      <PipelineAdmin
        portal="prodashx"
        onSelectPipeline={(key: string) => {
          router.push(`/pipelines/${toSlug(key)}`)
        }}
      />
    </AppWrapper>
  )
}
