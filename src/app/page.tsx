"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Calendar, Target, Wallet, TrendingUp, Film, ArrowRight, CheckCircle, Sparkles } from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";

const features = [
  {
    icon: Calendar,
    title: "Events",
    description: "Track upcoming events, birthdays and meetings — all in your timezone.",
  },
  {
    icon: Target,
    title: "Goals",
    description: "Set personal goals, break them into milestones and make steady progress every week.",
  },
  {
    icon: Wallet,
    title: "Expenses",
    description: "Log spends, categorize them and understand your monthly money patterns.",
  },
  {
    icon: TrendingUp,
    title: "Investments",
    description: "Track stocks, mutual funds and overall portfolio performance in one place.",
  },
  {
    icon: Film,
    title: "Movies",
    description: "A personal library of everything you've watched, with notes and ratings.",
  },
];

const highlights = [
  "Clean, green-themed dashboard",
  "Light & dark mode support",
  "Secure email + password auth",
  "Mobile-friendly responsive design",
];

const Landing = () => {
  const router = useRouter();
  const { user, loading } = useAuth();

  useEffect(() => {
    document.title = "Verdant · Your personal life dashboard";
  }, []);

  useEffect(() => {
    if (!loading && user) {
      router.replace("/home");
    }
  }, [loading, router, user]);

  if (loading || user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <main>
        {/* Hero */}
        <section className="relative overflow-hidden border-b border-border/60">
          <div className="absolute inset-0 bg-hero-gradient" />
          <div className="absolute -top-32 -right-32 h-96 w-96 rounded-full bg-primary/15 blur-3xl" />
          <div className="absolute -bottom-32 -left-32 h-96 w-96 rounded-full bg-primary-glow/15 blur-3xl" />

          <div className="relative mx-auto max-w-site px-4 py-20 md:px-6 md:py-28">
            <div className="mx-auto max-w-3xl text-center">
              <p className="text-prefix mb-4 flex items-center justify-center gap-2">
                <Sparkles className="h-3.5 w-3.5" /> Personal life dashboard
              </p>
              <h1 className="text-display">
                Everything that matters,{" "}
                <span className="bg-gradient-to-r from-primary to-primary-glow bg-clip-text text-transparent">
                  in one place
                </span>
              </h1>
              <p className="text-body mx-auto mt-5 max-w-xl text-base">
                Verdant brings together your events, goals, expenses, investments and watched movies into a calm, focused dashboard.
              </p>
              <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
                <Button asChild className="bg-primary-gradient px-6 hover:opacity-90">
                  <Link href="/auth">Get Started</Link>
                </Button>
                <Button asChild variant="outline">
                  <Link href="/auth">Sign In</Link>
                </Button>
              </div>
            </div>
          </div>
        </section>

        {/* Features */}
        <section className="mx-auto max-w-site px-4 py-16 md:px-6 md:py-20">
          <div className="mb-10 text-center">
            <p className="text-prefix mb-2">Features</p>
            <h2 className="text-h2">All your life tools, connected</h2>
            <p className="text-body mx-auto mt-3 max-w-xl">
              Five simple modules designed to help you stay organized, save smarter and remember the moments that matter.
            </p>
          </div>

          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {features.map(({ icon: Icon, title, description }) => (
              <Card key={title} className="group border-border/60 transition-all hover:-translate-y-0.5 hover:shadow-soft">
                <CardContent className="flex h-full flex-col p-6">
                  <span className="grid h-11 w-11 place-items-center rounded-xl bg-accent text-accent-foreground">
                    <Icon className="h-5 w-5" />
                  </span>
                  <h3 className="text-h3 mt-4">{title}</h3>
                  <p className="text-body mt-2 flex-1">{description}</p>
                  <Link
                    href="/auth"
                    className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-primary transition-colors group-hover:underline"
                  >
                    Get started <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* Highlights */}
        <section className="border-y border-border/60 bg-secondary/30">
          <div className="mx-auto max-w-site px-4 py-16 md:px-6 md:py-20">
            <div className="grid items-center gap-10 md:grid-cols-2">
              <div>
                <p className="text-prefix mb-2">Why Verdant</p>
                <h2 className="text-h2">Designed for clarity</h2>
                <p className="text-body mt-3 max-w-md">
                  No clutter, no noise. Just a calm green interface that adapts to your schedule, your money and your goals.
                </p>
              </div>
              <ul className="grid gap-3">
                {highlights.map((item) => (
                  <li key={item} className="flex items-center gap-3 rounded-lg bg-card p-4 shadow-soft">
                    <CheckCircle className="h-5 w-5 shrink-0 text-primary" />
                    <span className="text-sm font-medium">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="mx-auto max-w-site px-4 py-16 text-center md:px-6 md:py-20">
          <h2 className="text-h2">Ready to get organized?</h2>
          <p className="text-body mx-auto mt-3 max-w-md">
            Create your account and start building your personal dashboard in seconds.
          </p>
          <Button asChild className="mt-6 bg-primary-gradient px-6 hover:opacity-90">
            <Link href="/auth">Create Account</Link>
          </Button>
        </section>
      </main>

      <Footer />
    </div>
  );
};

export default Landing;
