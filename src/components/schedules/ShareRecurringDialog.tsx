import { useState, useEffect } from "react";
import { Copy, Check, MessageCircle, Loader2, Calendar as CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { WEEKDAYS, OCCURRENCES } from "@/lib/recurrence";

interface ShareRecurringDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  churchId: string;
  ministryFilter: string;
  selectedWeekday?: string;
}

const getExactDateStr = (year: number, month: number, weekday: number, occ: number) => {
  const d = new Date(year, month, 1);
  let currentWeekday = d.getDay();
  let distance = (weekday - currentWeekday + 7) % 7;
  d.setDate(d.getDate() + distance);
  d.setDate(d.getDate() + (occ - 1) * 7);

  if (d.getMonth() === month) {
    return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
  }
  return null;
};

export function ShareRecurringDialog({
  open,
  onOpenChange,
  churchId,
  ministryFilter,
  selectedWeekday,
}: ShareRecurringDialogProps) {
  const [loading, setLoading] = useState(false);
  const [text, setText] = useState("");
  const [copied, setCopied] = useState(false);

  const [monthString, setMonthString] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });

  const { toast } = useToast();

  useEffect(() => {
    if (open && churchId) {
      generateShareText();
    } else {
      setText("");
      setCopied(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, churchId, ministryFilter, selectedWeekday, monthString]);

  const generateShareText = async () => {
    setLoading(true);
    try {
      const [yearStr, monthStr] = monthString.split("-");
      const year = parseInt(yearStr, 10);
      const month = parseInt(monthStr, 10) - 1;

      const weekdayNum = selectedWeekday !== undefined && selectedWeekday !== "" ? parseInt(selectedWeekday, 10) : null;
      const weekdayObj = weekdayNum !== null ? WEEKDAYS.find((w) => w.value === weekdayNum) : null;
      const weekdayLabel = weekdayObj ? weekdayObj.label : "";

      const { data: ministriesData, error: mErr } = await supabase
        .from("ministries")
        .select("id, name")
        .eq("church_id", churchId)
        .order("name");

      if (mErr) throw mErr;

      const filteredMinistries =
        ministryFilter === "Todas" ? ministriesData : ministriesData?.filter((m) => m.name === ministryFilter);

      if (!filteredMinistries || filteredMinistries.length === 0) {
        setText("Nenhum ministério encontrado para gerar a escala.");
        setLoading(false);
        return;
      }

      const ministryIds = filteredMinistries.map((m) => m.id);

      let query = supabase
        .from("recurring_assignments")
        .select("ministry_id, user_id, role_id, weekday, occurrence, time")
        .in("ministry_id", ministryIds)
        .eq("active", true);

      if (weekdayNum !== null) {
        query = query.eq("weekday", weekdayNum);
      }

      const { data: assignments, error: aErr } = await query;

      if (aErr) throw aErr;

      if (!assignments || assignments.length === 0) {
        setText(`Nenhuma escala fixa configurada${weekdayLabel ? ` para ${weekdayLabel}` : ""} no momento.`);
        setLoading(false);
        return;
      }

      const userIds = [...new Set(assignments.map((a) => a.user_id))];
      const { data: profiles } = await (supabase as any)
        .from("safe_profiles")
        .select("id, full_name, email")
        .in("id", userIds);

      const profilesMap = new Map((profiles || []).map((p: any) => [p.id, p.full_name || p.email || "Voluntário"]));

      const roleIds = [...new Set(assignments.map((a) => a.role_id).filter(Boolean))];
      const { data: roles } = await supabase.from("ministry_roles").select("id, name").in("id", roleIds);

      const rolesMap = new Map((roles || []).map((r) => [r.id, r.name]));

      const monthName = new Date(year, month, 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
      let out = `🗓 *ESCALA FIXA - ${monthName.toUpperCase()}*\n`;
      if (ministryFilter !== "Todas") out += `🔸 *Ministério:* ${ministryFilter}\n`;
      if (weekdayLabel) {
        out += `🔸 *Dia:* ${weekdayLabel}\n`;
      }
      out += `\n`;

      filteredMinistries.forEach((ministry) => {
        const ministryAssignments = assignments.filter((a) => a.ministry_id === ministry.id);

        if (ministryAssignments.length === 0) return;

        if (ministryFilter === "Todas") {
          out += `🔹 *${ministry.name.toUpperCase()}*\n`;
        }

        const byWeekday = new Map<number, typeof ministryAssignments>();
        ministryAssignments.forEach((a) => {
          const list = byWeekday.get(a.weekday) || [];
          list.push(a);
          byWeekday.set(a.weekday, list);
        });

        const sortedWeekdays = Array.from(byWeekday.keys()).sort((a, b) => a - b);

        sortedWeekdays.forEach((wDay) => {
          const currentWDayObj = WEEKDAYS.find((w) => w.value === wDay);
          const wDayName = currentWDayObj ? currentWDayObj.label : "Dia";

          out += `\n📅 *${wDayName}*\n`;
          const dayAssignments = byWeekday.get(wDay)!;

          const byTime = new Map<string, typeof dayAssignments>();
          dayAssignments.forEach((a) => {
            const timeKey = a.time ? a.time.substring(0, 5) : "Geral";
            const list = byTime.get(timeKey) || [];
            list.push(a);
            byTime.set(timeKey, list);
          });

          const sortedTimes = Array.from(byTime.keys()).sort();

          sortedTimes.forEach((timeKey) => {
            if (timeKey !== "Geral") {
              out += `  🕒 *Culto às ${timeKey}*\n`;
            }

            const timeAssignments = byTime.get(timeKey)!;

            const byOccurrence = new Map<number, typeof timeAssignments>();
            timeAssignments.forEach((a) => {
              const list = byOccurrence.get(a.occurrence) || [];
              list.push(a);
              byOccurrence.set(a.occurrence, list);
            });

            const sortedOccurrences = Array.from(byOccurrence.keys()).sort((a, b) => a - b);

            sortedOccurrences.forEach((occ) => {
              const exactDate = getExactDateStr(year, month, wDay, occ);
              if (!exactDate) return;

              const currentOccObj = OCCURRENCES.find((o) => o.value === occ);
              const occLabel = currentOccObj ? currentOccObj.label : `${occ}ª`;

              const indent = timeKey !== "Geral" ? "    " : "  ";
              out += `${indent}📍 ${occLabel} Semana - ${exactDate}\n`;

              const occAssignments = timeAssignments.filter((a) => a.occurrence === occ);
              occAssignments.forEach((a) => {
                const userName = profilesMap.get(a.user_id) || "Desconhecido";
                const roleName = a.role_id ? rolesMap.get(a.role_id) : "";
                const userIndent = timeKey !== "Geral" ? "      " : "    ";
                out += `${userIndent}👤 ${userName}${roleName ? ` (${roleName})` : ""}\n`;
              });
            });
          });
        });
        out += `\n`;
      });

      setText(out.trim());
    } catch (error: any) {
      console.error("Erro ao gerar texto da escala recorrente:", error);
      toast({
        title: "Erro ao gerar escala",
        description: error.message,
        variant: "destructive",
      });
      setText("Ocorreu um erro ao gerar o texto.");
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast({ title: "Copiado para a área de transferência!" });
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast({ title: "Erro ao copiar", variant: "destructive" });
    }
  };

  const handleWhatsApp = () => {
    const encoded = encodeURIComponent(text);
    window.open(`https://wa.me/?text=${encoded}`, "_blank");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md w-[95vw] flex flex-col gap-0 max-h-[90dvh] p-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-4 border-b shrink-0">
          <DialogTitle>Compartilhar Escala Fixa</DialogTitle>
          <DialogDescription>Revise ou edite o texto abaixo antes de enviar para sua equipe.</DialogDescription>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto p-6 flex flex-col gap-4 bg-muted/5">
          <div className="space-y-2 shrink-0">
            <Label htmlFor="month" className="flex items-center gap-2">
              <CalendarIcon className="w-4 h-4 text-muted-foreground" />
              Mês de Referência
            </Label>
            <Input
              type="month"
              value={monthString}
              onChange={(e) => setMonthString(e.target.value)}
              className="sirvo-input w-full"
            />
          </div>

          {loading ? (
            <div className="flex flex-col items-center justify-center flex-1 min-h-[200px] space-y-3 text-muted-foreground bg-background border rounded-md">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
              <p className="text-sm">Formatando horários e datas...</p>
            </div>
          ) : (
            <div className="flex flex-col flex-1 h-full min-h-[200px] space-y-2">
              <Label className="text-muted-foreground">Mensagem (Editável)</Label>
              <Textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                className="flex-1 font-mono text-sm resize-none sirvo-input h-full min-h-[250px]"
                placeholder="O texto da escala aparecerá aqui..."
              />
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t shrink-0 flex flex-col-reverse sm:flex-row justify-between gap-3 bg-muted/10">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="w-full sm:w-auto">
            Fechar
          </Button>
          <div className="flex gap-3 w-full sm:w-auto">
            <Button variant="outline" onClick={handleCopy} disabled={loading || !text} className="flex-1 sm:flex-none">
              {copied ? <Check className="w-4 h-4 mr-2 text-green-600" /> : <Copy className="w-4 h-4 mr-2" />}
              Copiar
            </Button>
            <Button
              onClick={handleWhatsApp}
              disabled={loading || !text}
              className="bg-[#25D366] hover:bg-[#128C7E] text-white flex-1 sm:flex-none border-none"
            >
              <MessageCircle className="w-4 h-4 mr-2" />
              WhatsApp
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
