'use client'

import { useState } from 'react'
import { ChatScreen } from './ChatScreen'
import { SalesScreen } from './SalesScreen'
import { ClientScreen } from './ClientScreen'
import { BottomNav, type TabId } from './BottomNav'

export function MobileShell() {
  const [activeTab, setActiveTab] = useState<TabId>('chat')

  return (
    <div className="flex flex-col h-dvh overflow-hidden">
      {/* Screen content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'chat' && <ChatScreen />}
        {activeTab === 'sales' && <SalesScreen />}
        {activeTab === 'clients' && <ClientScreen />}
      </div>

      {/* Bottom navigation */}
      <BottomNav activeTab={activeTab} onTabChange={setActiveTab} />
    </div>
  )
}
