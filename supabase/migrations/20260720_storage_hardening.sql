-- ============================================================
-- EveryWhere — hardening bucket Storage (Step 3b)
-- Vincoli LATO SERVER su tipo e dimensione dei file: valgono
-- anche per chi bypassa la validazione client (API dirette).
-- Il client carica JPEG <= ~300KB; 5MB è il tetto di sicurezza.
-- ============================================================

update storage.buckets
set file_size_limit = 5242880, -- 5 MB
    allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp']
where id = 'avatars';

update storage.buckets
set file_size_limit = 10485760, -- 10 MB
    allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp']
where id = 'memories';
