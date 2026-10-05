import {
  BadgeDollarSign, BookOpen, Boxes, CircleDollarSign, ClipboardList,
  CreditCard, FileText, Gauge, MapPinned, MessageCircleQuestion,
  MessagesSquare, Settings, ShieldCheck, Building2, ScrollText,
  HeartPulse,
} from 'lucide-react'

export const adminNavigation = [
  { path: '/admin', label: 'Dashboard Overview', icon: Gauge },
  { path: '/admin/products', label: 'Products & Treatments', icon: Boxes },
  { path: '/admin/pricing', label: 'Pricing & Packages', icon: CircleDollarSign },
  { path: '/admin/promotions', label: 'Promotions', icon: BadgeDollarSign },
  { path: '/admin/payment-methods', label: 'Payment Methods', icon: CreditCard },
  { path: '/admin/shipping', label: 'Shipping & State Availability', icon: MapPinned },
  { path: '/admin/clinic-information', label: 'Clinic Information', icon: Building2 },
  { path: '/admin/faqs', label: 'FAQs & Approved Answers', icon: MessageCircleQuestion },
  { path: '/admin/business-policies', label: 'Business Policies', icon: ScrollText },
  { path: '/admin/knowledge', label: 'Conversation Knowledge', icon: BookOpen },
  { path: '/admin/objections', label: 'Objection Handling', icon: MessagesSquare },
  { path: '/admin/scenarios', label: 'Conversation Scenarios', icon: ClipboardList },
  { path: '/admin/knowledge-health', label: 'Knowledge Integration', icon: HeartPulse },
  { path: '/admin/compliance', label: 'Compliance & Restrictions', icon: ShieldCheck },
  { path: '/admin/documents', label: 'Knowledge Documents', icon: FileText },
  { path: '/admin/settings', label: 'Settings', icon: Settings },
] as const
