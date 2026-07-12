import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Clock, MapPin, Video } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import {
  fetchConsultationTypes,
  fetchDoctorById,
  formatFee,
  formatMode,
  type ConsultationType,
} from "@/lib/booking-queries";
import { Avatar } from "./doctors.index";

export const Route = createFileRoute("/doctors/$doctorId/")({
  component: DoctorDetailsPage,
});

function DoctorDetailsPage() {
  const { doctorId } = Route.useParams();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();

  const doctorQ = useQuery({
    queryKey: ["doctor", doctorId],
    queryFn: () => fetchDoctorById(doctorId),
  });
  const typesQ = useQuery({
    queryKey: ["consultation-types", doctorId],
    queryFn: () => fetchConsultationTypes(doctorId),
    enabled: !!doctorQ.data,
  });

  function onBook() {
    if (authLoading) return;
    if (!user) {
      navigate({ to: "/auth" });
      return;
    }
    navigate({ to: "/doctors/$doctorId/book", params: { doctorId } });
  }

  function onPickConsultation(consultationTypeId: string) {
    if (authLoading) return;
    if (!user) {
      navigate({ to: "/auth" });
      return;
    }
    navigate({
      to: "/doctors/$doctorId/book",
      params: { doctorId },
      search: { consultationTypeId },
    });
  }

  return (
    <AppShell>
      <section className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-10">
        {doctorQ.isLoading && <div className="mt-6 h-40 animate-pulse rounded-2xl bg-muted" />}
        {doctorQ.error && (
          <ErrorBox>We couldn't load this doctor's profile.</ErrorBox>
        )}
        {!doctorQ.isLoading && !doctorQ.error && !doctorQ.data && (
          <ErrorBox>This doctor could not be found.</ErrorBox>
        )}

        {doctorQ.data && (
          <>
            <div className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-soft)] sm:p-8">
              <div className="flex items-start gap-4 sm:gap-6">
                <Avatar name={doctorQ.data.full_name} url={doctorQ.data.profile_image_url} size={80} />
                <div className="min-w-0 flex-1">
                  <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
                    {doctorQ.data.full_name}
                  </h1>
                  <p className="mt-1 text-sm font-medium text-primary">{doctorQ.data.specialization}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {[
                      doctorQ.data.qualifications,
                      doctorQ.data.experience_years ? `${doctorQ.data.experience_years} yrs experience` : null,
                    ]
                      .filter(Boolean)
                      .join(" • ")}
                  </p>
                </div>
              </div>
              {doctorQ.data.bio && (
                <p className="mt-6 text-sm leading-relaxed text-muted-foreground">{doctorQ.data.bio}</p>
              )}
            </div>

            <div className="mt-8">
              <h2 className="text-lg font-semibold tracking-tight text-foreground">Consultation options</h2>
              <p className="mt-1 text-sm text-muted-foreground">Choose how you'd like to meet.</p>

              {typesQ.isLoading && <div className="mt-4 h-24 animate-pulse rounded-2xl bg-muted" />}
              {typesQ.error && <ErrorBox>Couldn't load consultation options.</ErrorBox>}
              {typesQ.data && typesQ.data.length === 0 && (
                <div className="mt-4 rounded-2xl border border-dashed border-border bg-card p-6 text-sm text-muted-foreground">
                  This doctor has no active consultation options right now.
                </div>
              )}

              <ul className="mt-4 grid gap-3 sm:grid-cols-2">
                {(typesQ.data ?? []).map((t) => (
                  <ConsultationCard key={t.id} type={t} onSelect={() => onPickConsultation(t.id)} />
                ))}
              </ul>
            </div>

            <div className="sticky bottom-20 z-30 mt-8 sm:static sm:bottom-auto">
              <Button
                onClick={onBook}
                disabled={!typesQ.data || typesQ.data.length === 0}
                className="h-12 w-full rounded-xl text-base"
              >
                Book consultation
              </Button>
            </div>
          </>
        )}
      </section>
    </AppShell>
  );
}

function ConsultationCard({ type, onSelect }: { type: ConsultationType; onSelect: () => void }) {
  const Icon = type.mode === "online" ? Video : MapPin;
  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        className="w-full rounded-2xl border border-border bg-card p-4 text-left transition-all hover:border-primary/50 hover:shadow-[var(--shadow-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
      >
        <div className="flex items-center gap-2 text-primary">
          <Icon className="h-4 w-4" aria-hidden />
          <span className="text-xs font-semibold uppercase tracking-wide">{formatMode(type.mode)}</span>
        </div>
        <p className="mt-2 text-base font-semibold text-foreground">{type.name}</p>
        <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
          <Clock className="h-3.5 w-3.5" aria-hidden /> {type.duration_minutes} min
        </p>
        <p className="mt-3 text-lg font-semibold text-foreground">{formatFee(type.fee, type.currency)}</p>
      </button>
    </li>
  );
}

function ErrorBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-6 rounded-2xl border border-destructive/30 bg-destructive/5 p-5 text-sm text-destructive">
      {children}
    </div>
  );
}