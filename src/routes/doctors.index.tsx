import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { z } from "zod";
import { Stethoscope } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import {
  fetchActiveDoctors,
  fetchConsultationTypes,
  initialsOf,
} from "@/lib/booking-queries";

const searchSchema = z.object({
  mode: z.enum(["online", "in_person"]).optional(),
});

export const Route = createFileRoute("/doctors/")({
  head: () => ({
    meta: [
      { title: "Book a consultation — MediCure" },
      { name: "description", content: "Book an in-person or secure video consultation with our clinic's doctor on MediCure." },
    ],
  }),
  validateSearch: (raw): z.infer<typeof searchSchema> => searchSchema.parse(raw),
  component: DoctorsPage,
});

function DoctorsPage() {
  const navigate = useNavigate();
  const { mode } = Route.useSearch();
  const { data, isLoading, error } = useQuery({
    queryKey: ["doctors", "active"],
    queryFn: fetchActiveDoctors,
  });
  const doctor = data?.[0] ?? null;

  // Preload consultation types when we may need to preselect one.
  const typesQ = useQuery({
    queryKey: ["consultation-types", doctor?.id],
    enabled: !!doctor?.id && !!mode,
    queryFn: () => fetchConsultationTypes(doctor!.id),
  });

  useEffect(() => {
    if (!doctor) return;
    if (mode) {
      if (!typesQ.data) return;
      const match = typesQ.data.find((t) => t.mode === mode);
      if (match) {
        navigate({
          to: "/doctors/$doctorId/book",
          params: { doctorId: doctor.id },
          search: { consultationTypeId: match.id },
          replace: true,
        });
        return;
      }
    }
    navigate({
      to: "/doctors/$doctorId",
      params: { doctorId: doctor.id },
      replace: true,
    });
  }, [doctor, mode, typesQ.data, navigate]);

  return (
    <AppShell>
      <section className="mx-auto flex min-h-[60vh] max-w-md items-center justify-center px-4 py-16 sm:px-6">
        {isLoading && (
          <div className="flex flex-col items-center text-muted-foreground">
            <span className="grid h-12 w-12 place-items-center rounded-full bg-primary-soft text-primary">
              <Stethoscope className="h-5 w-5 animate-pulse" aria-hidden />
            </span>
            <p className="mt-3 text-sm">Loading consultation…</p>
          </div>
        )}
        {error && (
          <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-5 text-sm text-destructive">
            We couldn't reach the clinic right now. Please try again shortly.
          </div>
        )}
        {!isLoading && !error && !doctor && (
          <div className="rounded-2xl border border-dashed border-border bg-card p-8 text-center">
            <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-muted text-muted-foreground">
              <Stethoscope className="h-5 w-5" aria-hidden />
            </div>
            <h2 className="mt-3 text-base font-semibold text-foreground">Clinic unavailable</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Our clinic is not accepting bookings right now. Please check back soon.
            </p>
            <Link to="/" className="mt-4 inline-block text-sm font-medium text-primary hover:underline">
              Back to home
            </Link>
          </div>
        )}
      </section>
    </AppShell>
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
