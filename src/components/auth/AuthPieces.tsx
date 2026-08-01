import { useState, type ReactNode } from "react";
import { Eye, EyeOff, HeartPulse, Loader2, Phone } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { DEFAULT_CLINIC } from "@/lib/clinic-constants";
import { cn } from "@/lib/utils";

export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4 py-10 sm:py-14">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-32 left-1/2 h-80 w-[38rem] -translate-x-1/2 rounded-full bg-primary/10 blur-3xl"
      />
      <div className="relative w-full max-w-md animate-in fade-in slide-in-from-bottom-3 duration-500">
        <div className="flex flex-col items-center text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary shadow-sm">
            <HeartPulse className="h-7 w-7" aria-hidden />
          </span>
          <p className="mt-3 text-sm font-semibold tracking-tight text-foreground">
            {DEFAULT_CLINIC.name}
          </p>
        </div>

        <div className="mt-6 rounded-3xl border border-border/70 bg-card p-6 shadow-[var(--shadow-soft)] sm:p-8">
          <h1 className="text-center text-2xl font-semibold tracking-tight text-foreground">{title}</h1>
          <p className="mt-2 text-center text-sm leading-6 text-muted-foreground">{subtitle}</p>
          <div className="mt-6">{children}</div>
        </div>

        {footer ? <div className="mt-6 text-center text-sm text-muted-foreground">{footer}</div> : null}
      </div>
    </main>
  );
}

export function AuthDivider({ label = "OR" }: { label?: string }) {
  return (
    <div className="my-6 flex items-center gap-3">
      <span className="h-px flex-1 bg-border" />
      <span className="text-xs font-medium uppercase tracking-widest text-muted-foreground">{label}</span>
      <span className="h-px flex-1 bg-border" />
    </div>
  );
}

function GoogleGlyph() {
  return (
    <svg viewBox="0 0 48 48" className="h-5 w-5" aria-hidden focusable="false">
      <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.6l6.7-6.7C35.6 2.6 30.2.5 24 .5 14.6.5 6.5 5.9 2.6 13.8l7.8 6.1C12.3 13.9 17.6 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.2-.4-4.7H24v9h12.7c-.6 3-2.3 5.5-4.9 7.2l7.6 5.9c4.4-4.1 7.1-10.2 7.1-17.4z" />
      <path fill="#FBBC05" d="M10.4 28.1a14.6 14.6 0 0 1 0-8.2l-7.8-6.1a24 24 0 0 0 0 20.4l7.8-6.1z" />
      <path fill="#34A853" d="M24 47.5c6.2 0 11.5-2 15.4-5.6l-7.6-5.9c-2.1 1.4-4.8 2.3-7.8 2.3-6.4 0-11.7-4.4-13.6-10.3l-7.8 6.1C6.5 42.1 14.6 47.5 24 47.5z" />
    </svg>
  );
}

export function SocialAuthButtons({
  onGoogle,
  onPhone,
  googleLoading,
  disabled,
}: {
  onGoogle: () => void;
  onPhone: () => void;
  googleLoading?: boolean;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-3">
      <Button
        type="button"
        variant="outline"
        onClick={onGoogle}
        disabled={disabled || googleLoading}
        className="h-12 w-full rounded-xl border-border bg-background text-base font-medium shadow-sm transition-all hover:bg-accent hover:shadow-md"
      >
        {googleLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <GoogleGlyph />}
        <span className="ml-1">Continue with Google</span>
      </Button>
      <Button
        type="button"
        variant="outline"
        onClick={onPhone}
        disabled={disabled}
        className="h-12 w-full rounded-xl border-border bg-background text-base font-medium shadow-sm transition-all hover:bg-accent hover:shadow-md"
      >
        <Phone className="h-5 w-5 text-primary" aria-hidden />
        <span className="ml-1">Continue with Phone Number</span>
      </Button>
    </div>
  );
}

export function PasswordField({
  id,
  label,
  value,
  onChange,
  autoComplete,
  placeholder,
  hint,
  className,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete?: string;
  placeholder?: string;
  hint?: ReactNode;
  className?: string;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Input
          id={id}
          type={visible ? "text" : "password"}
          value={value}
          autoComplete={autoComplete}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          className="h-11 rounded-xl pr-11"
          required
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? "Hide password" : "Show password"}
          className="absolute right-1 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
      {hint}
    </div>
  );
}