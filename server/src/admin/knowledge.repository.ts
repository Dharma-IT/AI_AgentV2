export interface KnowledgeRepository<TRecord> {
  findMany(): Promise<TRecord[]>
  findById(id: string): Promise<TRecord | null>
}

// Supabase-backed implementations are intentionally deferred until Milestone 3.2.
