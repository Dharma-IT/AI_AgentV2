import { useLocation } from 'react-router-dom'
import { adminNavigation } from '../admin-navigation'
import { EmptyState } from '../components/States'
import { PageHeader } from '../components/PageHeader'

export function PlaceholderPage() {
  const { pathname } = useLocation()
  const item = adminNavigation.find((entry) => entry.path === pathname)
  const title = item?.label ?? 'Admin section'
  return <div className="space-y-7"><PageHeader title={title} description="Page structure prepared for a future knowledge-management phase." /><EmptyState title={`${title} is not connected yet`} description="No records can be created, changed, published, or deleted in Milestone 3.1." /></div>
}
