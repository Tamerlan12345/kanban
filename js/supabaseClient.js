// supabaseClient.js
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.error("Supabase URL or Anon Key is missing. Make sure you have a `js/config.js` file with SUPABASE_URL and SUPABASE_ANON_KEY constants.");
}

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export default supabaseClient;