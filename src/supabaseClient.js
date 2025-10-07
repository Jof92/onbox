import { createClient } from '@supabase/supabase-js';

console.log("SUPABASE URL:", process.env.REACT_APP_SUPABASE_URL);
console.log("SUPABASE KEY:", process.env.REACT_APP_SUPABASE_ANON_KEY ? "✅ OK" : "❌ NOT FOUND");


const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
