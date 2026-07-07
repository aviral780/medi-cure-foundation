import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Search, Stethoscope, ChevronRight } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { fetchActiveDoctors, initialsOf, type Doctor } from "@/lib/booking-queries";

export const Route = createFileRoute("/doctors")({
  head: () => ({
    meta: [
      { title: "Find a doctor — MediCure" },
      { name: "description", content: "Discover verified doctors and book in-person or video consultations on MediCure." },
    ],
  }),
  component: DoctorsPage,
});

function DoctorsPage() {
  const { data, isLoading, error } = useQuery({ queryKey: ["doctors", "active"], queryFn: fetchActiveDoctors });
  const [q, setQ] = useState("");
  const [specialty, setSpecialty] = useState<string>("all");

  const specialties = useMemo(() => {
    const set = new Set<string>();
    (data ?? []).forEach((d) => d.specialization && set.add(d.specialization));
    return Array.from(set).sort();
  }, [data]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return (data ?? []).filter((d) => {
      if (specialty !== "all" && d.specialization !== specialty) return false;
      if (!term) return true;
      return (
        d.full_name.toLowerCase().includes(term) ||
        (d.specialization ?? "").toLowerCase().includes(term)
      );
    });
  }, [data, q, specialty]);

  return (
    <AppShell>
      <section className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
        <div className="mb-6">
          <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">Find your doctor</h1>
          <p className="mt-2 text-sm text-muted-foreground sm:text-base">
            Browse verified specialists and book an in-person or video visit that fits your schedule.
          </p>
        </div>

        <div className="mb-5 space-y-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search by name or specialty"
              className="h-11 rounded-xl pl-9"
              aria-label="Search doctors"
            />
          </div>
          {specialties.length > 1 && (
            <div className="-mx-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0">
              <FilterChip active={specialty === "all"} onClick={() => setSpecialty("all")}>All</FilterChip>
              {specialties.map((s) => (
                <FilterChip key={s} active={specialty === s} onClick={() => setSpecialty(s)}>{s}</FilterChip>
              ))}
            </div>
          )}
        </div>

        {isLoading && <ListSkeleton />}
        {error && (
          <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-5 text-sm text-destructive">
            We couldn't load doctors right now. Please try again shortly.
          </div>
        )}
        {!isLoading && !error && filtered.length === 0 && (
          <div className="rounded-2xl border border-dashed border-border bg-card p-8 text-center">
            <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-muted text-muted-foreground">
              <Stethoscope className="h-5 w-5" aria-hidden />
            </div>
            <h2 className="mt-3 text-base font-semibold text-foreground">No doctors found</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {data && data.length === 0 ? "No doctors are currently available." : "Try a different search or filter."}
            </p>
          </div>
        )}

        <ul className="space-y-3">
          {filtered.map((d) => <DoctorCard key={d.id} doctor={d} />)}
        </ul>
      </section>
    </AppShell>
  );
}

function FilterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`whitespace-nowrap rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors ${
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-card text-muted-foreground hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}

function DoctorCard({ doctor }: { doctor: Doctor }) {
  return (
    <li>
      <Link
        to="/doctors/$doctorId"
        params={{ doctorId: doctor.id }}
        className="flex items-center gap-4 rounded-2xl border border-border bg-card p-4 shadow-[var(--shadow-soft)] transition-shadow hover:shadow-[var(--shadow-elevated)]"
      >
        <Avatar name={doctor.full_name} url={doctor.profile_image_url} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-semibold text-foreground">{doctor.full_name}</p>
          <p className="truncate text-sm text-primary">{doctor.specialization}</p>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {[doctor.qualifications, doctor.experience_years ? `${doctor.experience_years} yrs exp.` : null]
              .filter(Boolean)
              .join(" • ")}
          </p>
        </div>
        <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
      </Link>
    </li>
  );
}

export function Avatar({ name, url, size = 56 }: { name: string; url: string | null; size?: number }) {
  if (url) {
    return (
      <img
        src={url}
        alt={name}
        className="shrink-0 rounded-full object-cover"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <div
      className="grid shrink-0 place-items-center rounded-full bg-primary-soft text-primary"
      style={{ width: size, height: size }}
      aria-hidden
    >
      <span className="text-base font-semibold">{initialsOf(name)}</span>
    </div>
  );
}

function ListSkeleton() {
  return (
    <ul className="space-y-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <li key={i} className="flex items-center gap-4 rounded-2xl border border-border bg-card p-4">
          <div className="h-14 w-14 shrink-0 animate-pulse rounded-full bg-muted" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-1/2 animate-pulse rounded bg-muted" />
            <div className="h-3 w-1/3 animate-pulse rounded bg-muted" />
            <div className="h-3 w-2/3 animate-pulse rounded bg-muted" />
          </div>
        </li>
      ))}
    </ul>
  );
}

// Unused Button import kept out to avoid TS noise
void Button;