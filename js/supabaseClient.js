const { createClient } = supabase;

const SUPABASE_URL = 'https://tlldtaepbhvrpcmfmfnk.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRsbGR0YWVwYmh2cnBjbWZtZm5rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU3NzA2NTIsImV4cCI6MjA3MTM0NjY1Mn0.gf-OpsJugJXOk2NnZfJ4v6gpxFiadpf0yHC9_PEdC6M';

const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export default supabaseClient;
