"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  Calendar,
  Film,
  Sparkles,
  Target,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { StatCard } from "@/components/StatCard";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import Link from "next/link";

const formatIST = (d: Date) =>
  new Intl.DateTimeFormat("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  }).format(d);

const formatTimeIST = (d: Date) =>
  new Intl.DateTimeFormat("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Kolkata",
    hour12: true,
  }).format(d);

const Home = () => {
  const { user } = useAuth();
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    document.title = "Dashboard · Verdant";
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);

  const greeting = useMemo(() => {
    const h = Number(
      new Intl.DateTimeFormat("en-GB", {
        hour: "2-digit",
        hour12: false,
        timeZone: "Asia/Kolkata",
      }).format(now),
    );
    if (h < 12) return "Good morning";
    if (h < 17) return "Good afternoon";
    return "Good evening";
  }, [now]);

  const name = user?.email?.split("@")[0] ?? "friend";

  const shortcuts = [
    {
      to: "/events",
      label: "Events",
      icon: Calendar,
      desc: "Plan and track upcoming moments",
    },
    {
      to: "/goals",
      label: "Goals",
      icon: Target,
      desc: "Make steady progress every week",
    },
    {
      to: "/expenses",
      label: "Expenses",
      icon: Wallet,
      desc: "Know where your money flows",
    },
    {
      to: "/investments",
      label: "Investments",
      icon: TrendingUp,
      desc: "Watch your portfolio grow",
    },
    {
      to: "/movies",
      label: "Movies",
      icon: Film,
      desc: "Your watched library, curated",
    },
  ];

  return (
    <>
      {/* Hero */}
      <section className="relative mb-10 overflow-hidden rounded-2xl border border-border/60 bg-hero-gradient p-8 md:p-12 shadow-soft">
        <div className="absolute -top-20 -right-20 h-64 w-64 rounded-full bg-primary/15 blur-3xl" />
        <div className="absolute -bottom-20 -left-20 h-64 w-64 rounded-full bg-primary-glow/15 blur-3xl" />
        <div className="relative">
          <p className="text-prefix mb-3 flex items-center gap-2">
            <Sparkles className="h-3.5 w-3.5" /> {formatIST(now)} ·{" "}
            {formatTimeIST(now)} IST
          </p>
          <h1 className="text-display max-w-3xl">
            {greeting},{" "}
            <span className="bg-gradient-to-r from-primary to-primary-glow bg-clip-text text-transparent">
              {name}
            </span>
            .
          </h1>
          <p className="text-body mt-3 max-w-xl">
            A calm, focused view of your life — events, goals, money and the
            stories you watch. All in one place.
          </p>
        </div>
      </section>

      {/* Stats */}
      <section className="mb-10">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            icon={Calendar}
            label="Upcoming events"
            value="0"
            hint="this month"
          />
          <StatCard
            icon={Wallet}
            label="Monthly expense"
            value="₹0"
            hint="vs last month"
            accent="↘ 0%"
          />
          <StatCard
            icon={TrendingUp}
            label="Portfolio"
            value="₹0"
            hint="all-time return"
            accent="+0%"
          />
          <StatCard
            icon={Film}
            label="Movies watched"
            value="0"
            hint="this year"
          />
        </div>
      </section>

      {/* Shortcuts */}
      <section>
        <div className="mb-4 flex items-end justify-between">
          <div>
            <p className="text-prefix mb-1">Explore</p>
            <h2 className="text-h2">Jump back in</h2>
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {shortcuts.map(({ to, label, icon: Icon, desc }) => (
            <Link key={to} href={to} className="group">
              <Card className="h-full border-border/60 transition-all group-hover:-translate-y-0.5 group-hover:shadow-soft">
                <CardContent className="flex h-full items-start justify-between gap-4 p-5">
                  <div className="space-y-2">
                    <span className="grid h-10 w-10 place-items-center rounded-lg bg-accent text-accent-foreground">
                      <Icon className="h-5 w-5" />
                    </span>
                    <h3 className="text-h3">{label}</h3>
                    <p className="text-body">{desc}</p>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-1" />
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </section>
    </>
  );
};

export default Home;
