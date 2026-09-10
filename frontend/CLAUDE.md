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
│   │   ├── tender-departments.ts
│   │   └── users.ts
│   ├── auth/
│   │   ├── AuthContext.tsx   # React context: user, tokens, login/logout
│   │   ├── ProtectedRoute.tsx
│   │   └── AdminRoute.tsx
│   ├── components/
│   │   ├── ui/               # form primitives (button, input, select, label,
│   │   │                     # combobox — the searchable dropdown)
│   │   ├── layout/           # AppShell, Sidebar (no top bar — see design system)
│   │   └── shared/           # DataTable, Drawer, PageHeader, Pagination,
│   │                         # SearchInput, RowActions, EmptyState,
│   │                         # StatusPill, MetricCard, MasterListManager,
│   │                         # ClientPicker
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
│   │       └── TenderDepartmentsPage.tsx
│   ├── hooks/                # React Query hooks: useClients, useCreateClient, ...
│   │   ├── useClients.ts
│   │   ├── useTenders.ts
│   │   └── ...
│   ├── lib/
│   │   ├── format.ts         # currency, date, number formatters
│   │   ├── nav.ts            # sidebar nav groups
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
import { phoneSchema } from "@/lib/validation";

const clientSchema = z.object({
  contact_person_name: z.string().min(1, "Required").max(120),
  company_name: z.string().min(1, "Required").max(200),
  contact_number: phoneSchema,   // shared: Indian mobile, normalized to 10 digits
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

`lib/validation.ts` mirrors `backend/app/schemas/validators.py`. The duplication
is deliberate (root CLAUDE.md, monorepo split rules) — a rule changed on one
side needs the same change on the other.

**Dropdowns are `<Combobox>`, not `<select>`.** It takes `value` / `onChange`
rather than a ref, so drive it with React Hook Form's `watch` + `setValue`
instead of `register`. Where the option list can outgrow one API page — anything
listing clients — pass `onSearchChange` so the query goes to the server. Pick a
client with `<ClientPicker>`, which renders the paired contact-name and
company-name fields over a single `client_id`.

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
          { path: "/admin/tender-departments", element: <TenderDepartmentsPage /> },
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
- **Put every data-entry form in a `<Drawer>`** with `<DrawerBody>` / `<DrawerFooter>`, and start
  every page with a `<PageHeader>`. Consistency across modules is the point of these.
- **Style with the semantic tokens** (`bg-card`, `text-muted-foreground`, `border-border`,
  `bg-primary`) defined in `docs/DESIGN_SYSTEM.md` — never a raw hex or an ad-hoc gray.
- **Use path aliases** (`@/api/clients`, `@/hooks/useClients`) — Vite is configured with `@` → `src/`.

---

## Don'ts

- **Don't `fetch` or `axios.get` directly in a component or page.** All server calls go through `src/api/` and are consumed via a hook in `src/hooks/`.
- **Don't `useEffect` to fetch data.** That's what React Query is for.
- **Don't put the auth token in the URL or query string.** Ever.
- **Don't store any user-editable data in `localStorage` except the refresh token.** All other state lives in React state or React Query cache.
- **Don't use `any`.** Type it or say why in a comment. `unknown` is fine when narrowing follows.
- **Don't skip Zod on a form.** Even trivial forms get validation — it's cheap and it catches copy-paste bugs.
- **Don't invent new visual language.** The design system is `docs/DESIGN_SYSTEM.md`. If a screen needs something it doesn't cover, add it there first, then build it.
- **Don't use `rounded-*`, a raw hex colour, or a font stack of your own.** Radius is globally 0, colours are tokens, and the two typefaces are set in the base layer.
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
9. [ ] Uses `PageHeader`, `DataTable`, `Drawer`, `EmptyState`, `MetricCard` primitives where applicable.
10. [ ] Matches `docs/DESIGN_SYSTEM.md`: token colours, 0px radius, pill statuses, `formatCurrency` / `formatDate`.
11. [ ] Smoke tests pass with both dev servers up:
    - `node scripts/smoke.mjs` — desktop at 1440px; create, list, edit, delete end to end.
    - `node scripts/smoke-mobile.mjs` — iPhone 12 profile; also asserts nothing overflows the
      viewport and the document never scrolls horizontally.

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

## UI — Elevated Minimalism

The visual language is specified in **`docs/DESIGN_SYSTEM.md`**. Read it before touching any
component. The short version:

- **Tokens, not values.** Colours come from the CSS variables in `src/index.css`, surfaced as
  Tailwind names (`bg-background`, `bg-card`, `text-foreground`, `text-muted-foreground`,
  `border-border`, `bg-primary`, `bg-ink`). No raw hex in components.
- **Zero border-radius.** The whole `borderRadius` scale is overridden to `0` in
  `tailwind.config.ts`, so `rounded-*` classes are inert by design. Don't fight it.
- **Type pairing.** Playfair Display for `h1`–`h3` (applied in the base layer, so a bare heading
  is already right) and `.font-display`; Plus Jakarta Sans for everything else.
- **Page skeleton.** `<div className="space-y-8 px-8 py-8">` → `<PageHeader>` → optional
  `<MetricCard>` grid → a `.surface` card wrapping toolbar + `<DataTable>` + `<Pagination>`.
  There is no top bar — `<PageHeader>` is the only place a page names itself.
- **Buttons inside table cells are `variant="outline"`**, never `ghost` — ghost reads as plain
  text until hovered. Numbers (KPIs, totals) stay in the sans face, not the display serif.
- **Forms live in drawers.** `<Drawer>` + `<DrawerBody>` + `<DrawerFooter>`; the form is
  `flex h-full flex-col` so its action bar pins to the bottom.
- **Money and dates** always go through `formatCurrency` / `formatDate`. **Statuses** are always
  a `<StatusPill>`, never plain text.
- Loading states: `Loading…` in muted text (the smoke test keys off that string). Error states: a
  bordered `bg-red-50` block in `text-destructive`. Toasts still to come.
- **Responsive is required.** Desktop-first at 1440px, usable down to 360px, nothing scrolling
  horizontally at any width. Use the `.page` and `.toolbar` classes instead of hand-rolling the
  padding ladder, and give each new table column a `mobile` role so it lands correctly in the
  stacked card layout `DataTable` renders below `md`. `scripts/smoke-mobile.mjs` is the check —
  it fails on any element that overflows the viewport, which is the failure mode that is hardest
  to spot by eye.
