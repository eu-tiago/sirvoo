import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useChurchId } from "@/hooks/useChurchId";
import { Skeleton } from "@/components/ui/skeleton";

interface StatItemProps {
  label: string;
  value: string;
}

function StatItem({ label, value }: StatItemProps) {
  return (
    <div className="text-center">
      <p className="text-2xl font-bold sirvo-gradient-text">{value}</p>
      <p className="text-xs text-muted-foreground mt-1">{label}</p>
    </div>
  );
}

export function ProfileStats() {
  const { churchId } = useChurchId();
  const [stats, setStats] = useState<{ schedules: number; months: number; confirmRate: number } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, [churchId]);

  const fetchStats = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get all assignments for this user
      const { data: assignments } = await supabase
        .from("schedule_assignments")
        .select(`
          id,
          status,
          created_at,
          schedule_id,
          schedules!inner (
            id,
            ministry_id,
            ministries!inner (church_id)
          )
        `)
        .eq("user_id", user.id);

      if (!assignments || assignments.length === 0) {
        setStats({ schedules: 0, months: 0, confirmRate: 0 });
        setLoading(false);
        return;
      }

      // Filter by church if available
      const filtered = churchId
        ? assignments.filter((a: any) => a.schedules?.ministries?.church_id === churchId)
        : assignments;

      const totalSchedules = filtered.length;
      const confirmed = filtered.filter((a: any) => a.status === "confirmed").length;
      const confirmRate = totalSchedules > 0 ? Math.round((confirmed / totalSchedules) * 100) : 0;

      // Calculate unique months active
      const months = new Set(
        filtered.map((a: any) => {
          const d = new Date(a.created_at);
          return `${d.getFullYear()}-${d.getMonth()}`;
        })
      ).size;

      setStats({ schedules: totalSchedules, months, confirmRate });
    } catch (err) {
      console.error("Error fetching profile stats:", err);
      setStats({ schedules: 0, months: 0, confirmRate: 0 });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="sirvo-card -mt-6 mx-4 relative z-10">
        <div className="grid grid-cols-3 divide-x divide-border">
          {[1, 2, 3].map(i => (
            <div key={i} className="text-center py-2">
              <Skeleton className="h-8 w-10 mx-auto mb-1" />
              <Skeleton className="h-3 w-16 mx-auto" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!stats || (stats.schedules === 0 && stats.months === 0)) {
    return null; // Hide when no data
  }

  return (
    <div className="sirvo-card -mt-6 mx-4 relative z-10">
      <div className="grid grid-cols-3 divide-x divide-border">
        <StatItem label="Escalas" value={String(stats.schedules)} />
        <StatItem label="Meses" value={String(stats.months)} />
        <StatItem label="Frequência" value={`${stats.confirmRate}%`} />
      </div>
    </div>
  );
}
