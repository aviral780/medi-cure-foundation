import { Link } from "@tanstack/react-router";
import { Calendar, Home, Stethoscope, User } from "lucide-react";
import type { ReactNode } from "react";

interface AppShellProps {
  children: ReactNode;
}

const navItems = [
  { to: "/", label: "Home", icon: Home },
  { label: "Doctors", icon: Stethoscope },
  { label: "Visits", icon: Calendar },
  { to: "/account", label: "Account", icon: User },
] as const;

export function AppShell({ children }: AppShellProps) {
  return (
    <div className="min-h-[100dvh] bg-background text-foreground flex flex-col">
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link to="/" className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-xl bg-primary text-primary-foreground shadow-[var(--shadow-soft)]">
              <Stethoscope className="h-4 w-4" aria-hidden />
            </span>
            <span className="text-base font-semibold tracking-tight">MediCure</span>
          </Link>
          <nav className="hidden items-center gap-1 sm:flex">
            {navItems.map((item) => (
              "to" in item ? (
                <Link
                  key={item.label}
                  to={item.to}
                  className="rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  activeProps={{ className: "rounded-lg px-3 py-2 text-sm font-medium text-foreground bg-muted" }}
                  activeOptions={{ exact: item.to === "/" }}
                >
                  {item.label}
                </Link>
              ) : (
                <span key={item.label} className="rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground/70">
                  {item.label}
                </span>
              )
            ))}
          </nav>
        </div>
      </header>

      <main className="flex-1 pb-24 sm:pb-8">{children}</main>

      <nav
        className="fixed inset-x-0 bottom-0 z-40 border-t border-border/60 bg-background/95 backdrop-blur sm:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        aria-label="Primary"
      >
        <ul className="mx-auto grid max-w-md grid-cols-4">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <li key={item.label}>
                {"to" in item ? (
                  <Link
                    to={item.to}
                    className="flex min-h-14 flex-col items-center justify-center gap-1 py-2 text-xs font-medium text-muted-foreground"
                    activeProps={{ className: "flex min-h-14 flex-col items-center justify-center gap-1 py-2 text-xs font-semibold text-primary" }}
                    activeOptions={{ exact: item.to === "/" }}
                  >
                    <Icon className="h-5 w-5" aria-hidden />
                    {item.label}
                  </Link>
                ) : (
                  <span className="flex min-h-14 flex-col items-center justify-center gap-1 py-2 text-xs font-medium text-muted-foreground/70">
                    <Icon className="h-5 w-5" aria-hidden />
                    {item.label}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}