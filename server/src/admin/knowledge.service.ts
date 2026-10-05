import { supabaseStatus } from '../lib/supabase.js'

export function getKnowledgeServiceStatus() {
  return {
    databaseConfigured: supabaseStatus.configured,
    crudImplemented: false,
  }
}
