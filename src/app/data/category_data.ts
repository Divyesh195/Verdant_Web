import { Bug, Lightbulb, MessageSquare, Paintbrush } from "lucide-react";

const designs = {
  BUG: { icon: Bug, border: "border-red-300", text: "text-red-600" },
  FEATURE: { icon: Lightbulb, border: "border-amber-300", text: "text-amber-600" },
  DESIGN: { icon: Paintbrush, border: "border-purple-300", text: "text-purple-600" },
};
const fallback = { icon: MessageSquare, border: "border-border", text: "text-muted-foreground" };

export function getCategoryDesign(category: string | null | undefined) {
  return designs[category?.toUpperCase() as keyof typeof designs] ?? fallback;
}
