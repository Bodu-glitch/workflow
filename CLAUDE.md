# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Backend cho hệ thống quản lý công việc hiện trường (field task management) đa tenant:
- **`be-nestjs/`** — NestJS (TypeScript) REST API, global prefix `/api/v1`
- **`supabase-local/`** — Local Supabase (PostgreSQL 17): DB, Storage, Edge Functions

## Commands

Tất cả lệnh chạy từ `be-nestjs/`:

```bash
# Supabase (chạy từ supabase-local/)
supabase start                    # Khởi động local Supabase
supabase stop                     # Dừng
supabase db reset                 # Reset + apply migrations từ đầu
supabase db push                  # Apply migrations
supabase functions deploy send-notification  # Deploy edge function

# Development
npm run start:dev      # Watch mode (khuyến nghị)
npm run start:debug    # Debug mode với inspector

# Build & Production
npm run build          # Compile TypeScript → dist/
npm run start:prod     # Chạy dist/main

# Testing
npm run test           # Unit tests
npm run test:watch     # Unit tests watch mode
npm run test:cov       # Coverage report
npm run test:e2e       # E2E tests (jest-e2e.json)
npx jest src/path/to/file.spec.ts  # Single test file

# Code quality
npm run lint           # ESLint + auto-fix
npm run format         # Prettier
```

## Environment Variables

File `be-nestjs/.env` (gitignored):

```env
SUPABASE_URL=http://localhost:54321
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
PORT=3000

# Email (Resend)
RESEND_API_KEY=<resend-api-key>
RESEND_FROM_EMAIL=onboarding@resend.dev   # default nếu không set
APP_FRONTEND_URL=http://localhost:8081    # dùng để tạo link trong email mời
```

Service role key lấy từ output của `supabase start`.

## Architecture

### Module Structure

```
src/
├── main.ts                    # Bootstrap: global prefix, pipes, filters, interceptors
├── app.module.ts              # Root module: import tất cả feature modules
├── common/
│   ├── decorators/
│   │   ├── current-user.decorator.ts   # @CurrentUser() → user từ JWT
│   │   └── roles.decorator.ts          # @Roles('business_owner', ...)
│   ├── guards/
│   │   ├── jwt-auth.guard.ts           # Validate via supabase.db.auth.getUser(token) + X-Tenant-ID header
│   │   └── roles.guard.ts             # Check role từ req.user
│   ├── filters/
│   │   └── http-exception.filter.ts   # Format: { error: { code, message } }
│   ├── interceptors/
│   │   └── response.interceptor.ts    # Wrap: { data, meta }
│   ├── dto/
│   │   └── pagination.dto.ts          # page, limit
│   └── utils/
│       └── haversine.util.ts          # GPS distance (meters)
├── supabase/
│   ├── supabase.module.ts     # Global module
│   └── supabase.service.ts    # createClient() với service role key
├── redis/
│   └── redis.service.ts       # OTP + generic key/value (set/get/delete)
├── auth/                      # /auth/*
├── admin/                     # /admin/* (superadmin only)
├── staff/                     # /staff/*
├── tasks/                     # /tasks/*
├── me/                        # /me/tasks/* (staff view)
├── audit/                     # /audit/* (BO/OT only, read-only)
└── notifications/             # /notifications/*
```

### API Routes

