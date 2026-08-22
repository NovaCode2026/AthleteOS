insert into storage.buckets (id, name, public)
values
  ('profile-images', 'profile-images', false),
  ('medal-images', 'medal-images', false),
  ('certificates', 'certificates', false),
  ('documents', 'documents', false),
  ('verification-proofs', 'verification-proofs', false),
  ('academy-media', 'academy-media', false)
on conflict (id) do update set public = excluded.public;

drop policy if exists "Users can upload own profile images" on storage.objects;
create policy "Users can upload own profile images"
on storage.objects for insert
with check (bucket_id = 'profile-images' and auth.uid()::text = (storage.foldername(name))[1]);

drop policy if exists "Users can read own profile images" on storage.objects;
create policy "Users can read own profile images"
on storage.objects for select
using (bucket_id = 'profile-images' and auth.uid()::text = (storage.foldername(name))[1]);

drop policy if exists "Users can manage own medal images" on storage.objects;
create policy "Users can manage own medal images"
on storage.objects for all
using (bucket_id = 'medal-images' and auth.uid()::text = (storage.foldername(name))[1])
with check (bucket_id = 'medal-images' and auth.uid()::text = (storage.foldername(name))[1]);

drop policy if exists "Users can manage own certificates" on storage.objects;
create policy "Users can manage own certificates"
on storage.objects for all
using (bucket_id = 'certificates' and auth.uid()::text = (storage.foldername(name))[1])
with check (bucket_id = 'certificates' and auth.uid()::text = (storage.foldername(name))[1]);

drop policy if exists "Users can manage own documents" on storage.objects;
create policy "Users can manage own documents"
on storage.objects for all
using (bucket_id = 'documents' and auth.uid()::text = (storage.foldername(name))[1])
with check (bucket_id = 'documents' and auth.uid()::text = (storage.foldername(name))[1]);

drop policy if exists "Users can manage own verification proofs" on storage.objects;
create policy "Users can manage own verification proofs"
on storage.objects for all
using (bucket_id = 'verification-proofs' and auth.uid()::text = (storage.foldername(name))[1])
with check (bucket_id = 'verification-proofs' and auth.uid()::text = (storage.foldername(name))[1]);

drop policy if exists "Users can manage own academy media" on storage.objects;
create policy "Users can manage own academy media"
on storage.objects for all
using (bucket_id = 'academy-media' and auth.uid()::text = (storage.foldername(name))[1])
with check (bucket_id = 'academy-media' and auth.uid()::text = (storage.foldername(name))[1]);
