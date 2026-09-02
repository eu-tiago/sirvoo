import { useState, useEffect } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Calendar as CalendarIcon, Loader2, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

interface Availability {
  id: string;
  start_date: string;
  end_date: string;
  reason: string | null;
  is_available: boolean;
}

export function AvailabilityManager({ active = true }: { active?: boolean }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [availabilities, setAvailabilities] = useState<Availability[]>([]);
  const [startDate, setStartDate] = useState<Date>();
  const [endDate, setEndDate] = useState<Date>();
  const [reason, setReason] = useState("");

  useEffect(() => {
    if (active && user) {
      fetchAvailabilities();
    }
  }, [active, user]);

  const fetchAvailabilities = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from("volunteer_availability")
        .select("*")
        .eq("user_id", user.id)
        .order("start_date", { ascending: true });

      if (error) throw error;
      setAvailabilities(data || []);
    } catch (error) {
      console.error("Error fetching availabilities:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddUnavailability = async () => {
    if (!user || !startDate || !endDate) {
      toast({
        title: "Datas obrigatórias",
        description: "Selecione as datas de início e fim",
        variant: "destructive",
      });
      return;
    }

    if (endDate < startDate) {
      toast({
        title: "Data inválida",
        description: "A data final deve ser posterior à data inicial",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);

    try {
      const { error } = await supabase.from("volunteer_availability").insert({
        user_id: user.id,
        start_date: format(startDate, "yyyy-MM-dd"),
        end_date: format(endDate, "yyyy-MM-dd"),
        reason: reason.trim() || null,
        is_available: false,
      });

      if (error) throw error;

      toast({
        title: "Indisponibilidade registrada",
        description: "Sua indisponibilidade foi salva com sucesso",
      });

      setStartDate(undefined);
      setEndDate(undefined);
      setReason("");
      fetchAvailabilities();
    } catch (error) {
      console.error("Error saving availability:", error);
      toast({
        title: "Erro ao salvar",
        description: "Tente novamente mais tarde",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase
        .from("volunteer_availability")
        .delete()
        .eq("id", id);

      if (error) throw error;

      setAvailabilities((prev) => prev.filter((a) => a.id !== id));

      toast({
        title: "Registro removido",
        description: "A indisponibilidade foi removida",
      });
    } catch (error) {
      console.error("Error deleting availability:", error);
      toast({
        title: "Erro ao remover",
        description: "Tente novamente mais tarde",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Add new unavailability */}
      <div className="space-y-4 p-4 bg-muted/50 rounded-xl">
        <h3 className="font-medium text-sm text-foreground">Adicionar Indisponibilidade</h3>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label className="text-xs">Data Início</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal h-10",
                    !startDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {startDate ? format(startDate, "dd/MM/yy") : "Selecionar"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={startDate}
                  onSelect={setStartDate}
                  locale={ptBR}
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-2">
            <Label className="text-xs">Data Fim</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal h-10",
                    !endDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {endDate ? format(endDate, "dd/MM/yy") : "Selecionar"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={endDate}
                  onSelect={setEndDate}
                  locale={ptBR}
                  disabled={(date) => (startDate ? date < startDate : false)}
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>

        <div className="space-y-2">
          <Label className="text-xs">Motivo (opcional)</Label>
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Ex: Viagem, compromisso pessoal..."
            className="min-h-[60px]"
          />
        </div>

        <Button
          onClick={handleAddUnavailability}
          disabled={saving || !startDate || !endDate}
          className="w-full"
        >
          {saving ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Plus className="w-4 h-4 mr-2" />
          )}
          Adicionar
        </Button>
      </div>

      {/* List of unavailabilities */}
      <div className="space-y-3">
        <h3 className="font-medium text-sm text-foreground">Períodos Indisponíveis</h3>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : availabilities.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            Nenhuma indisponibilidade registrada
          </p>
        ) : (
          <div className="space-y-2">
            {availabilities.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between p-3 bg-muted/30 rounded-lg"
              >
                <div>
                  <p className="font-medium text-sm text-foreground">
                    {format(new Date(item.start_date), "dd/MM/yyyy", { locale: ptBR })} -{" "}
                    {format(new Date(item.end_date), "dd/MM/yyyy", { locale: ptBR })}
                  </p>
                  {item.reason && (
                    <p className="text-xs text-muted-foreground">{item.reason}</p>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleDelete(item.id)}
                  className="text-destructive hover:text-destructive hover:bg-destructive/10"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
