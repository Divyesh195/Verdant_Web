import { Circle, Clock, Hammer, CheckCircle, XCircle } from "lucide-react";

export const STATUS_GROUPS = {
  OPEN: { title: "Open", icon: Circle, color: "border-blue-300", countColor: "text-blue-600" },
  PLANNED: { title: "Planned", icon: Clock, color: "border-amber-300", countColor: "text-amber-600" },
  IN_PROGRESS: { title: "In progress", icon: Hammer, color: "border-purple-300", countColor: "text-purple-600" },
  COMPLETED: { title: "Completed", icon: CheckCircle, color: "border-emerald-300", countColor: "text-emerald-600" },
  REJECTED: { title: "Rejected", icon: XCircle, color: "border-red-300", countColor: "text-red-600" },
};
export const STATUS_ORDER = Object.keys(STATUS_GROUPS) as (keyof typeof STATUS_GROUPS)[];
