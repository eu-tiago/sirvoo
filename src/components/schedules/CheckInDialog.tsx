import { useEffect, useState, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { getInitials } from "@/lib/utils";
import { Check, UserCheck, Undo2 } from "lucide-react";
import { ScheduleGroup } from "./GroupedScheduleCard";

interface Row {
  id: string;
  userId: string;
  name: string;
  ministry: string;
  ministryColor: string;
  role: string;
  checkedInAt: string | null;
}

interface CheckInDialogProps {
  group: ScheduleGroup | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CheckInDialog({ group, open, onOpenChange }: CheckInDialogProps) {
  const { toast } = useToast();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!group) return;
    setLoading(true);
    try {
      const scheduleIds = group.schedules.map((s) => s.id);
      const { data, error } = await supabase
        .from("schedule_assignments")
        .select("id, user_id, schedule_id, status, checked_in_at, ministry_roles:role_id (name)")
        .in("schedule_id", scheduleIds)
        .eq("status", "confirmed");
      if (error) throw error;

      const userIds = Array.from(new Set((data || []).map((a: any) => a.user_id)));
      const nameById = new Map<string, string>();
      if (userIds.length > 0) {
        const { data: profiles } = await (supabase as any)
          .from("safe_profiles")
          .select("id, full_name")
          .in("id", userIds);
        for (const p of profiles || []) if (p.full_name) nameById.set(p.id, p.full_name);
      }

      const ministryById = new Map(group.schedules.map((s) => [s.id, s]));
      setRows(
        (data || []).map((a: any) => ({
          id: a.id,
          userId: a.user_id,
          name: nameById.get(a.user_id) || "Sem nome",
          ministry: ministryById.get(a.schedule_id)?.ministry || "—",
          ministryColor: ministryById.get(a.schedule_id)?.ministryColor || "#5B7BFF",
          role: a.ministry_roles?.name || "Voluntário",
          checkedInAt: a.checked_in_at,
        }))
      );
    } catch (error: any) {
      toast({ title: "Erro ao carregar check-in", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [group, toast]);

  useEffect(() => {
    if (open) load();
  }, [open, load]);

  const toggle = async (row: Row) => {
    setSavingId(row.id);
    try {
      const { data: auth } = await supabase.auth.getUser();
      const payload = row.checkedInAt
        ? { checked_in_at: null, checked_in_by: null }
        : { checked_in_at: new Date().toISOString(), checked_in_by: auth.user?.id ?? null };
      const { error } = await supabase.from("schedule_assignments").update(payload).eq("id", row.id);
      if (error) throw error;
      setRows((prev) =>
        prev.map((r) => (r.id === row.id ? { ...r, checkedInAt: payload.checked_in_at } : r))
      );
    } catch (error: any) {
      toast({ title: "Erro ao registrar check-in", description: error.message, variant: "destructive" });
    } finally {
      setSavingId(null);
    }
  };

  const present = rows.filter((r) => r.checkedInAt).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Check-in — {group?.title}</DialogTitle>
          <DialogDescription>
            {group?.date} · {group?.time} — registre a presença de quem confirmou a escala.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-14 rounded-xl" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">
            Nenhum voluntário confirmou esta escala ainda.
          </p>
        ) : (
          <>
            <div className="flex items-center gap-2">
              <Badge className="bg-green-500/10 text-green-600 border-green-500/20">
                <UserCheck className="w-3 h-3 mr-1" /> {present} presente(s)
              </Badge>
              <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/20">
                {rows.length - present} sem check-in
              </Badge>
            </div>

            <div className="space-y-2">
              {rows.map((r) => (
                <div
                  key={r.id}
                  className="flex items-center justify-between gap-3 p-3 rounded-xl border border-border"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-[11px] font-bold text-primary-foreground shrink-0">
                      {getInitials(r.name)}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{r.name}</p>
                      <p className="text-xs text-muted-foreground truncate flex items-center gap-1.5">
                        <span
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: r.ministryColor }}
                        />
                        {r.ministry} · {r.role}
                      </p>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant={r.checkedInAt ? "outline" : "default"}
                    disabled={savingId === r.id}
                    onClick={() => toggle(r)}
                    className="shrink-0"
                  >
                    {r.checkedInAt ? (
                      <>
                        <Undo2 className="w-4 h-4 mr-1" /> Desfazer
                      </>
                    ) : (
                      <>
                        <Check className="w-4 h-4 mr-1" /> Check-in
                      </>
                    )}
                  </Button>
                </div>
              ))}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
