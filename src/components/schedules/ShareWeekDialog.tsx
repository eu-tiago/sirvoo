import { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ChevronLeft, ChevronRight, Copy, Share2, MessageCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ShareTeamMember {
  name: string;
  role: string;
}

export interface ShareSchedule {
  id: string;
  title: string;
  time: string;
  ministry: string;
  eventDate?: string;
  team: ShareTeamMember[];
}

interface ShareWeekDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  schedules: ShareSchedule[];
}

/**
 * Emojis definidos através de Unicode explícito.
 * Isso evita problemas de encoding e o caractere "�".
 */
const MINISTRY_EMOJIS: Array<[RegExp, string]> = [
  [/som|áudio|audio|mesa/i, "\u{1F50A}"],
  [/ilumin|luz/i, "\u{1F4A1}"],
  [/proje|slide|multim/i, "\u{1F4FD}\u{FE0F}"],
  [/live|transmiss|stream|c[âa]mera|v[íi]deo/i, "\u{1F3A5}"],
  [/louvor|m[úu]sica|worship|banda/i, "\u{1F3B5}"],
  [/recep|acolhi|diaconi/i, "\u{1F91D}"],
  [/infantil|kids|crian/i, "\u{1F9D2}"],
  [/ora[çc]|intercess/i, "\u{1F64F}"],
];

function emojiFor(ministry: string) {
  for (const [regex, emoji] of MINISTRY_EMOJIS) {
    if (regex.test(ministry)) {
      return emoji;
    }
  }

  return "\u{1F539}";
}

/**
 * Retorna a segunda-feira da semana que contém a data.
 */
function startOfWeek(d: Date) {
  const date = new Date(d.getFullYear(), d.getMonth(), d.getDate());

  const day = date.getDay();

  const diff = day === 0 ? -6 : 1 - day;

  date.setDate(date.getDate() + diff);

  return date;
}

function toISO(d: Date) {
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");

  return `${d.getFullYear()}-${month}-${day}`;
}

