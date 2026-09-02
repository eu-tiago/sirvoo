import { useState, useEffect } from "react";
import { CheckCircle2, Calendar, TrendingUp, Award, Clock, Star, Users, BarChart3 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useChurchId } from "@/hooks/useChurchId";
import { startOfMonth, endOfMonth, startOfWeek, endOfWeek, subMonths, differenceInMonths } from "date-fns";

interface StatCardProps {
  icon: React.ElementType;
  label: string;
  value: string;
  trend?: string;
  trendUp?: boolean;
  delay?: string;
  color?: string;
}

function StatCard({ icon: Icon, label, value, trend, trendUp = true, delay, color }: StatCardProps) {
  return (
    <div
      className={`bg-card rounded-2xl p-3 sm:p-4 flex items-center gap-2.5 sm:gap-3 border border-border/40 shadow-sirvo-soft hover:shadow-sirvo transition-all animate-slide-up opacity-0 ${delay}`}
      style={{ animationFillMode: "forwards" }}
    >
      <div
        className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center shrink-0"
        style={{ backgroundColor: color ? `${color}1F` : "hsl(var(--primary) / 0.1)" }}
      >
        <Icon
          className="w-4 h-4 sm:w-5 sm:h-5"
          style={{ color: color || "hsl(var(--primary))" }}
        />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xl sm:text-2xl font-bold text-foreground leading-none">{value}</p>
        <p className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-wide text-muted-foreground truncate mt-1">
          {label}
        </p>
      </div>
      {trend && (
        <span
          className={`text-[10px] sm:text-xs font-bold uppercase px-2 py-1 rounded-full shrink-0 ${
            trendUp
              ? "text-success bg-success/10"
              : "text-destructive bg-destructive/10"
          }`}
        >
          {trend}
        </span>
      )}
    </div>
  );
}

interface StatsData {
  monthlySchedules: number;
  weeklySchedules: number;
  confirmationRate: number;
  confirmationTrend: number;
  activeMonths: number;
  totalServings: number;
  avgPerMonth: number;
  ministriesCount: number;
}

export function QuickStats() {
  const { churchId } = useChurchId();
  const [stats, setStats] = useState<StatsData>({
    monthlySchedules: 0,
    weeklySchedules: 0,
    confirmationRate: 0,
    confirmationTrend: 0,
    activeMonths: 0,
    totalServings: 0,
    avgPerMonth: 0,
    ministriesCount: 0
  });

  useEffect(() => {
    fetchStats();
  }, [churchId]);

  const fetchStats = async () => {
    if (!churchId) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const now = new Date();
      const monthStart = startOfMonth(now).toISOString();
      const monthEnd = endOfMonth(now).toISOString();
      const weekStart = startOfWeek(now, { weekStartsOn: 0 }).toISOString();
      const weekEnd = endOfWeek(now, { weekStartsOn: 0 }).toISOString();
      const lastMonthStart = startOfMonth(subMonths(now, 1)).toISOString();
      const lastMonthEnd = endOfMonth(subMonths(now, 1)).toISOString();

      // Fetch all user's assignments
      const { data: allAssignments } = await supabase
        .from("schedule_assignments")
        .select(`
          id,
          status,
          created_at,
          schedules!inner (
            events!inner (
              event_date
            ),
            ministries!inner (
              church_id
            )
          )
        `)
        .eq("user_id", user.id)
        .eq("schedules.ministries.church_id", churchId);

      // This month's schedules
      const monthlySchedules = (allAssignments || []).filter((a: any) => {
        const date = new Date(a.schedules.events.event_date);
        return date >= new Date(monthStart) && date <= new Date(monthEnd);
      }).length;

      // This week's schedules
      const weeklySchedules = (allAssignments || []).filter((a: any) => {
        const date = new Date(a.schedules.events.event_date);
        return date >= new Date(weekStart) && date <= new Date(weekEnd);
      }).length;

      // Confirmation rate (current month)
      const currentMonthAssignments = (allAssignments || []).filter((a: any) => {
        const date = new Date(a.schedules.events.event_date);
        return date >= new Date(monthStart) && date <= new Date(monthEnd);
      });
      const confirmedThisMonth = currentMonthAssignments.filter((a: any) => a.status === "confirmed").length;
      const confirmationRate = currentMonthAssignments.length > 0 
        ? Math.round((confirmedThisMonth / currentMonthAssignments.length) * 100)
        : 0;

      // Last month's confirmation rate for trend
      const lastMonthAssignments = (allAssignments || []).filter((a: any) => {
        const date = new Date(a.schedules.events.event_date);
        return date >= new Date(lastMonthStart) && date <= new Date(lastMonthEnd);
      });
      const confirmedLastMonth = lastMonthAssignments.filter((a: any) => a.status === "confirmed").length;
      const lastMonthRate = lastMonthAssignments.length > 0
        ? Math.round((confirmedLastMonth / lastMonthAssignments.length) * 100)
        : 0;
      const confirmationTrend = confirmationRate - lastMonthRate;

      // Calculate active months
      const firstAssignment = (allAssignments || []).sort((a: any, b: any) => 
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      )[0];
      const activeMonths = firstAssignment 
        ? differenceInMonths(now, new Date(firstAssignment.created_at)) + 1
        : 0;

      // Total servings
      const totalServings = (allAssignments || []).length;

      // Average per month
      const avgPerMonth = activeMonths > 0 ? Math.round(totalServings / activeMonths * 10) / 10 : 0;

      // Ministries count
      const { data: ministryMemberships } = await supabase
        .from("ministry_members")
        .select("ministry_id")
        .eq("user_id", user.id);
      
      const ministriesCount = ministryMemberships?.length || 0;

      setStats({
        monthlySchedules,
        weeklySchedules,
        confirmationRate,
        confirmationTrend,
        activeMonths,
        totalServings,
        avgPerMonth,
        ministriesCount
      });
    } catch (error) {
      console.error("Error fetching stats:", error);
    }
  };

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      <StatCard
        icon={CheckCircle2}
        label="Escalas este mês"
        value={stats.monthlySchedules.toString()}
        delay="stagger-1"
        color="#5B7BFF"
      />
      <StatCard
        icon={Calendar}
        label="Próximos 7 dias"
        value={stats.weeklySchedules.toString()}
        delay="stagger-2"
        color="#4ECDC4"
      />
      <StatCard
        icon={TrendingUp}
        label="Taxa de confirmação"
        value={`${stats.confirmationRate}%`}
        trend={stats.confirmationTrend !== 0 ? `${stats.confirmationTrend > 0 ? '+' : ''}${stats.confirmationTrend}%` : undefined}
        trendUp={stats.confirmationTrend >= 0}
        delay="stagger-3"
        color="#10B981"
      />
      <StatCard
        icon={Award}
        label="Meses ativos"
        value={stats.activeMonths.toString()}
        delay="stagger-4"
        color="#F59E0B"
      />
      <StatCard
        icon={BarChart3}
        label="Total de serviços"
        value={stats.totalServings.toString()}
        delay="stagger-5"
        color="#8B5CF6"
      />
      <StatCard
        icon={Star}
        label="Média por mês"
        value={stats.avgPerMonth.toString()}
        delay="stagger-1"
        color="#EC4899"
      />
      <StatCard
        icon={Users}
        label="Ministérios"
        value={stats.ministriesCount.toString()}
        delay="stagger-2"
        color="#06B6D4"
      />
    </div>
  );
}