| Method | Route | Auth | Mô tả |
|--------|-------|------|-------|
| POST | `/auth/google` | public | Validate Google token, trả profile + tenants |
| POST | `/auth/complete-google-onboarding` | JWT | User Google mới tạo workspace lần đầu |
| POST | `/auth/create-tenant` | JWT | Tạo tenant thêm (multi-tenant) |
| POST | `/auth/logout` | any | Xóa device_token |
| GET | `/auth/profile` | any | Thông tin user; trả `{ requires_onboarding: true }` nếu chưa có tenant |
| PATCH | `/auth/device-token` | any | Cập nhật Expo push token |
| GET | `/admin/tenants` | superadmin | Danh sách tenant |
| POST | `/admin/tenants` | superadmin | Tạo tenant |
| PATCH | `/admin/tenants/:id` | superadmin | Cập nhật tenant |
| DELETE | `/admin/tenants/:id` | superadmin | Deactivate tenant |
| GET | `/admin/users` | superadmin | Danh sách user |
| POST | `/admin/users` | superadmin | Tạo BO/Operator (insert users + user_tenants) |
| PATCH | `/admin/users/:id/activate` | superadmin | Kích hoạt user |
| PATCH | `/admin/users/:id/deactivate` | superadmin | Vô hiệu user |
| POST | `/staff/accept-invitation-google` | public | Chấp nhận lời mời qua Google token + invitation token |
| POST | `/staff/invite` | BO/OT | Mời staff (xem Invitation Flow bên dưới) |
| GET | `/staff` | BO/OT | Danh sách staff trong tenant |
| GET | `/staff/invitations` | BO/OT | Danh sách lời mời của tenant |
| GET | `/staff/my-invitations` | any | Lời mời in-app đang pending của mình |
| POST | `/staff/invite/:id/resend` | BO/OT | Gửi lại lời mời |
| PATCH | `/staff/invitations/:id/accept` | any | Chấp nhận lời mời in-app (mobile) |
| PATCH | `/staff/invitations/:id/decline` | any | Từ chối lời mời in-app |
| DELETE | `/staff/:id` | BO/OT | Xóa staff khỏi tenant |
| GET | `/tasks/dashboard` | BO/OT | Thống kê theo status + overdue |
| GET | `/tasks` | any | Danh sách task (filter: status, priority, from, to) |
| POST | `/tasks` | BO/OT | Tạo task (+ assignee_ids) |
| GET | `/tasks/:id` | any | Chi tiết task |
| PATCH | `/tasks/:id` | BO/OT | Cập nhật task |
| POST | `/tasks/:id/assign` | BO/OT | Gán thêm assignees |
| DELETE | `/tasks/:id/assign/:staffId` | BO/OT | Bỏ gán |
| PATCH | `/tasks/:id/cancel` | BO/OT | Hủy task |
| PATCH | `/tasks/:id/reject` | BO/OT | Từ chối task |
| POST | `/tasks/:id/checkin` | staff | Check-in (multipart: photo + GPS) |
| POST | `/tasks/:id/checkout` | staff | Check-out (multipart: photo + GPS) |
| GET | `/me/tasks` | staff | Task được gán cho mình |
| GET | `/me/tasks/history` | staff | Lịch sử task (done/cancelled/rejected) |
| GET | `/audit/tasks/:id` | BO/OT | Audit log của task |
| GET | `/audit/staff/:id` | BO/OT | Audit log của staff |
| GET | `/audit` | BO/OT | Toàn bộ audit log của tenant |
| GET | `/notifications` | any | Danh sách thông báo |
| GET | `/notifications/unread-count` | any | Số thông báo chưa đọc |
| PATCH | `/notifications/read-all` | any | Đánh dấu tất cả đã đọc |
| PATCH | `/notifications/:id/read` | any | Đánh dấu đã đọc |

### Roles & Permissions

```
superadmin     → quản lý toàn hệ thống (tenant, BO); tenant_id = null trong JWT
business_owner → quản lý trong tenant của mình
operator       → tương tự BO nhưng hạn chế hơn
staff          → nhân viên hiện trường, chỉ thấy task được gán
```

Token: Supabase JWT (ES256), validate bằng `supabase.db.auth.getUser(token)`.
Tenant context: header `X-Tenant-ID` → guard lookup `user_tenants` → inject `req.user = { id, email, role, tenant_id }`.

### User-Tenant Many-to-Many

Một user có thể thuộc nhiều tenant với role khác nhau ở mỗi tenant.

- `users.role` chỉ dùng để identify superadmin (không có tenant membership)
- Tất cả role khác lưu trong `user_tenants.role`
- **Bắt buộc** filter `tenant_id` trong mọi query liên quan đến tenant context

Khi query staff/managers trong một tenant, dùng `user_tenants` thay vì `users`:
```ts
// Lấy managers của tenant
.from('user_tenants')
.select('user_id')
.eq('tenant_id', tenantId)
.in('role', ['business_owner', 'operator'])
.eq('is_active', true)

// Lấy staff list
.from('user_tenants')
.select('role, is_active, users!inner(id, email, full_name, ...)')
.eq('tenant_id', tenantId)
```

### Authentication Flow

Chỉ dùng **Google OAuth** (PKCE). Không có email/password.

**Login / Đăng ký lần đầu (Google):**
1. Frontend gọi `supabase.auth.signInWithOAuth({ provider: 'google' })` → redirect sang Google
2. Google callback → Supabase trả Supabase JWT
3. Frontend gọi `GET /auth/profile` với Supabase JWT
   - User đã có tenant → trả profile bình thường → navigate home theo role
   - User chưa có tenant (mới) → trả `{ requires_onboarding: true }` → frontend redirect `/setup-tenant`
4. `/setup-tenant`: gọi `POST /auth/complete-google-onboarding { access_token, tenant_name, tenant_slug? }`
   - Tạo tenant + insert `user_tenants` role `business_owner`
   - Trả `{ access_token, user, tenant }`
   - `tenant_slug` auto-generate nếu không truyền; lỗi `SLUG_ALREADY_EXISTS` nếu trùng

**Chọn tenant (multi-tenant):**
- Frontend lưu `tenant_id` vào local storage (`X-Tenant-ID` header cho mọi request sau đó)
- `GET /auth/profile` + header `X-Tenant-ID` → trả profile với `role` từ `user_tenants`

**Superadmin:**
- Vẫn dùng Supabase password auth nội bộ; không có tenant_id trong header

### Invitation Flow

Khi `POST /staff/invite`:
- **User đã có tài khoản** (email tồn tại trong `public.users`) → tạo invitation `delivery='in_app'`, đồng thời:
  - Gửi push notification `invitation_received`
  - Gửi email với link `{APP_FRONTEND_URL}/accept-invitation?token=...`
- **User chưa có tài khoản** → tạo invitation `delivery='email'`, gửi email với link `{APP_FRONTEND_URL}/accept-invitation?token=...`

