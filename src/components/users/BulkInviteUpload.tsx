import { useState, useRef } from "react";
import * as XLSX from "xlsx";
import { Upload, Download, Loader2, CheckCircle2, XCircle, FileSpreadsheet, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useChurchId } from "@/hooks/useChurchId";
import { useMinistries } from "@/hooks/useMinistries";
import { supabase } from "@/integrations/supabase/client";
import { z } from "zod";

interface BulkInviteUploadProps {
  onSuccess: () => void;
  churchName: string;
  inviterName: string;
  remainingSlots: number;
  isSuperAdmin: boolean;
}

interface ParsedRow {
  email: string;
  role: "admin" | "ministry_leader" | "volunteer";
  ministryName?: string;
  ministryId?: string;
  rowNumber: number;
  valid: boolean;
  error?: string;
}

interface SendResult {
  email: string;
  success: boolean;
  error?: string;
}

const rowSchema = z.object({
  email: z.string().trim().email("Email inválido").max(255),
  role: z.enum(["admin", "ministry_leader", "volunteer"]),
});

const ROLE_MAP: Record<string, "admin" | "ministry_leader" | "volunteer"> = {
  admin: "admin",
  administrador: "admin",
  administrator: "admin",
  "líder": "ministry_leader",
  lider: "ministry_leader",
  "líder de ministério": "ministry_leader",
  "lider de ministerio": "ministry_leader",
  ministry_leader: "ministry_leader",
  leader: "ministry_leader",
  voluntário: "volunteer",
  voluntario: "volunteer",
  volunteer: "volunteer",
};

