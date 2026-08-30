# CLAUDE.md — Frontend

Extends the root `CLAUDE.md`. Read that first, then this. This file governs everything under `frontend/`.

---

## Stack

- **React 19** + **TypeScript** (strict mode, `noImplicitAny`, `strictNullChecks`)
- **Vite** — dev server + build tool
- **TanStack Query (React Query) v5** — server state
- **React Router v7** — routing
- **React Hook Form** + **Zod** — forms and validation
- **axios** — HTTP client
- **Tailwind CSS** + **shadcn/ui** — styling and primitive components
- **pnpm** — package manager

**Node 20+ required.**

---

## Folder Layout & Responsibilities

```
frontend/
├── index.html
├── src/
│   ├── main.tsx              # ReactDOM entry
│   ├── App.tsx               # top-level providers (Query, Auth, Router)
│   ├── router.tsx            # React Router config + guards
│   ├── api/
│   │   ├── client.ts         # axios instance + interceptors
│   │   ├── auth.ts           # login, refresh, me, logout fns
│   │   ├── clients.ts        # typed API fns for the clients resource
│   │   ├── credentials.ts
│   │   ├── tenders.ts
│   │   ├── dsc.ts
│   │   ├── portals.ts
│   │   ├── tender-names.ts
│   │   └── users.ts
│   ├── auth/
│   │   ├── AuthContext.tsx   # React context: user, tokens, login/logout
│   │   ├── ProtectedRoute.tsx
│   │   └── AdminRoute.tsx
│   ├── components/
│   │   ├── ui/               # shadcn/ui primitives (button, input, dialog, ...)
│   │   ├── layout/           # AppShell, Sidebar, Topbar
│   │   └── shared/           # DataTable, EmptyState, StatusPill, MetricCard
│   ├── pages/
│   │   ├── LoginPage.tsx
│   │   ├── DashboardPage.tsx
│   │   ├── clients/
│   │   │   ├── ClientsPage.tsx
│   │   │   ├── ClientForm.tsx
│   │   │   └── ClientsTable.tsx
│   │   ├── credentials/...
│   │   ├── tenders/...
│   │   ├── dsc/...
│   │   └── admin/
│   │       ├── UsersPage.tsx
│   │       ├── PortalsPage.tsx
│   │       └── TenderNamesPage.tsx
│   ├── hooks/                # React Query hooks: useClients, useCreateClient, ...
│   │   ├── useClients.ts
│   │   ├── useTenders.ts
│   │   └── ...
│   ├── lib/
│   │   ├── format.ts         # currency, date, number formatters
│   │   ├── validation.ts     # shared Zod primitives (email, phone, etc.)
│   │   └── utils.ts          # cn(), classnames helpers
│   └── types/                # shared TS types mirroring API responses
│       ├── api.ts            # envelope + error types
│       ├── user.ts
│       ├── client.ts
│       └── ...
```

---

## Patterns

### The API Client Layer

`src/api/client.ts` — a single axios instance with interceptors:

```ts
import axios from "axios";
import { getAccessToken, refreshAccessToken, clearAuth } from "@/auth/tokenStore";

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
});

apiClient.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

apiClient.interceptors.response.use(
  (r) => r,
  async (error) => {
    const { response, config } = error;
    if (response?.data?.error?.code === "TOKEN_EXPIRED" && !config._retry) {
      config._retry = true;
      try {
        await refreshAccessToken();
        return apiClient(config);
      } catch {
        clearAuth();
        window.location.href = "/";
      }
    }
    // Normalize to our ApiError
    throw new ApiError(response?.data?.error?.code ?? "NETWORK_ERROR", response?.data?.error?.message ?? "Something went wrong");
  }
);
```

### Typed Endpoint Functions

`src/api/clients.ts`:

```ts
import type { Client, ClientCreate, ClientUpdate, PaginatedResponse } from "@/types";
import { apiClient } from "./client";

export const clientsApi = {
  list: async (params: { page?: number; pageSize?: number; search?: string }) => {
    const { data } = await apiClient.get<{ success: true; data: PaginatedResponse<Client> }>("/api/clients", { params });
    return data.data;
  },
  create: async (payload: ClientCreate) => {
    const { data } = await apiClient.post<{ success: true; data: Client }>("/api/clients", payload);
    return data.data;
  },
  update: async (id: string, payload: ClientUpdate) => {
    const { data } = await apiClient.patch<{ success: true; data: Client }>(`/api/clients/${id}`, payload);
    return data.data;
  },
  delete: async (id: string) => {
    const { data } = await apiClient.delete<{ success: true; data: { id: string; deleted: boolean } }>(`/api/clients/${id}`);
    return data.data;
  },
};
```

Every API call in the app goes through a function in `src/api/`. No `fetch()` or `axios.get()` scattered across components.

### React Query Hooks

`src/hooks/useClients.ts`:

```ts
export const clientsKeys = {
  all: ["clients"] as const,
  list: (params: object) => [...clientsKeys.all, "list", params] as const,
  detail: (id: string) => [...clientsKeys.all, "detail", id] as const,
};

export function useClients(params: { page: number; pageSize: number; search?: string }) {
  return useQuery({
    queryKey: clientsKeys.list(params),
    queryFn: () => clientsApi.list(params),
  });
}

export function useCreateClient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: clientsApi.create,
    onSuccess: () => qc.invalidateQueries({ queryKey: clientsKeys.all }),
  });
}
```

Every server data touchpoint uses React Query. No `useEffect` + `useState` + `fetch` triads. No manual loading/error tracking outside the hook.

### Forms

React Hook Form + Zod:

```tsx
const clientSchema = z.object({
  contact_person_name: z.string().min(1, "Required").max(120),
  company_name: z.string().min(1, "Required").max(200),
  contact_number: z.string().regex(/^[\d +\-]{7,20}$/, "Invalid phone number"),
  email: z.string().email("Invalid email"),
});
type ClientFormValues = z.infer<typeof clientSchema>;

export function ClientForm({ onSuccess }: { onSuccess: () => void }) {
  const { register, handleSubmit, formState: { errors } } = useForm<ClientFormValues>({
    resolver: zodResolver(clientSchema),
  });
  const createClient = useCreateClient();

  return (
    <form onSubmit={handleSubmit(async (values) => {
      try {
        await createClient.mutateAsync(values);
        onSuccess();
      } catch (err) {
        // surface via toast once toasts are wired
        console.error(err);
      }
    })}>
      {/* inputs */}
    </form>
  );
}
```

Every form has a Zod schema. Schema is defined co-located with the form or in `lib/validation.ts` if shared.

### Auth Context

`src/auth/AuthContext.tsx` provides `useAuth()` → `{ user, isAuthenticated, isAdmin, login, logout }`. The access token lives in a ref/state inside the context provider; the refresh token lives in `localStorage` for persistence across reloads.

On mount, the provider checks for a refresh token, tries `GET /api/auth/me` with a fresh access token (via refresh flow if needed), and hydrates the user. Until that check resolves, render a full-page loading state.

### Routing

`src/router.tsx`:

```tsx
export const router = createBrowserRouter([
  { path: "/", element: <LoginPage /> },
  {
    element: <ProtectedRoute><AppShell /></ProtectedRoute>,
    children: [
      { path: "/dashboard", element: <DashboardPage /> },
      { path: "/clients", element: <ClientsPage /> },
      { path: "/credentials", element: <CredentialsPage /> },
      { path: "/tenders", element: <TendersPage /> },
      { path: "/dsc", element: <DscPage /> },
      {
        element: <AdminRoute />,
        children: [
          { path: "/admin/users", element: <UsersPage /> },
          { path: "/admin/portals", element: <PortalsPage /> },
          { path: "/admin/tender-names", element: <TenderNamesPage /> },
        ],
      },
    ],
  },
]);
```

`<ProtectedRoute>` redirects to `/` if not authenticated. `<AdminRoute>` renders a 403 page (or redirects to `/dashboard`) if the user isn't admin.

### Types Mirror the API

`src/types/client.ts`:

```ts
export interface Client {
  id: string;
  contact_person_name: string;
  company_name: string;
  contact_number: string;
  email: string;
  created_by: { id: string; full_name: string };
  created_at: string; // ISO timestamp
}

export interface ClientCreate {
  contact_person_name: string;
  company_name: string;
  contact_number: string;
  email: string;
}

export interface ClientUpdate extends Partial<ClientCreate> {}
```

Every type mirrors the response shape from `API_CONTRACT.md`. If the API contract changes, update the type in the same commit.

---

## Do's

- **Always destructure `data.data` in API functions** so hook consumers get the payload directly, not the envelope.
- **Always type your React Query hooks** — no inferred `any`.
- **Always co-locate a form's Zod schema with the form component** unless shared across forms.
- **Always use `useMutation` for POST/PATCH/DELETE**, `useQuery` for GET.
- **Always invalidate the relevant query key(s) after a successful mutation** — this is how the UI stays in sync.
- **Use the shared formatters** (`formatCurrency`, `formatDate`) from `lib/format.ts` for all money and date rendering.
- **Use the shared `DataTable` and `EmptyState` components** rather than reinventing per page.
- **Use path aliases** (`@/api/clients`, `@/hooks/useClients`) — Vite is configured with `@` → `src/`.

---

## Don'ts

- **Don't `fetch` or `axios.get` directly in a component or page.** All server calls go through `src/api/` and are consumed via a hook in `src/hooks/`.
- **Don't `useEffect` to fetch data.** That's what React Query is for.
- **Don't put the auth token in the URL or query string.** Ever.
- **Don't store any user-editable data in `localStorage` except the refresh token.** All other state lives in React state or React Query cache.
- **Don't use `any`.** Type it or say why in a comment. `unknown` is fine when narrowing follows.
- **Don't skip Zod on a form.** Even trivial forms get validation — it's cheap and it catches copy-paste bugs.
- **Don't build a custom design system.** Prototype phase. Reach for shadcn/ui primitives and Tailwind utilities. UI polish is a separate pass.
- **Don't put business logic in components.** If a computation is more than a one-liner, move it to a `lib/` util and unit test it.
- **Don't hardcode the API URL.** Always `import.meta.env.VITE_API_BASE_URL`.

---

## Adding a New Page — Checklist

1. [ ] Backend endpoint exists and is documented in `docs/API_CONTRACT.md`.
2. [ ] TypeScript types added / updated in `src/types/`.
3. [ ] Typed API functions added in `src/api/`.
4. [ ] React Query hooks added in `src/hooks/`.
5. [ ] Page component created in `src/pages/<module>/`.
6. [ ] Form (if any) uses React Hook Form + Zod.
7. [ ] Route registered in `src/router.tsx`, wrapped correctly with `<ProtectedRoute>` / `<AdminRoute>`.
8. [ ] Sidebar nav entry added if the page needs top-level nav.
9. [ ] Uses `DataTable`, `EmptyState`, `MetricCard` primitives where applicable.
10. [ ] Manual smoke test: create, list, edit, delete flow works end-to-end.

---

## Formatting & Linting

```bash
pnpm lint         # ESLint
pnpm lint:fix     # auto-fix
pnpm typecheck    # tsc --noEmit
pnpm format       # prettier
```

CI runs `pnpm lint && pnpm typecheck` — both must pass.

---

## Prototype-Phase UI Notes

- Use shadcn/ui primitives as-is. Don't restyle.
- Use Tailwind utility classes directly in components. Don't extract into `styled` components or SCSS.
- Loading states: a simple `<div>Loading…</div>` is fine. Skeletons come later.
- Error states: a simple `<div className="text-red-600">{error.message}</div>`. Toasts come later.
- Empty states: `<EmptyState title="No clients yet" action={<Button>Add Client</Button>} />`. That's it.
- Mobile responsiveness: not required. Design for desktop 1440px width. Tablet is a bonus.

The point of the prototype is to prove the workflow end-to-end. Visual design is a follow-up pass with a designer or a dedicated Claude session focused on UI.
