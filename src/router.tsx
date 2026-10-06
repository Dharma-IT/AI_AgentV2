import { createBrowserRouter } from 'react-router-dom'
import App from './App'
import { AdminLayout } from './admin/AdminLayout'
import { OverviewPage } from './admin/pages/OverviewPage'
import { PlaceholderPage } from './admin/pages/PlaceholderPage'
import { ManagementPage } from './admin/pages/ManagementPage'
import { BusinessPage } from './admin/pages/BusinessPage'
import { KnowledgePage } from './admin/pages/KnowledgePage'
import { KnowledgeHealthPage } from './admin/pages/KnowledgeHealthPage'
import { RespondChannelSettingsPage } from './admin/pages/RespondChannelSettingsPage'
import { ConversationReportPage } from './admin/pages/ConversationReportPage'

export const router = createBrowserRouter([
  { path: '/', element: <App /> },
  {
    path: '/admin',
    element: <AdminLayout />,
    children: [
      { index: true, element: <OverviewPage /> },
      { path: 'conversations', element: <ConversationReportPage /> },
      { path: 'products', element: <ManagementPage kind="products" /> },
      { path: 'pricing', element: <ManagementPage kind="pricing-packages" /> },
      { path: 'promotions', element: <ManagementPage kind="promotions" /> },
      { path: 'payment-methods', element: <ManagementPage kind="payment-methods" /> },
      { path: 'shipping', element: <BusinessPage kind="shipping-rules" /> },
      { path: 'clinic-information', element: <BusinessPage kind="clinic-information" /> },
      { path: 'faqs', element: <BusinessPage kind="faqs" /> },
      { path: 'business-policies', element: <BusinessPage kind="business-policies" /> },
      { path: 'knowledge', element: <KnowledgePage kind="conversation-knowledge" /> },
      { path: 'objections', element: <KnowledgePage kind="objection-handling" /> },
      { path: 'scenarios', element: <KnowledgePage kind="conversation-scenarios" /> },
      { path: 'knowledge-health', element: <KnowledgeHealthPage /> },
      { path: 'settings', element: <RespondChannelSettingsPage /> },
      { path: '*', element: <PlaceholderPage /> },
    ],
  },
])
