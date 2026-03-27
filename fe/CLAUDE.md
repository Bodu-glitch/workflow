# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm start              # Start Expo dev server (scan QR or press a/i/w to open)
npm run android        # Start on Android emulator/device
npm run ios            # Start on iOS simulator/device
npm run web            # Start on web browser
npm run lint           # Run ESLint via expo lint
```

No test runner is configured yet.

## Architecture

This is an **Expo 55 / React Native 0.83** app using **Expo Router** (file-based routing). Source lives under `src/` with the `@/` path alias resolving to `src/`.

This is a **Task Assignment App** — multi-tenant SaaS for field task management. Three mobile roles: Business Owner (BO), Operation Team (OT), Staff. Role values in code: `business_owner`, `operator`, `staff`.

### Auth

Auth is handled by `src/context/auth.tsx` (`AuthProvider` / `useAuth()`). It persists a JWT token via `tokenStore` (in `src/lib/api/client.ts`) and exposes: `login`, `logout`, `register`, `selectTenant`, `refreshProfile`, `role`, `user`, `pendingSelection`.

Login may return a `requires_tenant_selection` response — in this case `pendingSelection` is set and the user is redirected to `/(auth)/select-tenant` before a token is issued.

### Google OAuth (loginWithGoogle)

Implemented in `src/context/auth.tsx` (`loginWithGoogle`). Uses Supabase PKCE flow — **do not switch to implicit flow**.

**Supabase client** (`src/lib/supabase.ts`): `flowType: 'pkce'` is required; `detectSessionInUrl: false` on native.

**Redirect URI**:
- Native: `makeRedirectUri({ path: 'oauth-callback' })` → `taskmanagement://oauth-callback`
- Web: `window.location.origin`

`taskmanagement://oauth-callback` must be in `additional_redirect_urls` in `supabase-local/supabase/config.toml`.

**Native flow (iOS/Android)**:
1. `supabase.auth.signInWithOAuth({ provider: 'google', skipBrowserRedirect: true })` → get URL
2. `WebBrowser.openAuthSessionAsync(url, redirectTo)` → open Chrome Custom Tab
3. Google redirects to `taskmanagement://oauth-callback?code=XXX`
4. Expo Router routes to `/(auth)/oauth-callback` (within `(auth)` group — does NOT push to root stack)
5. `Linking.addEventListener` (`handleDeepLink`) catches the URL → `exchangeCodeForSession(code)` → session
6. `onAuthStateChange` SIGNED_IN → `handleSupabaseSession` → `pendingSelection` set
7. `oauth-callback.tsx` `useEffect` detects `pendingSelection` → `router.replace('/(auth)/select-tenant')`

**Android caveat**: `Linking` may fire before `openAuthSessionAsync` resolves. The `openAuthSessionAsync` success path calls `supabase.auth.getSession()` first — if a session already exists it skips the exchange to avoid `pkce_code_verifier_not_found`.

**`(auth)/_layout.tsx`**: `<Stack.Screen name="oauth-callback" />` is placed outside all `Stack.Protected` blocks so it is always accessible when an OAuth callback arrives.

**`oauth-callback.tsx`**: Does NOT rely on `Stack.Protected` for navigation — it actively navigates via `useEffect` when auth state resolves.

`src/app/index.tsx` uses `useAuth()` to redirect:
1. Loading → `<LoadingScreen />`
2. `pendingSelection` → `/(auth)/select-tenant`
3. Not logged in → `/(auth)/login`
4. Has pending invitations → `/(auth)/invitations`
5. By role: `business_owner` → `/(bo)`, `operator` → `/(ot)`, `staff` → `/(staff)`

### Routing

`src/app/` is the Expo Router root. `_layout.tsx` wraps the entire app in `ThemeProvider` + `AnimatedSplashOverlay` and renders a `Stack` navigator.

#### Route groups by role

```
src/app/
├── _layout.tsx              → Stack navigator (ThemeProvider + AnimatedSplashOverlay)
├── index.tsx                → Auth-aware redirect (useAuth → bo/ot/staff/auth)
├── notifications.tsx        → Shared — Notification Center (all roles)
├── profile.tsx              → Shared — Profile screen (all roles, no tab bar)
│
├── (auth)/
│   ├── _layout.tsx
│   ├── login.tsx            → Login (AU-01 to AU-05)
│   ├── register.tsx         → Register new account + tenant
│   ├── oauth-callback.tsx   → OAuth deep link landing (PKCE code exchange + navigate)
│   ├── select-tenant.tsx    → Tenant picker (multi-tenant login flow)
│   └── invitations.tsx      → Pending staff invitations on first login
│
├── (bo)/                    → Business Owner screens
│   ├── _layout.tsx          → NativeTabs (4 tabs: Dashboard, Staff, Tasks, Audit)
│   ├── _layout.web.tsx      → Headless tabs fallback for web (expo-router/ui)
│   ├── index.tsx            → Dashboard Overview (TM-11)
│   ├── audit-log.tsx        → Audit Log — BO only (AL-01 to AL-06)
│   ├── employees.tsx        → Employee Management — full access (UM-01 to UM-08)
│   ├── rejected-overdue.tsx → Rejected/Overdue Handling (not a tab — pushed via router)
│   └── tasks/
│       ├── _layout.tsx      → Stack navigator (nested inside Tasks tab)
│       ├── index.tsx        → Task Manager (TM-07, TM-09, TM-10)
│       ├── [id].tsx         → Task Detail — management view (TM-08, AL-05)
│       └── create.tsx       → Create/Edit Task (TM-01 to TM-06)
│
├── (ot)/                    → Operation Team screens
│   ├── _layout.tsx
│   ├── index.tsx            → Team Dashboard
│   ├── assignment.tsx       → Task Assignment (TM-04)
│   ├── employees.tsx        → Employee Management — invite only (UM-01 to UM-06)
│   ├── rejected-overdue.tsx → Rejected/Overdue Handling
│   └── tasks/
│       ├── index.tsx        → Task List (same filters as BO)
│       ├── [id].tsx         → Task Detail — management view (same as BO)
│       └── create.tsx       → Create/Edit Task
│
└── (staff)/                 → Staff screens
    ├── _layout.tsx
    ├── index.tsx            → My Task List (ST-01)
    ├── history.tsx          → Work History (ST-03)
    └── tasks/
        └── [id].tsx         → Task Detail & Execution — check in/out, reject (ST-02, CI-01 to CI-06)
```

