(() => {
  const ready = Boolean(window.PBP_SUPABASE_URL && window.PBP_SUPABASE_ANON_KEY && window.supabase?.createClient);
  window.pbpSupabaseReady = ready;
  window.pbpSupabase = ready
    ? window.supabase.createClient(window.PBP_SUPABASE_URL, window.PBP_SUPABASE_ANON_KEY, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
      })
    : null;
})();
