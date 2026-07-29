-- E-Prescription module: one prescription per appointment.
-- Requires public.is_active_admin() from docs/admin-authorization-alignment.sql

create table if not exists public.prescriptions (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null unique references public.appointments(id) on delete cascade,
  patient_id uuid,
  doctor_id uuid,
  chief_complaint text,
  diagnosis text,
  medicines jsonb not null default '[]'::jsonb,
  investigations text,
  advice text,
  follow_up_date date,
  additional_notes text,
  status text not null default 'draft' check (status in ('draft', 'published')),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

grant select, insert, update, delete on public.prescriptions to authenticated;
grant all on public.prescriptions to service_role;

alter table public.prescriptions enable row level security;

-- Patients may read their own published prescriptions.
drop policy if exists "Patients can view own published prescriptions" on public.prescriptions;
create policy "Patients can view own published prescriptions"
  on public.prescriptions for select to authenticated
  using (status = 'published' and patient_id = auth.uid());

-- Admins can read and manage every prescription.
drop policy if exists "Admins can view prescriptions" on public.prescriptions;
create policy "Admins can view prescriptions"
  on public.prescriptions for select to authenticated
  using (public.is_active_admin());

drop policy if exists "Admins can insert prescriptions" on public.prescriptions;
create policy "Admins can insert prescriptions"
  on public.prescriptions for insert to authenticated
  with check (public.is_active_admin());

drop policy if exists "Admins can update prescriptions" on public.prescriptions;
create policy "Admins can update prescriptions"
  on public.prescriptions for update to authenticated
  using (public.is_active_admin())
  with check (public.is_active_admin());

drop policy if exists "Admins can delete prescriptions" on public.prescriptions;
create policy "Admins can delete prescriptions"
  on public.prescriptions for delete to authenticated
  using (public.is_active_admin());

create index if not exists prescriptions_patient_id_idx on public.prescriptions(patient_id);

create or replace function public.set_prescription_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  if new.status = 'published' and new.published_at is null then
    new.published_at = now();
  end if;
  return new;
end;
$$;

drop trigger if exists prescriptions_set_updated_at on public.prescriptions;
create trigger prescriptions_set_updated_at
  before update on public.prescriptions
  for each row execute function public.set_prescription_updated_at();
