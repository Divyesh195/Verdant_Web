"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Calendar, Target, Wallet, TrendingUp, Film, Leaf, LogOut, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "./ThemeToggle";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";

const defaultAvatar = `data:image/svg+xml;utf8,${encodeURIComponent(`
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96" fill="none">
    <rect width="96" height="96" rx="48" fill="#d1fae5" />
    <circle cx="48" cy="38" r="16" fill="#065f46" />
    <path d="M20 78c6.7-13 19-20 28-20s21.3 7 28 20" fill="#065f46" />
  </svg>
`)}`;

const links = [
  { to: "/", label: "Home", icon: Leaf, end: true },
  { to: "/events", label: "Events", icon: Calendar },
  { to: "/goals", label: "Goals", icon: Target },
  { to: "/expenses", label: "Expenses", icon: Wallet },
  { to: "/investments", label: "Investments", icon: TrendingUp },
  { to: "/movies", label: "Movies", icon: Film },
];

export const Navbar = () => {
  const { user, signOut, loading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const avatarUrl = user?.user_metadata?.avatar_url || user?.user_metadata?.picture || defaultAvatar;

  const isActivePath = (to: string, end?: boolean) => {
    if (end) {
      return pathname === to;
    }

    return pathname === to || pathname.startsWith(`${to}/`);
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/60 bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-site items-center justify-between gap-4 px-4 md:px-6">
        <Link href="/" className="flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary-gradient shadow-glow">
            <Leaf className="h-4 w-4 text-primary-foreground" />
          </span>
          <span className="font-display text-base font-bold tracking-tight">Verdant</span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {links.map(({ to, label, icon: Icon, end }) => (
            <Link
              key={to}
              href={to}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                isActivePath(to, end)
                  ? "bg-secondary text-foreground"
                  : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-1">
          <ThemeToggle />

          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="overflow-hidden rounded-full border border-border/60"
                  aria-label="Profile menu"
                  disabled={loading}
                >
                  <img
                    src={avatarUrl}
                    alt={user.email ?? "User avatar"}
                    className="h-full w-full object-cover"
                    onError={(event) => {
                      event.currentTarget.src = defaultAvatar;
                    }}
                  />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="grid h-8 w-8 place-items-center rounded-full bg-secondary">
                      <UserRound className="h-4 w-4 text-muted-foreground" />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">Profile</p>
                      <p className="truncate text-xs text-muted-foreground">{user.email}</p>
                    </div>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="cursor-pointer text-destructive focus:text-destructive"
                  onSelect={async (event) => {
                    event.preventDefault();
                    await signOut();
                    router.push("/auth");
                  }}
                >
                  <LogOut className="h-4 w-4" />
                  Log out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button
              variant="ghost"
              size="icon"
              aria-label="Sign in"
              onClick={() => router.push("/auth")}
            >
              <span className="text-xs font-semibold">In</span>
            </Button>
          )}
        </div>
      </div>

      {/* Mobile nav */}
      <nav className="flex items-center gap-1 overflow-x-auto border-t border-border/60 px-4 py-2 md:hidden">
        {links.map(({ to, label, icon: Icon, end }) => (
          <Link
            key={to}
            href={to}
            className={cn(
              "flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium",
              isActivePath(to, end) ? "bg-secondary text-foreground" : "text-muted-foreground"
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </Link>
        ))}
      </nav>
    </header>
  );
};