export function BulkInviteUpload({
  onSuccess,
  churchName,
  inviterName,
  remainingSlots,
  isSuperAdmin,
}: BulkInviteUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [fileName, setFileName] = useState("");
  const [sending, setSending] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<SendResult[]>([]);
  const { toast } = useToast();
  const { churchId } = useChurchId();
  const { ministries } = useMinistries(churchId);

  const downloadTemplate = () => {
    const ws = XLSX.utils.aoa_to_sheet([
      ["email", "funcao", "ministerio"],
      ["joao@exemplo.com", "voluntario", "Louvor"],
      ["maria@exemplo.com", "lider", "Recepção"],
      ["pedro@exemplo.com", "admin", ""],
    ]);

    // Column widths
    ws["!cols"] = [{ wch: 30 }, { wch: 20 }, { wch: 25 }];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Convites");

    // Add an instructions sheet
    const instructionsWs = XLSX.utils.aoa_to_sheet([
      ["INSTRUÇÕES PARA PREENCHIMENTO"],
      [""],
      ["Coluna 'email' (obrigatório)", "Email válido do convidado"],
      ["Coluna 'funcao' (obrigatório)", "Valores aceitos: admin, lider, voluntario"],
      ["Coluna 'ministerio' (opcional)", "Nome exato do ministério (deixe vazio para nenhum)"],
      [""],
      ["• Não altere os nomes das colunas (linha 1)"],
      ["• O ministério deve existir previamente cadastrado no sistema"],
      ["• Cada linha = 1 convite enviado por email"],
      ["• Convites duplicados serão atualizados"],
    ]);
    instructionsWs["!cols"] = [{ wch: 35 }, { wch: 50 }];
    XLSX.utils.book_append_sheet(wb, instructionsWs, "Instruções");

    XLSX.writeFile(wb, "modelo-convites-sirvo.xlsx");

    toast({
      title: "Modelo baixado",
      description: "Preencha o arquivo e faça o upload abaixo.",
    });
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setResults([]);

    try {
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<Record<string, any>>(ws, { defval: "" });

      const parsed: ParsedRow[] = rows.map((row, idx) => {
        const rowNumber = idx + 2; // +2 because of header and 1-indexed
        const emailRaw = String(row.email || row.Email || row.EMAIL || "").trim();
        const roleRaw = String(row.funcao || row.função || row.Funcao || row.role || "")
          .trim()
          .toLowerCase();
        const ministryRaw = String(row.ministerio || row.ministério || row.Ministerio || "").trim();

        const role = ROLE_MAP[roleRaw];

        if (!emailRaw) {
          return { email: "", role: "volunteer", rowNumber, valid: false, error: "Email vazio" };
        }
        if (!role) {
          return {
            email: emailRaw,
            role: "volunteer",
            rowNumber,
            valid: false,
            error: `Função inválida: "${roleRaw}". Use: admin, lider ou voluntario`,
          };
        }

        const validation = rowSchema.safeParse({ email: emailRaw, role });
        if (!validation.success) {
          return {
            email: emailRaw,
            role,
            rowNumber,
            valid: false,
            error: validation.error.errors[0].message,
          };
        }

        let ministryId: string | undefined;
        if (ministryRaw) {
          const found = ministries.find(
            (m) => m.name.toLowerCase().trim() === ministryRaw.toLowerCase()
          );
          if (!found) {
            return {
              email: emailRaw,
              role,
              ministryName: ministryRaw,
              rowNumber,
              valid: false,
              error: `Ministério "${ministryRaw}" não encontrado`,
            };
          }
          ministryId = found.id;
        }

        return {
          email: emailRaw,
          role,
          ministryName: ministryRaw || undefined,
          ministryId,
          rowNumber,
          valid: true,
        };
      });

      setParsedRows(parsed);

      const validCount = parsed.filter((p) => p.valid).length;
      toast({
        title: `${parsed.length} linha(s) lida(s)`,
        description: `${validCount} válida(s) e ${parsed.length - validCount} com erro.`,
      });
    } catch (err: any) {
      console.error("Error parsing file:", err);
      toast({
        title: "Erro ao ler planilha",
        description: err.message || "Verifique o formato do arquivo.",
        variant: "destructive",
      });
      setParsedRows([]);
      setFileName("");
    }

    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSendAll = async () => {
    const validRows = parsedRows.filter((p) => p.valid);
    if (validRows.length === 0) {
      toast({ title: "Nenhuma linha válida", variant: "destructive" });
      return;
    }

    if (!isSuperAdmin && validRows.length > remainingSlots) {
      toast({
        title: "Limite excedido",
        description: `Você tem ${remainingSlots} vaga(s) e está tentando convidar ${validRows.length}.`,
        variant: "destructive",
      });
      return;
    }

    if (!churchId) return;

    setSending(true);
    setProgress(0);
    const newResults: SendResult[] = [];

    for (let i = 0; i < validRows.length; i++) {
      const row = validRows[i];
      try {
        const { data, error } = await supabase.functions.invoke("send-invite", {
          body: {
            email: row.email,
            role: row.role,
            churchId,
            churchName,
            inviterName,
            ministryId: row.ministryId,
          },
        });

        if (error) throw error;
        if (data?.error) throw new Error(data.error);

        newResults.push({ email: row.email, success: true });
      } catch (err: any) {
        newResults.push({
          email: row.email,
          success: false,
          error: err.message || "Erro desconhecido",
        });
      }
      setProgress(Math.round(((i + 1) / validRows.length) * 100));
      setResults([...newResults]);
    }

    setSending(false);
    const successCount = newResults.filter((r) => r.success).length;
    toast({
      title: "Importação concluída",
      description: `${successCount}/${validRows.length} convites enviados com sucesso.`,
    });
    onSuccess();
  };

  const reset = () => {
    setParsedRows([]);
    setFileName("");
    setResults([]);
    setProgress(0);
  };

  const validCount = parsedRows.filter((p) => p.valid).length;
  const invalidCount = parsedRows.length - validCount;

  return (
    <div className="space-y-4">
      <Alert className="border-primary/30 bg-primary/5">
        <FileSpreadsheet className="h-4 w-4 text-primary" />
        <AlertDescription className="text-sm">
          <strong>Importe múltiplos convites de uma vez.</strong> Baixe o modelo, preencha
          os emails, funções e ministérios, e envie todos os convites com um clique.
        </AlertDescription>
      </Alert>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={downloadTemplate}
          className="w-full"
        >
          <Download className="w-4 h-4 mr-2" />
          Baixar modelo (.xlsx)
        </Button>

        <Button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={sending}
          className="sirvo-btn-primary w-full"
        >
          <Upload className="w-4 h-4 mr-2" />
          {fileName ? "Trocar planilha" : "Carregar planilha"}
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.xls,.csv"
          onChange={handleFileChange}
          className="hidden"
        />
      </div>

      {fileName && (
        <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-muted/30">
          <div className="flex items-center gap-2 min-w-0">
            <FileSpreadsheet className="w-4 h-4 text-primary shrink-0" />
            <span className="text-sm truncate">{fileName}</span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Badge variant="secondary" className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400">
              {validCount} válido(s)
            </Badge>
            {invalidCount > 0 && (
              <Badge variant="secondary" className="bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400">
                {invalidCount} erro(s)
              </Badge>
            )}
          </div>
        </div>
      )}

      {parsedRows.length > 0 && !sending && results.length === 0 && (
        <>
          {!isSuperAdmin && validCount > remainingSlots && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Você tem apenas {remainingSlots} vaga(s) disponíveis no plano. Reduza
                a quantidade ou faça upgrade.
              </AlertDescription>
            </Alert>
          )}

          <div className="max-h-[280px] overflow-y-auto space-y-1.5 pr-1 border rounded-lg p-2">
            {parsedRows.map((row, idx) => (
              <div
                key={idx}
                className={`flex items-start gap-2 p-2 rounded text-xs ${
                  row.valid
                    ? "bg-emerald-50 dark:bg-emerald-900/10"
                    : "bg-red-50 dark:bg-red-900/10"
                }`}
              >
                {row.valid ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                ) : (
                  <XCircle className="w-3.5 h-3.5 text-red-600 shrink-0 mt-0.5" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="font-medium truncate">
                    Linha {row.rowNumber}: {row.email || "(sem email)"}
                  </p>
                  {row.valid ? (
                    <p className="text-muted-foreground">
                      {row.role === "admin"
                        ? "Admin"
                        : row.role === "ministry_leader"
                        ? "Líder"
                        : "Voluntário"}
                      {row.ministryName && ` • ${row.ministryName}`}
                    </p>
                  ) : (
                    <p className="text-red-700 dark:text-red-400">{row.error}</p>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={reset}>
              Limpar
            </Button>
            <Button
              type="button"
              onClick={handleSendAll}
              disabled={validCount === 0 || (!isSuperAdmin && validCount > remainingSlots)}
              className="sirvo-btn-primary"
            >
              <Upload className="w-4 h-4 mr-2" />
              Enviar {validCount} convite(s)
            </Button>
          </div>
        </>
      )}

      {sending && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              Enviando convites...
            </span>
            <span className="font-medium">{progress}%</span>
          </div>
          <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {results.length > 0 && !sending && (
        <>
          <Alert className="border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-900/20">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            <AlertDescription>
              <strong>{results.filter((r) => r.success).length}</strong> de{" "}
              <strong>{results.length}</strong> convites enviados com sucesso.
            </AlertDescription>
          </Alert>

          <div className="max-h-[240px] overflow-y-auto space-y-1.5 pr-1 border rounded-lg p-2">
            {results.map((r, idx) => (
              <div
                key={idx}
                className={`flex items-start gap-2 p-2 rounded text-xs ${
                  r.success
                    ? "bg-emerald-50 dark:bg-emerald-900/10"
                    : "bg-red-50 dark:bg-red-900/10"
                }`}
              >
                {r.success ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                ) : (
                  <XCircle className="w-3.5 h-3.5 text-red-600 shrink-0 mt-0.5" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="font-medium truncate">{r.email}</p>
                  {r.error && <p className="text-red-700 dark:text-red-400">{r.error}</p>}
                </div>
              </div>
            ))}
          </div>

          <Button type="button" variant="outline" onClick={reset} className="w-full">
            Importar outra planilha
          </Button>
        </>
      )}
    </div>
  );
}
