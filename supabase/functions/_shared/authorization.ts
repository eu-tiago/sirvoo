import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

// Always resolve the caller's authority in PostgreSQL, never by email or metadata.
export async function isMaster(req: Request): Promise<boolean> {
  const client = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } } },
  );
  const { data, error } = await client.rpc("is_super_admin");
  if (error) throw new Error("Erro ao verificar permissões");
  return data === true;
}

export async function canManageChurch(req: Request, churchId: string): Promise<boolean> {
  const client = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } } },
  );
  const { data, error } = await client.rpc("can_administer_church", { _church_id: churchId });
  if (error) throw new Error("Erro ao verificar permissões");
  return data === true;
}

export async function callerPermission(req: Request, name: string, args: Record<string, unknown>): Promise<boolean> {
  const client = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
  });
  const { data, error } = await client.rpc(name, args);
  if (error) throw new Error("Erro ao verificar permissões");
  return data === true;
}
