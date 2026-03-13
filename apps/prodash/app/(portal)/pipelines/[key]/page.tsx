'use client'

import { useParams, useRouter } from 'next/navigation'
import { PipelineKanban, AppWrapper } from '@tomachina/ui'
import { toPipelineKey } from '../pipeline-keys'

export default function PipelineKanbanPage() {
  const params = useParams<{ key: string }>()
  const router = useRouter()
  const slug = params.key
  const pipelineKey = toPipelineKey(slug)

  return (
    <AppWrapper appKey="pipelines">
      <div className="space-y-4">
        {/* Back navigation */}
        <button
          onClick={() => router.push('/pipelines')}
          className="flex items-center gap-1 text-sm text-[var(--text-muted)] transition-colors hover:text-[var(--portal)]"
        >
          <span className="material-icons-outlined text-base">arrow_back</span>
          Back to Pipelines
        </button>

        <PipelineKanban
          pipelineKey={pipelineKey}
          portal="prodashx"
          onInstanceClick={(instanceId: string) => {
            router.push(`/pipelines/${slug}/${instanceId}`)
          }}
        />
      </div>
    </AppWrapper>
  )
}
