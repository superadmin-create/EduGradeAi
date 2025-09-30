import { useQuery } from "@tanstack/react-query";
import { FileText, Clock, Users, TrendingUp } from "lucide-react";
import { useLocation } from "wouter";

interface StatCard {
  label: string;
  value: string;
  change: string;
  changeType: 'positive' | 'negative' | 'neutral';
  icon: React.ComponentType<any>;
  navigateTo: string;
}

interface StatsData {
  totalAssignments: number;
  pendingGrading: number;
  totalStudents: number;
  averageGrade: number;
}

export default function StatsCards() {
  const [, setLocation] = useLocation();
  const { data: stats, isLoading } = useQuery<StatsData>({
    queryKey: ["/api/stats"],
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="stat-card p-6 rounded-lg animate-pulse">
            <div className="flex items-center justify-between">
              <div className="space-y-2">
                <div className="h-4 bg-muted rounded w-24"></div>
                <div className="h-8 bg-muted rounded w-16"></div>
                <div className="h-3 bg-muted rounded w-20"></div>
              </div>
              <div className="w-12 h-12 bg-muted rounded-lg"></div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  const statsCards: StatCard[] = [
    {
      label: "Total Assignments",
      value: stats?.totalAssignments?.toString() || "0",
      change: "+12% from last month",
      changeType: 'positive',
      icon: FileText,
      navigateTo: "/assignments",
    },
    {
      label: "Pending Grading",
      value: stats?.pendingGrading?.toString() || "0",
      change: "Requires attention",
      changeType: (stats?.pendingGrading || 0) > 0 ? 'negative' : 'neutral',
      icon: Clock,
      navigateTo: "/submissions",
    },
    {
      label: "Students",
      value: stats?.totalStudents?.toString() || "0",
      change: "Active this semester",
      changeType: 'positive',
      icon: Users,
      navigateTo: "/submissions",
    },
    {
      label: "Avg. Grade",
      value: `${stats?.averageGrade || 0}%`,
      change: "+3.2% improvement",
      changeType: 'positive',
      icon: TrendingUp,
      navigateTo: "/grading-results",
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {statsCards.map((card, index) => {
        const Icon = card.icon;
        return (
          <div 
            key={index} 
            className="stat-card p-6 rounded-lg cursor-pointer hover:shadow-lg transition-shadow" 
            data-testid={`stat-card-${card.label.toLowerCase().replace(/\s+/g, '-')}`}
            onClick={() => setLocation(card.navigateTo)}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-muted-foreground text-sm font-medium">{card.label}</p>
                <p className="text-3xl font-bold text-foreground mt-2">{card.value}</p>
                <p className={`text-xs mt-1 ${
                  card.changeType === 'positive' ? 'text-accent' : 
                  card.changeType === 'negative' ? 'text-destructive' : 
                  'text-muted-foreground'
                }`}>
                  {card.change}
                </p>
              </div>
              <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
                <Icon className="text-primary text-xl" />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
