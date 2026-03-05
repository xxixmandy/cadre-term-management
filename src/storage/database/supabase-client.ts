import { createClient, SupabaseClient } from '@supabase/supabase-js';

let supabaseInstance: SupabaseClient | null = null;

interface SupabaseCredentials {
  url: string;
  anonKey: string;
}

function getSupabaseCredentials(): SupabaseCredentials {
  // 优先使用 NEXT_PUBLIC_ 前缀的环境变量（Vercel 标准）
  // 兼容 COZE_ 前缀的环境变量（Coze 环境）
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.COZE_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.COZE_SUPABASE_ANON_KEY;

  if (!url) {
    throw new Error('SUPABASE_URL is not set. Please set NEXT_PUBLIC_SUPABASE_URL environment variable.');
  }
  if (!anonKey) {
    throw new Error('SUPABASE_ANON_KEY is not set. Please set NEXT_PUBLIC_SUPABASE_ANON_KEY environment variable.');
  }

  return { url, anonKey };
}

function getSupabaseClient(token?: string): SupabaseClient {
  if (supabaseInstance && !token) {
    return supabaseInstance;
  }

  const { url, anonKey } = getSupabaseCredentials();

  if (token) {
    return createClient(url, anonKey, {
      global: {
        headers: { Authorization: `Bearer ${token}` },
      },
      db: {
        timeout: 60000,
      },
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }

  supabaseInstance = createClient(url, anonKey, {
    db: {
      timeout: 60000,
    },
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  return supabaseInstance;
}

export { getSupabaseCredentials, getSupabaseClient };
