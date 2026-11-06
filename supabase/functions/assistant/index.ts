// Optionaler, standardmäßig geschlossener Vorschlagsdienst. Keine Bereitstellung/Aktivierung durch den Appbuild.
import { createAssistantHandler } from '../_shared/assistantHandler.ts'

const list = (name: string) => (Deno.env.get(name) ?? '').split(',').map((value) => value.trim()).filter(Boolean)
Deno.serve(createAssistantHandler({
  supabaseUrl: Deno.env.get('SUPABASE_URL') ?? '',
  anonKey: Deno.env.get('SUPABASE_ANON_KEY') ?? '',
  allowedUsers: list('ANKER_ASSISTANT_USER_IDS'),
  origins: list('ANKER_ASSISTANT_ORIGINS'),
  aiKey: Deno.env.get('OPENAI_API_KEY'),
  aiModel: Deno.env.get('ANKER_AI_MODEL'),
  routesKey: Deno.env.get('GOOGLE_ROUTES_API_KEY'),
}))
