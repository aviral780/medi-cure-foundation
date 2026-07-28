-- Doctor module: let active admins manage the doctors table.
-- Requires public.is_active_admin() from docs/admin-authorization-alignment.sql

alter table public.doctors enable row level security;

drop policy if exists "Admins can insert doctors" on public.doctors;
create policy "Admins can insert doctors"
  on public.doctors for insert to authenticated
  with check (public.is_active_admin());

drop policy if exists "Admins can update doctors" on public.doctors;
create policy "Admins can update doctors"
  on public.doctors for update to authenticated
  using (public.is_active_admin())
  with check (public.is_active_admin());

drop policy if exists "Admins can delete doctors" on public.doctors;
create policy "Admins can delete doctors"
  on public.doctors for delete to authenticated
  using (public.is_active_admin());

-- One-off: replace the remaining demo doctor record with the real clinic doctor.
update public.doctors
set full_name        = 'Dr. Mahaveer Jain',
    specialization   = 'Pediatrician',
    qualifications   = 'MBBS, MD (Pediatrics)',
    experience_years = 40,
    bio              = 'Veteran pediatrician with 40+ years of experience, providing comprehensive care for infants, children and adolescents.'
where full_name ilike '%Arjun Mehta%';