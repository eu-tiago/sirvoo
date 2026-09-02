import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { Church, MapPin, MoreVertical, Pencil, Trash2, Users } from "lucide-react";

interface ChurchCardProps {
  church: {
    id: string;
    name: string;
    city: string | null;
    state: string | null;
    address: string | null;
    memberCount: number;
  };
  onEdit: (church: ChurchCardProps['church']) => void;
  onDelete: (id: string) => void;
}

export function ChurchCard({ church, onEdit, onDelete }: ChurchCardProps) {
  const location = [church.city, church.state].filter(Boolean).join(', ');

  return (
    <Card className="group hover:shadow-md transition-shadow">
      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Church className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground">{church.name}</h3>
            {location && (
              <p className="text-sm text-muted-foreground flex items-center gap-1">
                <MapPin className="w-3 h-3" />
                {location}
              </p>
            )}
          </div>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
              <MoreVertical className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onEdit(church)}>
              <Pencil className="w-4 h-4 mr-2" />
              Editar
            </DropdownMenuItem>
            <DropdownMenuItem 
              onClick={() => onDelete(church.id)}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Excluir
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between">
          <Badge variant="secondary" className="flex items-center gap-1">
            <Users className="w-3 h-3" />
            {church.memberCount} {church.memberCount === 1 ? 'membro' : 'membros'}
          </Badge>
          {church.address && (
            <span className="text-xs text-muted-foreground truncate max-w-[150px]">
              {church.address}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
