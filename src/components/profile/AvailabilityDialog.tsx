import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AvailabilityManager } from "./AvailabilityManager";

interface AvailabilityDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AvailabilityDialog({ open, onOpenChange }: AvailabilityDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Minha Disponibilidade</DialogTitle>
        </DialogHeader>
        <AvailabilityManager active={open} />
      </DialogContent>
    </Dialog>
  );
}
