-- Patient medical documents linked to appointments.
-- Requires public.is_active_admin() from docs/admin-authorization-alignment.sql

-- 1. Private storage bucket ------------------------------------------------
insert into storage.buckets (id, name, public)
values ('medical-documents', 'medical-documents', false)
on conflict (id) do nothing;

-- 2. Table ------------------------------------------------------------------
create table if not exists public.medical_documents (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null references public.appointments(id) on delete cascade,
  patient_id uuid not null,
  file_name text not null,
  storage_path text not null unique,
  file_type text not null,
  file_size bigint not null,
  uploaded_at timestamptz not null default now()
);

grant select, insert, delete on public.medical_documents to authenticated;
grant all on public.medical_documents to service_role;

alter table public.medical_documents enable row level security;

drop policy if exists "Patients can view own documents" on public.medical_documents;
create policy "Patients can view own documents"
  on public.medical_documents for select to authenticated
  using (patient_id = auth.uid());

drop policy if exists "Patients can upload own documents" on public.medical_documents;
create policy "Patients can upload own documents"
  on public.medical_documents for insert to authenticated
  with check (
    patient_id = auth.uid()
    and exists (
      select 1 from public.appointments a
      where a.id = appointment_id and a.patient_id = auth.uid()
    )
  );

drop policy if exists "Patients can delete own documents" on public.medical_documents;
create policy "Patients can delete own documents"
  on public.medical_documents for delete to authenticated
  using (patient_id = auth.uid());

drop policy if exists "Admins can view all documents" on public.medical_documents;
create policy "Admins can view all documents"
  on public.medical_documents for select to authenticated
  using (public.is_active_admin());

drop policy if exists "Admins can delete documents" on public.medical_documents;
create policy "Admins can delete documents"
  on public.medical_documents for delete to authenticated
  using (public.is_active_admin());

create index if not exists medical_documents_appointment_idx
  on public.medical_documents(appointment_id);
create index if not exists medical_documents_patient_idx
  on public.medical_documents(patient_id);

-- 3. Storage object policies -------------------------------------------------
-- Object paths are `<patient_id>/<appointment_id>/<file>`.
drop policy if exists "Patients manage own medical files" on storage.objects;
create policy "Patients manage own medical files"
  on storage.objects for all to authenticated
  using (
    bucket_id = 'medical-documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'medical-documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Admins read medical files" on storage.objects;
create policy "Admins read medical files"
  on storage.objects for select to authenticated
  using (bucket_id = 'medical-documents' and public.is_active_admin());

drop policy if exists "Admins delete medical files" on storage.objects;
create policy "Admins delete medical files"
  on storage.objects for delete to authenticated
  using (bucket_id = 'medical-documents' and public.is_active_admin());