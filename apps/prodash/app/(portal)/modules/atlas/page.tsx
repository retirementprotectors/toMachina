import { AtlasRegistry, AppWrapper } from '@tomachina/ui'
export default function AtlasPage() {
  return (
    <AppWrapper appKey="atlas">
      <AtlasRegistry portal="prodashx" />
    </AppWrapper>
  )
}
