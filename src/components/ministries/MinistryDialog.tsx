import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const ICON_OPTIONS = [
  { value: "music", label: "Música" },
  { value: "tv", label: "Mídia" },
  { value: "speaker", label: "Som" },
  { value: "lightbulb", label: "Criativo" },
  { value: "user-check", label: "Recepção" },
  { value: "baby", label: "Infantil" },
  { value: "heart", label: "Social" },
  { value: "shield", label: "Segurança" },
  { value: "users", label: "Comunidade" },
  { value: "mic", label: "Pregação" },
];

const COLOR_OPTIONS = [
  "#5B7BFF", "#FF6B6B", "#4ECDC4", "#FFD93D",
  "#6C5CE7", "#A8E6CF", "#FF8A5C", "#EA8685",
];

interface MinistryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: { name: string; description?: string; color: string; icon: string }) => Promise<void>;
  initialData?: { name: string; description?: string; color: string; icon: string };
  mode: "create" | "edit";
}

export function MinistryDialog({ open, onOpenChange, onSubmit, initialData, mode }: MinistryDialogProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState(COLOR_OPTIONS[0]);
  const [icon, setIcon] = useState(ICON_OPTIONS[0].value);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && initialData) {
      setName(initialData.name);
      setDescription(initialData.description || "");
      setColor(initialData.color);
      setIcon(initialData.icon);
    } else if (open && mode === "create") {
      setName("");
      setDescription("");
      setColor(COLOR_OPTIONS[0]);
      setIcon(ICON_OPTIONS[0].value);
    }
  }, [open, initialData, mode]);

  const handleSubmit = async () => {
    if (!name.trim()) return;
    setLoading(true);
    try {
      await onSubmit({ name: name.trim(), description: description.trim() || undefined, color, icon });
      onOpenChange(false);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{mode === "create" ? "Novo Ministério" : "Editar Ministério"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Nome</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome do ministério" />
          </div>

          <div className="space-y-2">
            <Label>Descrição</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Descrição (opcional)" rows={3} />
          </div>

          <div className="space-y-2">
            <Label>Cor</Label>
            <div className="flex gap-2 flex-wrap">
              {COLOR_OPTIONS.map((c) => (
                <button
                  key={c}
                  type="button"
                  className={`w-8 h-8 rounded-full border-2 transition-transform ${color === c ? "border-foreground scale-110" : "border-transparent"}`}
                  style={{ backgroundColor: c }}
                  onClick={() => setColor(c)}
                />
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Ícone</Label>
            <div className="flex gap-2 flex-wrap">
              {ICON_OPTIONS.map((opt) => (
                <Button
                  key={opt.value}
                  type="button"
                  variant={icon === opt.value ? "default" : "outline"}
                  size="sm"
                  onClick={() => setIcon(opt.value)}
                >
                  {opt.label}
                </Button>
              ))}
            </div>
          </div>

          <Button onClick={handleSubmit} disabled={!name.trim() || loading} className="w-full">
            {loading ? "Salvando..." : mode === "create" ? "Criar Ministério" : "Salvar Alterações"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
