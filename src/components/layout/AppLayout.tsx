import { useState, type ReactNode } from 'react'
import { Sidebar } from './Sidebar'
import { TopBar } from './TopBar'

interface AppLayoutProps {
  title: string
  subtitle?: string
  children: ReactNode
  contentClassName?: string
}

export function AppLayout({ title, subtitle, children, contentClassName }: AppLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="app-shell">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="app-main">
        <TopBar
          title={title}
          subtitle={subtitle}
          onMenuClick={() => setSidebarOpen(true)}
        />
        <div className={`app-content ${contentClassName ?? ''}`.trim()}>{children}</div>
      </div>
    </div>
  )
}
