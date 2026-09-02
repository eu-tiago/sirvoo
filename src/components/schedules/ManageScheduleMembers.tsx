import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Plus, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { getInitials } from "@/lib/utils";

interface ManageScheduleMembersProps {
  scheduleId: string;
  ministryId: string;
  currentTeam: { id: string; name: string }[];
  /** user IDs already scheduled in any ministry of the SAME event */
  sameEventUserIds?: string[];
  onUpdate: () => void;
}

interface AvailableMember {
  userId: string;
  name: string;
}

export function ManageScheduleMembers({
  scheduleId,
  ministryId,
  currentTeam,
  sameEventUserIds = [],
  onUpdate,
}: ManageScheduleMembersProps) {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [members, setMembers] = useState<AvailableMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState<string | null>(null);
  const [assignedUserIds, setAssignedUserIds] = useState<string[]>([]);

  useEffect(() => {
    fetchMembers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ministryId]);

  useEffect(() => {
    const fetchAssigned = async () => {
      const { data } = await supabase.from("schedule_assignments").select("user_id").eq("schedule_id", scheduleId);
      if (data) setAssignedUserIds(data.map((d) => d.user_id));
    };
    fetchAssigned();
  }, [scheduleId, currentTeam.length]);

  const fetchMembers = async () => {
    setLoading(true);
    try {
      const { data: ministry, error: mErr } = await supabase
        .from("ministries")
        .select("church_id")
        .eq("id", ministryId)
        .maybeSingle();
      if (mErr || !ministry) throw mErr || new Error("Ministério não encontrado");

      const [cmRes, mmRes] = await Promise.all([
        supabase.from("church_members").select("user_id").eq("church_id", ministry.church_id),
        supabase.from("ministry_members").select("user_id").eq("ministry_id", ministryId),
      ]);
      if (cmRes.error) throw cmRes.error;
      if (mmRes.error) throw mmRes.error;

      const churchUserIds = new Set((cmRes.data || []).map((r) => r.user_id));

      // Delta final: APENAS quem é membro do ministério E está na igreja atual
      const ministryUserIds = new Set((mmRes.data || []).map((r) => r.user_id).filter((uid) => churchUserIds.has(uid)));

      const userIds = Array.from(ministryUserIds);

      if (userIds.length === 0) {
        setMembers([]);
        return;
      }

      const { data: profilesData } = await (supabase as any)
        .from("safe_profiles")
        .select("id, full_name, email")
        .in("id", userIds);
      const profiles = (profilesData || []) as Array<{ id: string; full_name: string | null; email: string | null }>;
      const profilesMap = new Map(profiles.map((p) => [p.id, p]));

      const all: AvailableMember[] = userIds.map((uid) => {
        const p = profilesMap.get(uid);
        return {
          userId: uid,
          name: p?.full_name || p?.email || "Sem nome",
        };
      });

      setMembers(all.sort((a, b) => a.name.localeCompare(b.name)));
    } catch (error: any) {
      console.error("Erro ao buscar membros:", error);
      toast({
        title: "Erro ao buscar membros",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const sameEventSet = new Set(sameEventUserIds);

  const filteredMembers = members.filter((m) => {
    if (assignedUserIds.includes(m.userId)) return false;
    if (search && !m.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const handleAdd = async (userId: string) => {
    if (sameEventSet.has(userId)) {
      toast({
        title: "Voluntário já escalado",
        description: "Esta pessoa já está em outro ministério no mesmo evento.",
        variant: "destructive",
      });
      return;
    }
    setAdding(userId);
    try {
      const { error } = await supabase.from("schedule_assignments").insert({
        schedule_id: scheduleId,
        user_id: userId,
        status: "pending",
      });
      if (error) throw error;
      setAssignedUserIds((prev) => [...prev, userId]);
      toast({ title: "Membro adicionado à escala" });
      onUpdate();
    } catch (error: any) {
      toast({
        title: "Erro ao adicionar",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setAdding(null);
    }
  };

  const availableCount = members.filter((m) => !assignedUserIds.includes(m.userId)).length;

  return (
    <div className="mb-4 p-3 rounded-lg border border-border space-y-3">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={`Buscar nos ${availableCount} membros do ministério...`}
          className="pl-9 h-9 text-sm"
        />
      </div>

      <div className="max-h-48 overflow-y-auto space-y-1">
        {loading ? (
          <div className="flex justify-center py-4">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : filteredMembers.length === 0 ? (
          <div className="text-center py-3 space-y-1">
            <p className="text-xs text-muted-foreground">
              {search
                ? "Nenhum membro encontrado com este nome."
                : members.length === 0
                  ? "Este ministério não tem voluntários. Adicione membros na aba de usuários primeiro."
                  : "Todos os membros deste ministério já foram escalados."}
            </p>
          </div>
        ) : (
          filteredMembers.map((m) => {
            const alreadyInEvent = sameEventSet.has(m.userId);
            return (
              <div key={m.userId} className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50">
                <div className="flex items-center gap-2 min-w-0">
                  <div
                    className="w-7 h-7 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-[10px] font-bold text-primary-foreground shrink-0"
                    title={m.name}
                  >
                    {getInitials(m.name)}
                  </div>
                  <span className="text-sm font-medium truncate">{m.name}</span>
                  {alreadyInEvent && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-600 shrink-0">
                      Já escalado no evento
                    </span>
                  )}
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs shrink-0"
                  onClick={() => handleAdd(m.userId)}
                  disabled={adding === m.userId || alreadyInEvent}
                >
                  {adding === m.userId ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <Plus className="w-3 h-3 mr-1" />
                  )}
                  Adicionar
                </Button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
