# API Documentation — Field Task Management

> Dành cho Frontend Mobile (React Native / Expo)

## Mục lục

1. [Tổng quan](#1-tổng-quan)
2. [Authentication](#2-authentication)
3. [Auth APIs](#3-auth-apis)
4. [Staff APIs](#4-staff-apis)
5. [Task APIs](#5-task-apis)
6. [Me APIs (Staff view)](#6-me-apis-staff-view)
7. [Notification APIs](#7-notification-apis)
8. [Audit APIs](#8-audit-apis)
9. [Admin APIs](#9-admin-apis-superadmin)
10. [Error Codes](#10-error-codes)
11. [Enums](#11-enums)

---

## 1. Tổng quan

### Base URL

```
http://<host>:3000/api/v1
```

### Request Headers

```
Content-Type: application/json
Authorization: Bearer <access_token>   ← bắt buộc với mọi route yêu cầu auth
```

### Response format thành công

```json
{ "data": { ... } }
{ "data": [...], "meta": { "total": 100, "page": 1, "limit": 20 } }
```

### Response format lỗi

```json
{
  "error": {
    "code": "TASK_NOT_FOUND",
    "message": "Task not found"
  }
}
```

### Pagination (Query params)

| Param | Type | Default | Mô tả |
|-------|------|---------|-------|
| `page` | number | 1 | Trang hiện tại |
| `limit` | number | 20 | Số item mỗi trang |

---

## 2. Authentication

### Roles

| Role | Mô tả |
|------|-------|
| `superadmin` | Quản trị toàn hệ thống, không thuộc tenant |
| `business_owner` | Quản lý tenant (BO) |
| `operator` | Vận hành trong tenant (OT) |
| `staff` | Nhân viên hiện trường |

### JWT Payload

```json
{
  "sub": "uuid",
  "email": "user@example.com",
  "role": "staff",
  "tenant_id": "uuid"
}
```

`tenant_id` là `null` với `superadmin`.

---

## 3. Auth APIs

### 3.1 Tự đăng ký (tạo account + tenant mới)

```
POST /auth/register
```

> Không cần auth. Tạo tài khoản mới kèm tenant của riêng mình, tự động trở thành `business_owner`.

**Request Body**

```json
{
  "email": "owner@company.com",
  "password": "secret123",
  "full_name": "Nguyen Van A",
  "tenant_name": "Công ty ABC",
  "tenant_slug": "cong-ty-abc"
}
```

| Field | Required | Mô tả |
|-------|----------|-------|
| `email` | ✅ | Email hợp lệ |
| `password` | ✅ | Tối thiểu 6 ký tự |
| `full_name` | ✅ | Họ tên |
| `tenant_name` | ✅ | Tên công ty/tổ chức |
| `tenant_slug` | ❌ | Chỉ `[a-z0-9-]`, tối đa 50 ký tự. Nếu bỏ trống: auto-generate từ `tenant_name` (bỏ dấu tiếng Việt, lowercase) |

**Response 201**

```json
{
  "data": {
    "access_token": "eyJhbGci...",
    "user": {
      "id": "uuid",
      "email": "owner@company.com",
      "full_name": "Nguyen Van A",
      "role": "business_owner",
      "tenant_id": "uuid"
    },
    "tenant": {
      "id": "uuid",
      "name": "Công ty ABC",
      "slug": "cong-ty-abc"
    }
  }
}
```

**Lỗi**

| Code | HTTP | Nguyên nhân |
|------|------|-------------|
| `EMAIL_ALREADY_EXISTS` | 409 | Email đã được đăng ký |
| `SLUG_ALREADY_EXISTS` | 409 | Slug tenant đã tồn tại |

---

### 3.2 Đăng nhập

```
POST /auth/login
```

> Không cần auth.

**Request Body**

```json
{
  "email": "user@example.com",
  "password": "secret123"
}
```

**Response — 1 tenant (đăng nhập luôn)**

```json
{
  "data": {
    "access_token": "eyJhbGci...",
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "full_name": "Nguyen Van A",
      "role": "staff",
      "tenant_id": "uuid",
      "avatar_url": null
    },
    "tenants": [
      { "id": "uuid", "name": "Công ty ABC", "slug": "cong-ty-abc", "role": "staff" }
    ]
  }
}
```

**Response — Nhiều tenant (cần chọn)**

```json
{
  "data": {
    "user": { "id": "uuid", "email": "user@example.com", "full_name": "..." },
    "tenants": [
      { "id": "uuid1", "name": "Công ty A", "slug": "cong-ty-a", "role": "staff" },
      { "id": "uuid2", "name": "Công ty B", "slug": "cong-ty-b", "role": "operator" }
    ],
    "requires_tenant_selection": true
  }
}
```

Khi `requires_tenant_selection: true` → gọi tiếp `POST /auth/select-tenant`.

**Response — Superadmin**

```json
{
  "data": {
    "access_token": "eyJhbGci...",
    "user": {
      "id": "uuid",
      "email": "superadmin@system.local",
      "full_name": "...",
      "role": "superadmin",
      "tenant_id": null
    }
  }
}
```

**Lỗi**

| Code | HTTP | Nguyên nhân |
|------|------|-------------|
| `INVALID_CREDENTIALS` | 401 | Sai email/mật khẩu |
| `FORBIDDEN` | 403 | Tài khoản không thuộc tenant nào đang active |

---

### 3.3 Đăng nhập Google

```
POST /auth/google
```

> Không cần auth.

**Request Body**

```json
{
  "id_token": "google-id-token",
  "access_token": "google-access-token"
}
```

`access_token` optional.

**Response**: Tương tự `POST /auth/login`.

---

### 3.4 Chọn tenant (khi có nhiều tenant)

```
POST /auth/select-tenant
```

> Không cần auth. Chỉ gọi khi login trả `requires_tenant_selection: true`. Session tạm thời hết hạn sau 5 phút.

**Request Body**

```json
{
  "user_id": "uuid",
  "tenant_id": "uuid"
}
```

**Response 200**

```json
{
  "data": {
    "access_token": "eyJhbGci...",
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "full_name": "...",
      "role": "operator",
      "tenant_id": "uuid"
    }
  }
}
```

**Lỗi**

| Code | HTTP | Nguyên nhân |
|------|------|-------------|
| `INVALID_SESSION` | 401 | Session hết hạn (>5 phút) hoặc không tồn tại |
| `FORBIDDEN` | 403 | User không phải thành viên của tenant này |

---

### 3.5 Đăng xuất

```
POST /auth/logout
```

> Yêu cầu auth. Xóa `device_token` khỏi DB (ngừng nhận push notification).

**Response 200**

```json
{ "data": { "message": "Logged out successfully" } }
```

---

### 3.6 Thông tin cá nhân

```
GET /auth/profile
```

> Yêu cầu auth.

**Response 200**

```json
{
  "data": {
    "id": "uuid",
    "email": "user@example.com",
    "full_name": "Nguyen Van A",
    "role": "staff",
    "phone": "0912345678",
    "avatar_url": "https://...",
    "last_login_at": "2026-03-20T10:00:00Z",
    "created_at": "2026-01-01T00:00:00Z",
    "tenant_id": "uuid"
  }
}
```

---

### 3.7 Đổi mật khẩu

```
PATCH /auth/change-password
```

> Yêu cầu auth.

**Request Body**

```json
{
  "current_password": "old123",
  "new_password": "new456",
  "confirm_password": "new456"
}
```

**Response 200**

```json
{ "data": { "message": "Password changed successfully" } }
```

**Lỗi**

| Code | HTTP | Nguyên nhân |
|------|------|-------------|
| `PASSWORD_MISMATCH` | 400 | `new_password` ≠ `confirm_password` |
| `INVALID_PASSWORD` | 400 | `current_password` sai |

---

### 3.8 Quên mật khẩu (gửi OTP)

```
POST /auth/forgot-password
```

> Không cần auth. Gửi OTP 6 số qua email, hết hạn sau 10 phút.

**Request Body**

```json
{ "email": "user@example.com" }
```

**Response 200**

```json
{ "data": { "message": "If that email exists, an OTP has been sent" } }
```

> Luôn trả 200 dù email không tồn tại (bảo mật).

---

### 3.9 Đặt lại mật khẩu bằng OTP

```
POST /auth/reset-password
```

> Không cần auth.

**Request Body**

```json
{
  "email": "user@example.com",
  "otp": "123456",
  "new_password": "newpass123",
  "confirm_password": "newpass123"
}
```

**Response 200**

```json
{ "data": { "message": "Password reset successfully" } }
```

**Lỗi**

| Code | HTTP | Nguyên nhân |
|------|------|-------------|
| `PASSWORD_MISMATCH` | 400 | Mật khẩu nhập lại không khớp |
| `INVALID_OTP` | 400 | OTP sai hoặc hết hạn |

---

### 3.10 Cập nhật Expo Push Token

```
PATCH /auth/device-token
```

> Yêu cầu auth. Gọi sau mỗi lần đăng nhập để đăng ký nhận push notification.

**Request Body**

```json
{ "device_token": "ExponentPushToken[xxxxxx]" }
```

Để hủy đăng ký (sau khi logout):

```json
{ "device_token": null }
```

**Response 200**

```json
{ "data": { "message": "Device token updated" } }
```

---

## 4. Staff APIs

### 4.1 Đăng ký tài khoản qua email invitation

```
POST /staff/register
```

> Không cần auth. Dành cho người được mời qua email (chưa có tài khoản). Token lấy từ link trong email (`/register?token=...`).

**Request Body**

```json
{
  "token": "abc123hex...",
  "full_name": "Tran Thi B",
  "password": "mypass123",
  "phone": "0987654321"
}
```

| Field | Required | Mô tả |
|-------|----------|-------|
| `token` | ✅ | Token từ email invitation |
| `full_name` | ✅ | Họ tên |
| `password` | ✅ | Tối thiểu 6 ký tự |
| `phone` | ❌ | Số điện thoại |

**Response 200**

```json
{
  "data": {
    "access_token": "eyJhbGci...",
    "user": {
      "id": "uuid",
      "email": "staff@example.com",
      "full_name": "Tran Thi B",
      "role": "staff",
      "tenant_id": "uuid"
    }
  }
}
```

**Lỗi**

| Code | HTTP | Nguyên nhân |
|------|------|-------------|
| `INVALID_TOKEN` | 400 | Token không hợp lệ hoặc đã được dùng |
| `TOKEN_EXPIRED` | 400 | Token hết hạn (>24h) |
| `EMAIL_ALREADY_EXISTS` | 409 | Email đã được đăng ký |

---

### 4.2 Mời staff

```
POST /staff/invite
```

> Yêu cầu auth. Roles: `business_owner`, `operator`.

**Luồng xử lý:**
- **User chưa có tài khoản** → tạo invitation `delivery=email`, gửi email với link đăng ký
- **User đã có tài khoản** → tạo invitation `delivery=in_app`, gửi push notification + email với link chấp nhận

**Request Body**

```json
{
  "email": "newstaff@example.com",
  "role": "staff"
}
```

| Field | Required | Mô tả |
|-------|----------|-------|
| `email` | ✅ | Email người được mời |
| `role` | ❌ | `staff` (default) hoặc `operator` |

**Response 200**

```json
{
  "data": {
    "message": "Invitation sent via push and email",
    "invitation_id": "uuid"
  }
}
```

**Lỗi**

| Code | HTTP | Nguyên nhân |
|------|------|-------------|
| `EMAIL_ALREADY_EXISTS` | 409 | User đã là thành viên của tenant này |

---

### 4.3 Chấp nhận lời mời qua email link (public)

```
PATCH /staff/accept-invitation/:token
```

> Không cần auth. Dành cho user đã có tài khoản click vào link trong email (`/accept-invitation?token=...`). Token chính là giá trị `token` của invitation.

**Response 200**

```json
{ "data": { "message": "Invitation accepted" } }
```

**Lỗi**

| Code | HTTP | Nguyên nhân |
|------|------|-------------|
| `INVALID_TOKEN` | 400 | Token không hợp lệ |
| `TOKEN_EXPIRED` | 400 | Invitation hết hạn (>24h) |

---

### 4.4 Chấp nhận lời mời in-app (mobile)

```
PATCH /staff/invitations/:id/accept
```

> Yêu cầu auth. Dùng `id` của invitation (lấy từ `GET /staff/my-invitations`).

**Response 200**

```json
{ "data": { "message": "Invitation accepted" } }
```

**Lỗi**

| Code | HTTP | Nguyên nhân |
|------|------|-------------|
| `INVITATION_NOT_FOUND` | 404 | Không tìm thấy hoặc không phải lời mời của mình |
| `TOKEN_EXPIRED` | 400 | Lời mời hết hạn |

---

### 4.5 Từ chối lời mời in-app

```
PATCH /staff/invitations/:id/decline
```

> Yêu cầu auth.

**Response 200**

```json
{ "data": { "message": "Invitation declined" } }
```

---

### 4.6 Lời mời đang chờ của tôi

```
GET /staff/my-invitations
```

> Yêu cầu auth. Lấy danh sách lời mời in-app đang `pending` gửi đến tài khoản mình.

**Response 200**

```json
{
  "data": {
    "data": [
      {
        "id": "uuid",
        "tenant_id": "uuid",
        "email": "me@example.com",
        "role": "staff",
        "delivery": "in_app",
        "status": "pending",
        "expires_at": "2026-03-21T10:00:00Z",
        "created_at": "2026-03-20T10:00:00Z",
        "tenants": {
          "id": "uuid",
          "name": "Công ty ABC",
          "slug": "cong-ty-abc"
        }
      }
    ]
  }
}
```

---

### 4.7 Danh sách staff trong tenant

```
GET /staff?page=1&limit=20
```

> Yêu cầu auth. Roles: `business_owner`, `operator`. Trả về staff và operator, không trả business_owner.

**Response 200**

```json
{
  "data": {
    "data": [
      {
        "id": "uuid",
        "email": "staff@example.com",
        "full_name": "Tran Thi B",
        "phone": "0987...",
        "avatar_url": null,
        "last_login_at": "2026-03-19T08:00:00Z",
        "role": "staff",
        "is_active": true,
        "created_at": "2026-01-15T00:00:00Z"
      }
    ],
    "meta": { "total": 50, "page": 1, "limit": 20 }
  }
}
```

---

### 4.8 Danh sách lời mời của tenant

```
GET /staff/invitations?page=1&limit=20
```

> Yêu cầu auth. Roles: `business_owner`, `operator`.

**Response 200**

```json
{
  "data": {
    "data": [
      {
        "id": "uuid",
        "email": "invited@example.com",
        "role": "staff",
        "delivery": "email",
        "status": "pending",
        "expires_at": "2026-03-21T10:00:00Z",
        "created_at": "2026-03-20T10:00:00Z"
      }
    ],
    "meta": { "total": 5, "page": 1, "limit": 20 }
  }
}
```

---

### 4.9 Gửi lại lời mời

```
POST /staff/invite/:id/resend
```

> Yêu cầu auth. Roles: `business_owner`, `operator`. Hủy lời mời cũ, tạo lời mời mới với token mới (24h mới).

**Response 200**

```json
{
  "data": {
    "message": "Invitation resent",
    "invitation_id": "uuid"
  }
}
```

---

### 4.10 Xóa staff khỏi tenant

```
DELETE /staff/:id
```

> Yêu cầu auth. Roles: `business_owner`, `operator`. Chỉ xóa được `staff` và `operator`.

**Response 200**

```json
{ "data": { "message": "Staff member removed" } }
```

**Lỗi**

| Code | HTTP | Nguyên nhân |
|------|------|-------------|
| `USER_NOT_FOUND` | 404 | Không tìm thấy staff trong tenant |
| `FORBIDDEN` | 403 | Cố xóa business_owner |

---

## 5. Task APIs

### 5.1 Dashboard thống kê

```
GET /tasks/dashboard?from=2026-03-01&to=2026-03-31
```

> Yêu cầu auth. Roles: `business_owner`, `operator`.

**Query Params**

| Param | Type | Mô tả |
|-------|------|-------|
| `from` | ISO date | Lọc từ ngày tạo task |
| `to` | ISO date | Lọc đến ngày tạo task |

**Response 200**

```json
{
  "data": {
    "summary": {
      "todo": 10,
      "in_progress": 5,
      "done": 30,
      "cancelled": 2,
      "rejected": 1,
      "overdue": 3
    }
  }
}
```

> `overdue`: task chưa xong (`todo`/`in_progress`) đã quá `deadline`.

---

### 5.2 Danh sách task

```
GET /tasks?page=1&limit=20&status=todo&priority=high&assignee_id=uuid&from=2026-03-01&to=2026-03-31
```

> Yêu cầu auth. Tất cả roles. Chỉ thấy task trong tenant của mình.

**Query Params**

| Param | Type | Mô tả |
|-------|------|-------|
| `status` | string | `todo` / `in_progress` / `done` / `cancelled` / `rejected` |
| `priority` | string | `low` / `medium` / `high` / `urgent` |
| `assignee_id` | uuid | Lọc task được gán cho user cụ thể |
| `from` | ISO date | Lọc từ ngày tạo |
| `to` | ISO date | Lọc đến ngày tạo |

**Response 200**

```json
{
  "data": {
    "data": [
      {
        "id": "uuid",
        "title": "Kiểm tra trạm điện",
        "description": "Kiểm tra định kỳ tháng 3",
        "status": "todo",
        "priority": "high",
        "location_name": "Trạm điện Q1",
        "location_lat": 10.762622,
        "location_lng": 106.660172,
        "location_radius_m": 100,
        "scheduled_at": "2026-03-21T08:00:00Z",
        "deadline": "2026-03-21T17:00:00Z",
        "cancel_reason": null,
        "tenant_id": "uuid",
        "created_by": "uuid",
        "created_at": "2026-03-20T10:00:00Z",
        "updated_at": "2026-03-20T10:00:00Z",
        "creator": { "id": "uuid", "full_name": "Nguyen Van A" },
        "task_assignments": [
          {
            "user_id": "uuid",
            "users": { "id": "uuid", "full_name": "Tran Thi B", "avatar_url": null }
          }
        ]
      }
    ],
    "meta": { "total": 100, "page": 1, "limit": 20 }
  }
}
```

---

### 5.3 Tạo task

```
POST /tasks
```

> Yêu cầu auth. Roles: `business_owner`, `operator`.

**Request Body**

```json
{
  "title": "Kiểm tra trạm điện",
  "description": "Kiểm tra định kỳ tháng 3",
  "priority": "high",
  "location_name": "Trạm điện Q1",
  "location_lat": 10.762622,
  "location_lng": 106.660172,
  "location_radius_m": 100,
  "scheduled_at": "2026-03-21T08:00:00Z",
  "deadline": "2026-03-21T17:00:00Z",
  "assignee_ids": ["uuid1", "uuid2"]
}
```

| Field | Required | Default | Mô tả |
|-------|----------|---------|-------|
| `title` | ✅ | — | Tên task |
| `description` | ❌ | null | Mô tả |
| `priority` | ❌ | `medium` | `low` / `medium` / `high` / `urgent` |
| `location_name` | ❌ | null | Tên địa điểm |
| `location_lat` | ❌ | null | Vĩ độ (decimal degrees) |
| `location_lng` | ❌ | null | Kinh độ (decimal degrees) |
| `location_radius_m` | ❌ | 100 | Bán kính GPS hợp lệ (mét) |
| `scheduled_at` | ❌ | null | Thời gian dự kiến (ISO 8601) |
| `deadline` | ❌ | null | Hạn hoàn thành (ISO 8601) |
| `assignee_ids` | ❌ | [] | Mảng UUID của staff cần gán |

**Response 201**: Task object đầy đủ.

> Staff được gán sẽ nhận push notification `task_assigned`.

---

### 5.4 Chi tiết task

```
GET /tasks/:id
```

> Yêu cầu auth. Tất cả roles (chỉ trong tenant của mình).

**Response 200**

```json
{
  "data": {
    "id": "uuid",
    "title": "Kiểm tra trạm điện",
    "description": "...",
    "status": "in_progress",
    "priority": "high",
    "location_name": "Trạm điện Q1",
    "location_lat": 10.762622,
    "location_lng": 106.660172,
    "location_radius_m": 100,
    "scheduled_at": "2026-03-21T08:00:00Z",
    "deadline": "2026-03-21T17:00:00Z",
    "cancel_reason": null,
    "created_at": "2026-03-20T10:00:00Z",
    "updated_at": "2026-03-21T08:15:00Z",
    "creator": { "id": "uuid", "full_name": "Nguyen Van A" },
    "task_assignments": [
      {
        "user_id": "uuid",
        "users": { "id": "uuid", "full_name": "Tran Thi B", "avatar_url": null }
      }
    ],
    "checkins": [
      {
        "id": "uuid",
        "type": "checkin",
        "gps_lat": 10.762622,
        "gps_lng": 106.660172,
        "gps_verified": true,
        "photo_url": "https://...",
        "notes": "Đã đến nơi",
        "created_at": "2026-03-21T08:15:00Z"
      }
    ]
  }
}
```

**Lỗi**

| Code | HTTP | Nguyên nhân |
|------|------|-------------|
| `TASK_NOT_FOUND` | 404 | Không tìm thấy hoặc sai tenant |

---

### 5.5 Cập nhật task

```
PATCH /tasks/:id
```

> Yêu cầu auth. Roles: `business_owner`, `operator`. Không thể sửa task đã `done`, `cancelled`, `rejected`.

**Request Body** (tất cả optional):

```json
{
  "title": "Tên mới",
  "description": "Mô tả mới",
  "priority": "urgent",
  "location_name": "Địa điểm mới",
  "location_lat": 10.8,
  "location_lng": 106.7,
  "location_radius_m": 150,
  "scheduled_at": "2026-03-22T08:00:00Z",
  "deadline": "2026-03-22T17:00:00Z"
}
```

**Response 200**: Task object đã cập nhật.

**Lỗi**

| Code | HTTP | Nguyên nhân |
|------|------|-------------|
| `TASK_ALREADY_CLOSED` | 422 | Task đã kết thúc (done/cancelled/rejected) |

---

### 5.6 Gán thêm assignees

```
POST /tasks/:id/assign
```

> Yêu cầu auth. Roles: `business_owner`, `operator`. Bỏ qua user đã được gán.

**Request Body**

```json
{ "assignee_ids": ["uuid1", "uuid2"] }
```

**Response 200**

```json
{
  "data": {
    "message": "Task assigned",
    "new_assignees": 1
  }
}
```

---

### 5.7 Bỏ gán assignee

```
DELETE /tasks/:id/assign/:staffId
```

> Yêu cầu auth. Roles: `business_owner`, `operator`.

**Response 200**

```json
{ "data": { "message": "User unassigned from task" } }
```

---

### 5.8 Hủy task

```
PATCH /tasks/:id/cancel
```

> Yêu cầu auth. Roles: `business_owner`, `operator`.

**Request Body**

```json
{ "cancel_reason": "Khách hàng hủy yêu cầu" }
```

**Response 200**: Task object với `status: "cancelled"`.

**Lỗi**

| Code | HTTP | Nguyên nhân |
|------|------|-------------|
| `CANNOT_CANCEL` | 422 | Task đã done hoặc rejected |
| `ALREADY_CANCELLED` | 422 | Task đã cancelled rồi |

---

### 5.9 Từ chối task

```
PATCH /tasks/:id/reject
```

> Yêu cầu auth. Roles: `business_owner`, `operator`.

**Request Body**

```json
{ "reason": "Không đủ nguồn lực" }
```

`reason` optional.

**Response 200**: Task object với `status: "rejected"`.

**Lỗi**

| Code | HTTP | Nguyên nhân |
|------|------|-------------|
| `CANNOT_REJECT` | 422 | Task đã done hoặc cancelled |

---

### 5.10 Check-in

```
POST /tasks/:id/checkin
Content-Type: multipart/form-data
```

> Yêu cầu auth. Staff phải là assignee của task. Task phải ở trạng thái `todo`. Sau checkin → `in_progress`.

**Form Data**

| Field | Type | Required | Mô tả |
|-------|------|----------|-------|
| `photo` | file | ❌ | Ảnh chụp tại hiện trường (image/*) |
| `gps_lat` | number | ❌ | Vĩ độ hiện tại |
| `gps_lng` | number | ❌ | Kinh độ hiện tại |
| `notes` | string | ❌ | Ghi chú |

> Nếu task có tọa độ và user cung cấp GPS → hệ thống tự kiểm tra khoảng cách. Nếu vượt `location_radius_m` → lỗi `GPS_OUT_OF_RANGE`.

**Response 200**

```json
{
  "data": {
    "id": "uuid",
    "task_id": "uuid",
    "user_id": "uuid",
    "type": "checkin",
    "gps_lat": 10.762622,
    "gps_lng": 106.660172,
    "gps_verified": true,
    "photo_url": "https://...",
    "notes": "Đã đến nơi",
    "created_at": "2026-03-21T08:15:00Z"
  }
}
```

> BO/OT sẽ nhận push notification `status_changed`.

**Lỗi**

| Code | HTTP | Nguyên nhân |
|------|------|-------------|
| `NOT_ASSIGNEE` | 403 | Không phải assignee của task |
| `TASK_ALREADY_STARTED` | 422 | Task không ở trạng thái `todo` |
| `GPS_OUT_OF_RANGE` | 400 | Khoảng cách GPS vượt giới hạn |

---

### 5.11 Check-out

```
POST /tasks/:id/checkout
Content-Type: multipart/form-data
```

> Yêu cầu auth. Staff phải là assignee. Task phải ở trạng thái `in_progress`. Sau checkout → `done`.

**Form Data**: Tương tự check-in.

**Response 200**: Checkin record với `type: "checkout"`.

> BO/OT sẽ nhận push notification `task_completed`.

**Lỗi**

| Code | HTTP | Nguyên nhân |
|------|------|-------------|
| `NOT_ASSIGNEE` | 403 | Không phải assignee |
| `TASK_NOT_IN_PROGRESS` | 422 | Task không ở trạng thái `in_progress` |
| `GPS_OUT_OF_RANGE` | 400 | Khoảng cách GPS vượt giới hạn |

---

## 6. Me APIs (Staff view)

### 6.1 Task được gán cho tôi

```
GET /me/tasks?page=1&limit=20&status=todo
```

> Yêu cầu auth. Dùng cho màn hình chính của staff.

**Query Params**

| Param | Type | Mô tả |
|-------|------|-------|
| `status` | string | Lọc: `todo`, `in_progress` |

**Response 200**

```json
{
  "data": {
    "data": [
      {
        "id": "uuid",
        "title": "Kiểm tra trạm điện",
        "description": "...",
        "status": "todo",
        "priority": "high",
        "location_name": "Trạm điện Q1",
        "location_lat": 10.762622,
        "location_lng": 106.660172,
        "location_radius_m": 100,
        "scheduled_at": "2026-03-21T08:00:00Z",
        "deadline": "2026-03-21T17:00:00Z",
        "created_at": "2026-03-20T10:00:00Z",
        "updated_at": "2026-03-20T10:00:00Z",
        "creator": { "id": "uuid", "full_name": "Nguyen Van A" }
      }
    ],
    "meta": { "total": 5, "page": 1, "limit": 20 }
  }
}
```

---

### 6.2 Lịch sử task của tôi

```
GET /me/tasks/history?page=1&limit=20
```

> Yêu cầu auth. Task đã kết thúc (`done`, `cancelled`, `rejected`) được gán cho mình. Kèm checkin history.

**Response 200**

```json
{
  "data": {
    "data": [
      {
        "task_id": "uuid",
        "assigned_at": "2026-03-20T10:00:00Z",
        "tasks": {
          "id": "uuid",
          "title": "Kiểm tra trạm điện",
          "status": "done",
          "priority": "medium",
          "deadline": "2026-03-21T17:00:00Z",
          "created_at": "2026-03-20T10:00:00Z",
          "checkins": [
            {
              "type": "checkin",
              "created_at": "2026-03-21T08:15:00Z",
              "gps_verified": true,
              "photo_url": "https://..."
            },
            {
              "type": "checkout",
              "created_at": "2026-03-21T16:30:00Z",
              "gps_verified": true,
              "photo_url": "https://..."
            }
          ]
        }
      }
    ],
    "meta": { "total": 20, "page": 1, "limit": 20 }
  }
}
```

---

## 7. Notification APIs

### 7.1 Danh sách thông báo

```
GET /notifications?page=1&limit=20
```

> Yêu cầu auth.

**Response 200**

```json
{
  "data": {
    "data": [
      {
        "id": "uuid",
        "user_id": "uuid",
        "tenant_id": "uuid",
        "type": "task_assigned",
        "title": "New Task Assigned",
        "body": "You have been assigned to: Kiểm tra trạm điện",
        "task_id": "uuid",
        "is_read": false,
        "created_at": "2026-03-20T10:05:00Z"
      }
    ],
    "meta": { "total": 15, "page": 1, "limit": 20 }
  }
}
```

**Notification types**

| Type | Người nhận | Khi nào |
|------|-----------|---------|
| `task_assigned` | Staff được gán | Tạo task / gán thêm assignee |
| `task_updated` | Staff assignee | Task được cập nhật |
| `status_changed` | BO/OT | Staff checkin |
| `task_completed` | BO/OT | Staff checkout |
| `task_rejected` | Staff | Task bị reject |
| `task_cancelled` | Staff | Task bị cancel |
| `reminder` | Staff | Nhắc nhở deadline |
| `invitation_received` | User | Nhận lời mời tham gia tenant |

---

### 7.2 Số thông báo chưa đọc

```
GET /notifications/unread-count
```

> Yêu cầu auth. Dùng để hiển thị badge trên icon notification.

**Response 200**

```json
{ "data": { "count": 5 } }
```

---

### 7.3 Đánh dấu một thông báo đã đọc

```
PATCH /notifications/:id/read
```

> Yêu cầu auth.

**Response 200**

```json
{ "data": { "message": "Notification marked as read" } }
```

---

### 7.4 Đánh dấu tất cả đã đọc

```
PATCH /notifications/read-all
```

> Yêu cầu auth.

**Response 200**

```json
{ "data": { "message": "All notifications marked as read" } }
```

---

## 8. Audit APIs

> Yêu cầu auth. Roles: `business_owner`, `operator`. Read-only.

### 8.1 Audit log của một task

```
GET /audit/tasks/:id?page=1&limit=20
```

**Response 200**

```json
{
  "data": {
    "data": [
      {
        "id": "uuid",
        "task_id": "uuid",
        "user_id": "uuid",
        "tenant_id": "uuid",
        "action": "checkin",
        "metadata": { "gps_verified": true, "photo_url": "https://..." },
        "created_at": "2026-03-21T08:15:00Z",
        "actor": { "id": "uuid", "full_name": "Tran Thi B", "role": "staff" }
      }
    ],
    "meta": { "total": 5, "page": 1, "limit": 20 }
  }
}
```

---

### 8.2 Audit log của một staff

```
GET /audit/staff/:id?page=1&limit=20
```

**Response 200**: Tương tự, kèm `task: { id, title, status }`.

---

### 8.3 Toàn bộ audit log tenant

```
GET /audit?page=1&limit=20&action=checkin
```

**Query Params**

| Param | Type | Mô tả |
|-------|------|-------|
| `action` | string | Lọc theo action |

**Audit actions**: `task_created` `task_updated` `task_assigned` `task_cancelled` `task_rejected` `checkin` `checkout` `member_invited` `member_removed` `status_changed` `task_completed`

**Response 200**: Tương tự, kèm cả `actor` và `task`.

---

## 9. Admin APIs (superadmin)

> Yêu cầu auth. Role: `superadmin` only. Không dùng trên mobile app thông thường.

### 9.1 Danh sách tenant

```
GET /admin/tenants?page=1&limit=20&status=active
```

`status` optional: `active` / `inactive` / `suspended`

### 9.2 Chi tiết tenant

```
GET /admin/tenants/:id
```

### 9.3 Tạo tenant

```
POST /admin/tenants
```

```json
{ "name": "Công ty XYZ", "slug": "cong-ty-xyz", "settings": {} }
```

### 9.4 Cập nhật tenant

```
PATCH /admin/tenants/:id
```

```json
{ "name": "Tên mới", "status": "suspended" }
```

### 9.5 Deactivate tenant

```
DELETE /admin/tenants/:id
```

### 9.6 Danh sách user

```
GET /admin/users?page=1&limit=20&tenant_id=uuid
```

`tenant_id` optional: nếu truyền → lọc theo tenant, nếu không → toàn bộ user.

### 9.7 Chi tiết user

```
GET /admin/users/:id
```

```json
{
  "data": {
    "id": "uuid",
    "email": "...",
    "full_name": "...",
    "role": "staff",
    "phone": "...",
    "avatar_url": null,
    "is_active": true,
    "last_login_at": "...",
    "created_at": "...",
    "user_tenants": [
      { "tenant_id": "uuid", "role": "staff" }
    ]
  }
}
```

### 9.8 Tạo BO/Operator

```
POST /admin/users
```

```json
{
  "tenant_id": "uuid",
  "email": "bo@example.com",
  "password": "pass123",
  "full_name": "Nguyen Van A",
  "role": "business_owner",
  "phone": "0912345678"
}
```

`role`: `business_owner` (default) hoặc `operator`.

### 9.9 Kích hoạt user

```
PATCH /admin/users/:id/activate
```

### 9.10 Vô hiệu hóa user

```
PATCH /admin/users/:id/deactivate
```

---

## 10. Error Codes

| Code | HTTP | Mô tả |
|------|------|-------|
| `INVALID_CREDENTIALS` | 401 | Sai email/mật khẩu |
| `INVALID_SESSION` | 401 | Session chọn tenant hết hạn |
| `FORBIDDEN` | 403 | Không có quyền thực hiện |
| `NOT_ASSIGNEE` | 403 | Không phải assignee của task |
| `TASK_NOT_FOUND` | 404 | Không tìm thấy task |
| `USER_NOT_FOUND` | 404 | Không tìm thấy user |
| `INVITATION_NOT_FOUND` | 404 | Không tìm thấy lời mời |
| `EMAIL_ALREADY_EXISTS` | 409 | Email đã tồn tại |
| `SLUG_ALREADY_EXISTS` | 409 | Slug tenant đã tồn tại |
| `TASK_ALREADY_STARTED` | 422 | Task không ở trạng thái `todo` (khi checkin) |
| `TASK_NOT_IN_PROGRESS` | 422 | Task không ở trạng thái `in_progress` (khi checkout) |
| `TASK_ALREADY_CLOSED` | 422 | Task đã kết thúc, không thể sửa |
| `CANNOT_CANCEL` | 422 | Không thể hủy task ở trạng thái này |
| `ALREADY_CANCELLED` | 422 | Task đã bị hủy rồi |
| `CANNOT_REJECT` | 422 | Không thể từ chối task ở trạng thái này |
| `GPS_OUT_OF_RANGE` | 400 | Vị trí GPS quá xa task |
| `INVALID_OTP` | 400 | OTP sai hoặc hết hạn |
| `INVALID_TOKEN` | 400 | Token invitation không hợp lệ |
| `TOKEN_EXPIRED` | 400 | Token/invitation đã hết hạn |
| `PASSWORD_MISMATCH` | 400 | Mật khẩu nhập lại không khớp |
| `INVALID_PASSWORD` | 400 | Mật khẩu hiện tại sai |

---

## 11. Enums

### Task Status Flow

```
todo → (checkin) → in_progress → (checkout) → done
todo / in_progress → (cancel) → cancelled
in_progress → (reject) → rejected
```

### task_priority
`low` | `medium` | `high` | `urgent`

### invitation_delivery
| Value | Mô tả |
|-------|-------|
| `email` | User chưa có tài khoản — nhận link đăng ký |
| `in_app` | User đã có tài khoản — nhận push notification + email link chấp nhận |

### invitation_status
`pending` | `accepted` | `cancelled` | `expired`

### tenant_status
`active` | `inactive` | `suspended`

### audit_logs action
`task_created` | `task_updated` | `task_assigned` | `task_cancelled` | `task_rejected` | `checkin` | `checkout` | `member_invited` | `member_removed` | `status_changed` | `task_completed`
