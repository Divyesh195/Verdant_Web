import { Github, Instagram, Linkedin, Leaf } from "lucide-react";

const socialLinks = [
  { label: "GitHub", href: "#", icon: Github },
  { label: "Instagram", href: "#", icon: Instagram },
  { label: "LinkedIn", href: "#", icon: Linkedin },
];

const footerLinks = [
  { label: "Events", href: "/auth" },
  { label: "Goals", href: "/auth" },
  { label: "Expenses", href: "/auth" },
  { label: "Investments", href: "/auth" },
  { label: "Movies", href: "/auth" },
];

export const Footer = () => (
  <footer className="border-t border-border/60 bg-secondary/30">
    <div className="mx-auto max-w-site px-4 py-12 md:px-6">
      <div className="grid gap-10 md:grid-cols-3">
        {/* Brand & about */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary-gradient shadow-glow">
              <Leaf className="h-4 w-4 text-primary-foreground" />
            </span>
            <span className="font-display text-base font-bold tracking-tight">Verdant</span>
          </div>
          <p className="text-body max-w-xs">
            A personal life dashboard for tracking events, goals, expenses, investments and the movies you love.
          </p>
        </div>

        {/* Quick links */}
        <div>
          <h4 className="text-h3 mb-4">Features</h4>
          <ul className="grid gap-2">
            {footerLinks.map(({ label, href }) => (
              <li key={label}>
                <a href={href} className="text-body transition-colors hover:text-foreground">
                  {label}
                </a>
              </li>
            ))}
          </ul>
        </div>

        {/* Social */}
        <div>
          <h4 className="text-h3 mb-4">Connect</h4>
          <div className="flex items-center gap-3">
            {socialLinks.map(({ label, href, icon: Icon }) => (
              <a
                key={label}
                href={href}
                aria-label={label}
                className="grid h-10 w-10 place-items-center rounded-lg border border-border/60 bg-card text-muted-foreground transition-all hover:-translate-y-0.5 hover:text-foreground hover:shadow-soft"
              >
                <Icon className="h-4 w-4" />
              </a>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-10 flex flex-col items-center justify-between gap-3 border-t border-border/60 pt-6 text-sm text-muted-foreground md:flex-row">
        <p>Developed by Divyesh Parmar</p>
        <p>© {new Date().getFullYear()} Verdant. All rights reserved.</p>
      </div>
    </div>
  </footer>
);
