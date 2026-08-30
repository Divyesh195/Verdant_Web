import { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export const StatCard = ({ icon: Icon, label, value, hint, accent }: {
  icon: LucideIcon;
  label: string;
  value: string;
  hint?: string;
  accent?: string;
}) => (
  <Card className="group relative overflow-hidden border-border/60 transition-all hover:shadow-soft hover:-translate-y-0.5">
    <div className="absolute inset-x-0 top-0 h-1 bg-primary-gradient opacity-70" />
    <CardContent className="p-5">
      <div className="flex items-center justify-between">
        <p className="text-prefix">{label}</p>
        <span className="grid h-9 w-9 place-items-center rounded-lg bg-accent text-accent-foreground">
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <p className="mt-3 font-display text-2xl font-bold tracking-tight">{value}</p>
      {hint && <p className="text-body mt-1">{accent && <span className="font-medium text-primary">{accent} </span>}{hint}</p>}
    </CardContent>
  </Card>
);
