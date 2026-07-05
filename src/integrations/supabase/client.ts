import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

const EXPECTED_SUPABASE_HOSTNAME = 'gvtjlfpzxyjbcaiyonnb.supabase.co';
const EXPECTED_SUPABASE_PROJECT_REF = 'gvtjlfpzxyjbcaiyonnb';

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

    // New Supabase API keys are opaque strings, not bearer JWTs.
    if (isNewSupabaseApiKey(supabaseKey) && headers.get('Authorization') === `Bearer ${supabaseKey}`) {
      headers.delete('Authorization');
    }

    headers.set('apikey', supabaseKey);
    return fetch(input, { ...init, headers });
  };
}


function validateExternalSupabaseConfig() {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl) {
    throw new Error('MediCure Supabase configuration error: missing VITE_SUPABASE_URL.');
  }

  if (!publishableKey) {
    throw new Error('MediCure Supabase configuration error: missing VITE_SUPABASE_PUBLISHABLE_KEY.');
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(supabaseUrl);
  } catch {
    throw new Error('MediCure Supabase configuration error: VITE_SUPABASE_URL is not a valid URL.');
  }

  if (parsedUrl.hostname !== EXPECTED_SUPABASE_HOSTNAME) {
    throw new Error(
      `MediCure Supabase configuration error: expected ${EXPECTED_SUPABASE_HOSTNAME}, received ${parsedUrl.hostname}.`,
    );
  }

  return {
    supabaseUrl: parsedUrl.origin,
    publishableKey,
    hostname: parsedUrl.hostname,
    projectRef: parsedUrl.hostname.split('.')[0],
  };
}

function logSafeConnectionDiagnostic(client: ReturnType<typeof createClient<Database>>, hostname: string, projectRef: string) {
  if (!import.meta.env.DEV || typeof window === 'undefined') return;

  client.auth.getSession().then(({ data }) => {
    console.info('[MediCure Supabase]', {
      hostname,
      project_reference: projectRef,
      session_exists: Boolean(data.session),
    });
  });
}

function createSupabaseClient() {
  const { supabaseUrl, publishableKey, hostname, projectRef } = validateExternalSupabaseConfig();

  if (projectRef !== EXPECTED_SUPABASE_PROJECT_REF) {
    throw new Error(
      `MediCure Supabase configuration error: expected project ${EXPECTED_SUPABASE_PROJECT_REF}, received ${projectRef}.`,
    );
  }

  const client = createClient<Database>(supabaseUrl, publishableKey, {
    global: {
      fetch: createSupabaseFetch(publishableKey),
    },
    auth: {
      storage: typeof window !== 'undefined' ? localStorage : undefined,
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    }
  });

  logSafeConnectionDiagnostic(client, hostname, projectRef);
  return client;
}

let _supabase: ReturnType<typeof createSupabaseClient> | undefined;

export const expectedSupabaseHostname = EXPECTED_SUPABASE_HOSTNAME;

export const supabase = new Proxy({} as ReturnType<typeof createSupabaseClient>, {
  get(_, prop, receiver) {
    if (!_supabase) _supabase = createSupabaseClient();
    return Reflect.get(_supabase, prop, receiver);
  },
});