function ddmm(d: Date) {
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function ddmmFromISO(iso: string) {
  const [, month, day] = iso.split("-");

  return `${day}/${month}`;
}

const WEEKDAYS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

function weekdayFromISO(iso: string) {
  const [year, month, day] = iso.split("-").map(Number);

  return WEEKDAYS[new Date(year, (month || 1) - 1, day || 1).getDay()];
}

export function ShareWeekDialog({ open, onOpenChange, schedules }: ShareWeekDialogProps) {
  const { toast } = useToast();

  const [offset, setOffset] = useState(0);

  /**
   * Calcula o início e o fim da semana.
   */
  const { weekStart, weekEnd } = useMemo(() => {
    const base = startOfWeek(new Date());

    base.setDate(base.getDate() + offset * 7);

    const end = new Date(base);

    end.setDate(end.getDate() + 6);

    return {
      weekStart: base,
      weekEnd: end,
    };
  }, [offset]);

  /**
   * Filtra as escalas da semana selecionada.
   */
  const weekSchedules = useMemo(() => {
    const from = toISO(weekStart);
    const to = toISO(weekEnd);

    return schedules.filter((schedule) => schedule.eventDate && schedule.eventDate >= from && schedule.eventDate <= to);
  }, [schedules, weekStart, weekEnd]);

  /**
   * Monta o texto que será compartilhado.
   */
  const text = useMemo(() => {
    const lines: string[] = ["\u{1F4C5} ESCALA DA SEMANA", `${ddmm(weekStart)} a ${ddmm(weekEnd)}`, ""];

    if (weekSchedules.length === 0) {
      lines.push("Nenhuma escala cadastrada nesta semana.");

      return lines.join("\n");
    }

    /**
     * Agrupa por ministério.
     */
    const byMinistry = new Map<string, ShareSchedule[]>();

    for (const schedule of weekSchedules) {
      const list = byMinistry.get(schedule.ministry) || [];

      list.push(schedule);

      byMinistry.set(schedule.ministry, list);
    }

    /**
     * Ordena os ministérios.
     */
    const ministries = Array.from(byMinistry.keys()).sort((a, b) => a.localeCompare(b, "pt-BR"));

    for (const ministry of ministries) {
      const list = byMinistry
        .get(ministry)!
        .slice()
        .sort((a, b) => {
          const dateComparison = (a.eventDate || "").localeCompare(b.eventDate || "");

          if (dateComparison !== 0) {
            return dateComparison;
          }

          return a.time.localeCompare(b.time);
        });

      /**
       * Nome do ministério.
       */
      lines.push(`${emojiFor(ministry)} ${ministry.toUpperCase()}`);

      for (const schedule of list) {
        const when = schedule.eventDate
          ? `${weekdayFromISO(schedule.eventDate)} ${ddmmFromISO(schedule.eventDate)}${
              schedule.time ? ` ${schedule.time}` : ""
            }`
          : schedule.time;

        /**
         * Evento.
         */
        lines.push(`${when} \u2014 ${schedule.title}`);

        /**
         * Voluntários.
         */
        if (schedule.team.length === 0) {
          lines.push("\u2022 (sem voluntários escalados)");
        } else {
          for (const member of schedule.team) {
            lines.push(`\u2022 ${member.name}${member.role ? ` \u2014 ${member.role}` : ""}`);
          }
        }

        lines.push("");
      }
    }

    return lines.join("\n").trimEnd();
  }, [weekSchedules, weekStart, weekEnd]);

  /**
   * =====================================================
   * COMPARTILHAMENTO NATIVO
   * =====================================================
   */
  const handleNativeShare = async () => {
    try {
      if (typeof navigator !== "undefined" && navigator.share) {
        await navigator.share({
          title: "Escala da semana",
          text,
        });

        return;
      }

      await navigator.clipboard.writeText(text);

      toast({
        title: "Texto copiado",
        description: "Cole no WhatsApp para compartilhar.",
      });
    } catch (error) {
      /**
       * Usuário cancelou o compartilhamento.
       */
      if (error instanceof DOMException && error.name === "AbortError") {
        return;
      }

      toast({
        title: "Não foi possível compartilhar",
        description: "Tente copiar o texto manualmente.",
        variant: "destructive",
      });
    }
  };

  /**
   * =====================================================
   * COPIAR
   * =====================================================
   */
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);

      toast({
        title: "Texto copiado",
        description: "Cole onde quiser compartilhar.",
      });
    } catch {
      toast({
        title: "Não foi possível copiar",
        description: "Tente novamente.",
        variant: "destructive",
      });
    }
  };

  /**
   * =====================================================
   * WHATSAPP
   * =====================================================
   *
   * IMPORTANTE:
   *
   * O endereço utilizado aqui é SOMENTE:
   *
   * https://wa.me/
   *
   * Não utilizamos:
   *
   * api.whatsapp.com
   *
   * Também não utilizamos:
   *
   * /send/
   *
   * /?phone=
   *
   * A mensagem é enviada através do parâmetro:
   *
   * ?text=
   */
  const handleWhatsApp = () => {
    /**
     * Cria os parâmetros da URL.
     *
     * URLSearchParams faz a codificação
     * correta dos emojis, acentos,
     * espaços e quebras de linha.
     */
    const params = new URLSearchParams();

    params.set("text", text);

    /**
     * URL FINAL:
     *
     * https://wa.me/?text=...
     */
    const whatsappUrl = `https://wa.me/?${params.toString()}`;

    /**
     * Segurança extra:
     * garante que nunca utilizaremos
     * api.whatsapp.com.
     */
    if (whatsappUrl.includes("api.whatsapp.com")) {
      toast({
        title: "Erro ao abrir WhatsApp",
        description: "O endereço do WhatsApp não é válido.",
        variant: "destructive",
      });

      return;
    }

    /**
     * Navegação DIRETA para wa.me.
     *
     * Não usamos window.open.
     */
    window.location.href = whatsappUrl;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Compartilhar escala da semana</DialogTitle>

          <DialogDescription>Revise o texto antes de enviar. Nada é alterado nas escalas.</DialogDescription>
        </DialogHeader>

        {/* Navegação entre semanas */}
        <div className="flex items-center justify-between gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => setOffset((current) => current - 1)}
            aria-label="Semana anterior"
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>

          <div className="text-sm font-medium text-center">
            {ddmm(weekStart)} a {ddmm(weekEnd)}
            <span className="block text-xs text-muted-foreground font-normal">
              {weekSchedules.length} {weekSchedules.length === 1 ? "escala" : "escalas"}
            </span>
          </div>

          <Button
            variant="outline"
            size="icon"
            onClick={() => setOffset((current) => current + 1)}
            aria-label="Próxima semana"
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>

        {/* Texto da escala */}
        <Textarea value={text} readOnly rows={14} className="font-mono text-xs" />

        {/* Botões */}
        <div className="flex flex-col sm:flex-row gap-2">
          {/* Compartilhar */}
          <Button onClick={handleNativeShare} className="flex-1">
            <Share2 className="w-4 h-4 mr-2" />
            Compartilhar
          </Button>

          {/* WhatsApp */}
          <Button variant="outline" onClick={handleWhatsApp} className="flex-1">
            <MessageCircle className="w-4 h-4 mr-2" />
            WhatsApp
          </Button>

          {/* Copiar */}
          <Button variant="outline" onClick={handleCopy} className="flex-1">
            <Copy className="w-4 h-4 mr-2" />
            Copiar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