#### Shared screens (BO + OT)

Task Detail, Task Create/Edit, Employee Management, and Rejected/Overdue exist in both `(bo)/` and `(ot)/` with different permission levels. They should share underlying components but maintain separate routes.

#### Staff Task Detail is independent

`(staff)/tasks/[id].tsx` is a completely different screen from the management view — it renders Check In, Check Out, and Reject actions. Do not merge it with BO/OT task detail.

#### NativeTabs navigation pattern (BO)

`(bo)/_layout.tsx` uses `NativeTabs` from `expo-router/unstable-native-tabs`. Key rules:

- **Only screens listed as `NativeTabs.Trigger` appear in the tab bar.** Screens not listed (e.g. `rejected-overdue`) are still accessible via `router.push('/(bo)/rejected-overdue')` but have no tab icon.
- **Screens inside a tab group that need push navigation must have their own `_layout.tsx` with `<Stack>`.** This is why `(bo)/tasks/_layout.tsx` exists — without it, `tasks/[id]` and `tasks/create` would either become extra tabs or break navigation.
- **`(bo)/_layout.web.tsx`** replaces the native layout on web, using headless tabs from `expo-router/ui`. The `.web.tsx` extension convention is used here.
- When wrapping a `ScrollView` inside a NativeTabs screen, wrap it in `<View collapsable={false}>` so the tap-to-scroll-top behaviour works correctly on Android.

### API layer

`src/lib/api/` contains all backend API modules:

| Module | Purpose |
|---|---|
| `client.ts` | Axios base client + `tokenStore` (JWT persistence) |
| `auth.ts` | login, logout, register, profile, selectTenant |
| `me.ts` | Current user profile endpoints |
| `tasks.ts` | Task CRUD, list, status transitions |
| `staff.ts` | Staff management + `myInvitations()` |
| `audit.ts` | Audit log queries |
| `notifications.ts` | Notification endpoints |

Types for all API responses live in `src/types/api.ts`.

### Platform-specific files

The codebase uses Expo's `.web.ts(x)` extension convention to swap implementations per platform:

| Native | Web |
|---|---|
| `animated-icon.tsx` | `animated-icon.web.tsx` |
| `(bo)/_layout.tsx` | `(bo)/_layout.web.tsx` |

`src/components/app-tabs.tsx` and `app-tabs.web.tsx` are kept as reference patterns for the NativeTabs + headless tabs combination. The active BO navigation follows the same pattern directly in the route layout files.

### Theming

Tailwind CSS (NativeWind v5 / Tailwind v4) is the single theming layer. All theme customisation goes in `src/global.css` using `@theme`:

```css
@layer theme {
  @theme {
    --color-brand: #1E40AF;
    --color-primary: #1E40AF;
  }
}
```

Primary brand color is `#1E40AF` (Tailwind blue-800). Light/dark mode is handled with Tailwind's `dark:` variant. Platform-specific CSS variables use `@media ios` / `@media android` blocks (already in `global.css`). `postcss.config.mjs` drives the PostCSS pipeline; `metro.config.js` wires it into Metro.

**CSS-wrapped components** in `src/tw/` must be used instead of bare `react-native` primitives — core RN components do not accept `className` directly:

| Import | Components |
|---|---|
| `@/tw` | `View`, `Text`, `Pressable`, `ScrollView`, `TextInput`, `TouchableHighlight`, `Link`, `useCSSVariable` |
| `@/tw/image` | `Image` |
| `@/tw/animated` | `Animated.View` |

**Layout constants** that are used in JS logic (not just styling) live in `src/constants/theme.ts`: `BottomTabInset`, `MaxContentWidth`. `Spacing` and `Colors`/`Fonts` are redundant with Tailwind and should not be used for new code.

`ThemedText`, `ThemedView`, and `useTheme()` are legacy — do not use them for new components.

### `app.json` notes

- `experiments.typedRoutes` and `experiments.reactCompiler` are both enabled.
- Web output is `"static"`.