Accept invitation — hai cách:
1. **Mobile app** (authenticated, existing user): `PATCH /staff/invitations/:id/accept` — dùng `id` của invitation, yêu cầu JWT
2. **Email link** (new user hoặc existing): `POST /staff/accept-invitation-google { access_token, invitation_token }` — public, không cần auth trước
   - Validate Google token → lấy email → khớp với invitation email
   - Upsert `public.users`, insert `user_tenants`, đánh dấu invitation `accepted`
   - Trả `{ user, tenant }`

Frontend `/accept-invitation?token=`: hiện nút "Đăng nhập với Google để chấp nhận" → lưu token vào `sessionStorage` → OAuth → callback tự động gọi `accept-invitation-google`.

### File Upload (Supabase Storage)

Bucket: `checkin-photos` (phải tạo thủ công qua Supabase Studio hoặc migration).
Path: `{tenant_id}/{task_id}/{checkin|checkout}/{timestamp}.{ext}`

### GPS Verification (Haversine)

Checkin/checkout kiểm tra khoảng cách GPS với vị trí task. Nếu vượt `location_radius_m` → throw `GPS_OUT_OF_RANGE`.

### Notifications (Edge Function)

`NotificationsService.sendPushNotification()` → gọi Edge Function `send-notification` qua HTTP.
Edge function: insert vào bảng `notifications` + gửi Expo push notification nếu có `EXPO_ACCESS_TOKEN`.

### Audit Logs

Immutable — chỉ INSERT, không bao giờ UPDATE/DELETE.
Actions: `task_created`, `task_updated`, `task_assigned`, `task_cancelled`, `task_rejected`, `checkin`, `checkout`, `member_invited`, `member_removed`, `status_changed`, `task_completed`

### Route Order (Quan trọng)

Routes cụ thể phải đăng ký **trước** route có param:
- `GET /tasks/dashboard` trước `GET /tasks/:id`
- `GET /me/tasks/history` trước `GET /me/tasks`
- `GET /staff/my-invitations` trước `GET /staff/:id`
- `GET /staff/invitations` trước `GET /staff/:id`
- `PATCH /staff/accept-invitation/:token` trước `DELETE /staff/:id`
- `GET /notifications/unread-count` trước `GET /notifications/:id/read`

## Database Schema

Migration: `supabase-local/supabase/migrations/20260319000000_initial_schema.sql`

### Bảng chính

| Bảng | Mô tả |
|------|-------|
| `tenants` | Tenant organizations |
| `users` | User accounts (không có tenant_id; role chỉ dùng cho superadmin) |
| `user_tenants` | Many-to-many: user ↔ tenant, lưu role từng tenant |
| `invitations` | Lời mời (delivery: email hoặc in_app) |
| `tasks` | Công việc hiện trường |
| `task_assignments` | User được gán vào task |
| `checkins` | Checkin/checkout records |
| `audit_logs` | Immutable audit trail |
| `notifications` | In-app notifications |

### Enums

- `user_role`: `superadmin`, `business_owner`, `operator`, `staff`
- `task_status`: `todo`, `in_progress`, `done`, `cancelled`, `rejected`
- `task_priority`: `low`, `medium`, `high`, `urgent`
- `invitation_status`: `pending`, `accepted`, `cancelled`, `expired`
- `invitation_delivery`: `email`, `in_app`
- `notification_type`: `task_assigned`, `task_updated`, `status_changed`, `task_completed`, `task_rejected`, `task_cancelled`, `reminder`, `invitation_received`
- `tenant_status`: `active`, `inactive`, `suspended`

## Supabase Local Setup

`supabase-local/supabase/config.toml`:
- REST API: port **54321**
- PostgreSQL 17: port **54322**
- Supabase Studio: port **54323**
- Inbucket (email test): port **54324**
- Storage: 50MiB limit

Edge Function: `supabase-local/supabase/functions/send-notification/index.ts`

Seed superadmin: `superadmin@system.local` / `superadmin123`

## TypeScript Configuration

- Target: ES2023, `moduleResolution: nodenext`
- Import internal modules phải có `.js` extension (e.g. `import { X } from './x.js'`)
- Strict null checks enabled, decorator metadata emitted (required by NestJS)
- ESLint flat config (`eslint.config.mjs`): `@typescript-eslint/no-explicit-any` disabled
- Prettier: single quotes, trailing commas everywhere

## Error Response Format

```json
{ "error": { "code": "TASK_NOT_FOUND", "message": "Task not found" } }
```

Common codes: `INVALID_CREDENTIALS`, `INVALID_SESSION`, `TASK_NOT_FOUND`, `GPS_OUT_OF_RANGE`, `EMAIL_ALREADY_EXISTS`, `SLUG_ALREADY_EXISTS`, `TASK_ALREADY_STARTED`, `NOT_ASSIGNEE`, `FORBIDDEN`, `INVALID_OTP`, `INVALID_TOKEN`, `INVITATION_NOT_FOUND`, `TOKEN_EXPIRED`

## Success Response Format

```json
{ "data": { ... } }
{ "data": [...], "meta": { "total": 100, "page": 1, "limit": 20 } }
```
