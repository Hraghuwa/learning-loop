import { createClient } from "@supabase/supabase-js";
import { Database } from "@/types/database";

export const supabaseAdmin = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "http://localhost:54321",
  process.env.SUPABASE_SERVICE_ROLE_KEY || "dummy",
  {
    auth: { persistSession: false, autoRefreshToken: false },
  },
);
