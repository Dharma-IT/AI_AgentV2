import type { ReactNode } from 'react'

export function DataTable({ headers, children }: { headers: string[]; children?: ReactNode }) {
  return <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white"><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-slate-50 text-slate-500"><tr>{headers.map((header) => <th key={header} className="px-4 py-3 font-medium">{header}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{children}</tbody></table></div></div>
}
