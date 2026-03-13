'use client'

import { useParams, useRouter } from 'next/navigation'
import { PipelineInstance, AppWrapper } from '@tomachina/ui'

export default function PipelineInstancePage() {
  const params = useParams<{ key: string; instanceId: string }>()
  const router = useRouter()
  const slug = params.key
  const instanceId = params.instanceId

  return (
    <AppWrapper appKey="pipelines">
      <PipelineInstance
        instanceId={instanceId}
        portal="prodashx"
        onBack={() => router.push(`/pipelines/${slug}`)}
      />
    </AppWrapper>
  )
}
