import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  useRouterState,
  useNavigate,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, useRef, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { AuthProvider, useAuth } from "../hooks/useAuth";
import { Toaster } from "../components/ui/sonner";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { name: "theme-color", content: "#0aa5a1" },
      { title: "MediCure — Book doctors, in-person or online" },
      { name: "description", content: "MediCure is a premium clinic consultation platform for booking in-person and online appointments with trusted doctors." },
      { property: "og:title", content: "MediCure — Book doctors, in-person or online" },
      { property: "og:description", content: "MediCure is a premium clinic consultation platform for booking in-person and online appointments with trusted doctors." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "MediCure — Book doctors, in-person or online" },
      { name: "twitter:description", content: "MediCure is a premium clinic consultation platform for booking in-person and online appointments with trusted doctors." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/a6ae3018-4f3b-4a00-a38e-96571a87fc00/id-preview-81e4f6f4--bfe442a1-1582-4775-a300-2759ee463d5a.lovable.app-1783258072877.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/a6ae3018-4f3b-4a00-a38e-96571a87fc00/id-preview-81e4f6f4--bfe442a1-1582-4775-a300-2759ee463d5a.lovable.app-1783258072877.png" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "icon", href: "/favicon.ico", type: "image/x-icon" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <AuthSessionSync />
        <AdminSessionGuard />
        {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
        <Outlet />
        <Toaster />
      </AuthProvider>
    </QueryClientProvider>
  );
}

// When the authenticated Supabase user changes (sign in, sign out, or switch),
// drop cached query data so the previous user's data never bleeds into the
// new session, and re-run route loaders so guards re-evaluate.
function AuthSessionSync() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const lastUserId = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_UPDATED") return;
      const nextId = session?.user?.id ?? null;
      if (lastUserId.current === undefined) {
        lastUserId.current = nextId;
        return;
      }
      if (lastUserId.current === nextId) return;
      lastUserId.current = nextId;
      queryClient.cancelQueries();
      queryClient.clear();
      if (typeof window !== "undefined") {
        window.localStorage.removeItem("medicure:isAdmin");
      }
      router.invalidate();
    });
    return () => sub.subscription.unsubscribe();
  }, [queryClient, router]);

  return null;
}

// Keeps authenticated admins on the /admin routes across page refreshes.
// If the current user is an active admin but has landed on a patient-facing
// route (e.g. after a hard reload), send them back to the admin dashboard.
function AdminSessionGuard() {
  const { isAdmin, adminChecked, user } = useAuth();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    if (!adminChecked) return;
    // Non-admin (or signed-out) sitting inside /admin must be evicted so
    // stale admin UI from a previous session cannot leak to a new user.
    if (pathname.startsWith("/admin") && !isAdmin) {
      navigate({ to: user ? "/account" : "/auth", replace: true });
      return;
    }
    if (!user || !isAdmin) return;
    if (pathname.startsWith("/admin")) return;
    if (pathname.startsWith("/auth")) return;
    navigate({ to: "/admin", replace: true });
  }, [user, isAdmin, adminChecked, pathname, navigate]);

  return null;
}
