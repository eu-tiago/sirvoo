import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ArrowLeftRight, Loader2 } from "lucide-react";
import { getInitials } from "@/lib/utils";


interface AvailableUser {
  id: string;
  name: string;
}

interface SwapRequestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  availableUsers: AvailableUser[];
  loading: boolean;
  swapping: boolean;
  onRequestSwap: (userId: string, userName: string) => void;
}

export function SwapRequestDialog({
  open,
  onOpenChange,
  availableUsers,
  loading,
  swapping,
  onRequestSwap
}: SwapRequestDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowLeftRight className="w-5 h-5 text-primary" />
            Solicitar Troca
          </DialogTitle>
          <DialogDescription>
            Selecione um voluntário para trocar sua escala
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : availableUsers.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              Nenhum voluntário disponível para troca
            </p>
          ) : (
            availableUsers.map((user) => (
              <Button
                key={user.id}
                variant="outline"
                className="w-full justify-start gap-3 h-auto py-3"
                onClick={() => onRequestSwap(user.id, user.name)}
                disabled={swapping}
              >
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-xs font-bold text-primary-foreground" title={user.name}>
                  {getInitials(user.name)}
                </div>
                <span className="text-sm font-medium">{user.name}</span>
                {swapping && <Loader2 className="w-4 h-4 animate-spin ml-auto" />}
              </Button>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
