import { useState, useEffect } from "react";
import { Music, Tv, Speaker, Mic, ChevronRight, Loader2, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface Ministry {
  id: string;
  name: string;
  role: string;
  icon: string;
  color: string;
  isLeader: boolean;
}

const iconMap: Record<string, React.ElementType> = {
  music: Music,
  tv: Tv,
  speaker: Speaker,
  mic: Mic,
  users: Users,
};

export function ProfileMinistries() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [ministries, setMinistries] = useState<Ministry[]>([]);

  useEffect(() => {
    if (user) {
      fetchMinistries();
    }
  }, [user]);

  const fetchMinistries = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from("ministry_members")
        .select(`
          id,
          is_leader,
          ministry:ministries(id, name, icon, color)
        `)
        .eq("user_id", user.id);

      if (error) throw error;

      const transformed = (data || [])
        .filter((item: any) => item.ministry)
        .map((item: any) => ({
          id: item.ministry.id,
          name: item.ministry.name,
          role: item.is_leader ? "Líder" : "Membro",
          icon: item.ministry.icon || "music",
          color: item.ministry.color || "#5B7BFF",
          isLeader: item.is_leader,
        }));

      setMinistries(transformed);
    } catch (error) {
      console.error("Error fetching ministries:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="px-4 md:px-6 mt-6">
        <h2 className="text-lg font-bold text-foreground mb-4">Meus Ministérios</h2>
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  if (ministries.length === 0) {
    return (
      <div className="px-4 md:px-6 mt-6">
        <h2 className="text-lg font-bold text-foreground mb-4">Meus Ministérios</h2>
        <div className="text-center py-8 text-muted-foreground">
          <p className="text-sm">Você ainda não participa de nenhum ministério</p>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 md:px-6 mt-6">
      <h2 className="text-lg font-bold text-foreground mb-4">Meus Ministérios</h2>
      <div className="space-y-3">
        {ministries.map((ministry) => {
          const Icon = iconMap[ministry.icon] || Music;
          
          return (
            <div
              key={ministry.id}
              className="sirvo-card flex items-center gap-4 transition-all duration-300 text-left"
            >
              <div
                className="w-12 h-12 rounded-2xl flex items-center justify-center"
                style={{ backgroundColor: `${ministry.color}15`, color: ministry.color }}
              >
                <Icon className="w-6 h-6" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-foreground">{ministry.name}</p>
                <p className="text-sm text-muted-foreground">{ministry.role}</p>
              </div>
              <ChevronRight className="w-5 h-5 text-muted-foreground" />
            </div>
          );
        })}
      </div>
    </div>
  );
}