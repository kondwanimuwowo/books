-- Trigram matching for misspelt titles and authors ("eccentric thots"). Supabase keeps extensions in their own schema.
CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions;
