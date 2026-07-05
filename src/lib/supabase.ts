import { createClient, type SupabaseClient } from '@supabase/supabase-js';

type Database = Record<string, never>;

const EXPECTED_SUPABASE_URL = 'https://gvtjlfpzxyjbcaiyonnb.supabase.co';
const EXPECTED_SUPABASE_HOSTNAME = 'gvtjlfpzxyjbcaiyonnb.supabase.co';
const EXPECTED_SUPABASE_PROJECT_REF = 'gvtjlfpzxyjbcaiyonnb';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_U3WXZUCeEL8fFbPNj0bqcg_jFoCUUAn';

function isNewSupabaseApiKey(value: string): boolean {
  return value.startsWith('sb_publishable_') || value.startsWith('sb_secret_');
}

function createSupabaseFetch(supabaseKey: string): typeof fetch {
  return (input, init) => {
    const headers = new Headers(
      typeof Request !== 'undefined' && input instanceof Request ? input.headers : undefined,
    );

    if (init?.headers) {
      new Headers(init.headers).forEach((value, key) => headers.set(key, value));
    }

    if (isNewSupabaseApiKey(supabaseKey) && headers.get('Authorization') === `Bearer ${supabaseKey}`) {
      headers.delete('Authorization');
    }

    headers.set('apikey', supabaseKey);
    return fetch(input, { ...init, headers });
  };
}

function validateExternalSupabaseConfig() {
  if (!EXPECTED_SUPABASE_URL) {
    throw new Error('MediCure Supabase configuration error: missing Supabase URL.');
  }

  if (!SUPABASE_PUBLISHABLE_KEY) {
    throw new Error('MediCure Supabase configuration error: missing Supabase publishable key.');
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(EXPECTED_SUPABASE_URL);
  } catch {
    throw new Error('MediCure Supabase configuration error: Supabase URL is not valid.');
  }

  if (parsedUrl.hostname !== EXPECTED_SUPABASE_HOSTNAME) {
    throw new Error(
      `MediCure Supabase configuration error: expected ${EXPECTED_SUPABASE_HOSTNAME}, received ${parsedUrl.hostname}.`,
    );
  }

  const projectRef = parsedUrl.hostname.split('.')[0];
  if (projectRef !== EXPECTED_SUPABASE_PROJECT_REF) {
    throw new Error(
      `MediCure Supabase configuration error: expected project ${EXPECTED_SUPABASE_PROJECT_REF}, received ${projectRef}.`,
    );
  }

  return {
    supabaseUrl: parsedUrl.origin,
    publishableKey: SUPABASE_PUBLISHABLE_KEY,
    hostname: parsedUrl.hostname,
    projectRef,
  };
}

function logSafeConnectionDiagnostic(client: SupabaseClient<Database>, hostname: string, projectRef: string) {
  if (!import.meta.env.DEV || typeof window === 'undefined') return;

  client.auth
    .getSession()
    .then(({ data }) => {
      console.info(
        `[MediCure Supabase] Supabase hostname: ${hostname}; Supabase project reference: ${projectRef}; session exists: ${Boolean(data.session)}`,
      );
    })
    .catch(() => {
      console.info(
        `[MediCure Supabase] Supabase hostname: ${hostname}; Supabase project reference: ${projectRef}; session exists: false`,
      );
    });
}

function createExternalSupabaseClient() {
  const { supabaseUrl, publishableKey, hostname, projectRef } = validateExternalSupabaseConfig();

  const client = createClient<Database>(supabaseUrl, publishableKey, {
    global: {
      fetch: createSupabaseFetch(publishableKey),
    },
    auth: {
      storage: typeof window !== 'undefined' ? localStorage : undefined,
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });

  logSafeConnectionDiagnostic(client, hostname, projectRef);
  return client;
}

let supabaseInstance: ReturnType<typeof createExternalSupabaseClient> | undefined;

export const expectedSupabaseHostname = EXPECTED_SUPABASE_HOSTNAME;

export const supabase = new Proxy({} as ReturnType<typeof createExternalSupabaseClient>, {
  get(_, prop, receiver) {
    if (!supabaseInstance) supabaseInstance = createExternalSupabaseClient();
    return Reflect.get(supabaseInstance, prop, receiver);
  },
});