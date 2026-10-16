---
name: naming-conventions
description: 命名约定速查：文件/目录 kebab-case、组件/接口 PascalCase、函数变量 camelCase、常量 UPPER_SNAKE_CASE、布尔 is/has/can 前缀。写码或 review 命名时对照。
---

# Naming Conventions

个人编码习惯 - 命名约定

## File Naming

### General Files

使用 kebab-case 命名文件和目录：

```bash
# ✅ Good
user-profile.ts
api-helper.ts
auth-service.js
my-component.vue

# ❌ Bad
userProfile.ts   # camelCase
UserProfile.ts   # PascalCase
user_profile.ts  # snake_case
```

### Directories

目录使用 kebab-case：

```bash
# ✅ Good
src/components/user-profile/
src/utils/date-helper/
src/api/auth/

# ❌ Bad
src/components/UserProfile/  # PascalCase
src/components/userProfile/  # camelCase
```

## Component Naming

### Vue Components

Vue 组件使用 kebab-case：

```bash
# ✅ Good
user-profile.vue
product-card.vue
data-table.vue

# ❌ Bad
UserProfile.vue    # PascalCase
userProfile.vue    # camelCase
```

组件内部引用也使用 kebab-case：

```vue
<script setup lang="ts">
import UserProfile from '@/components/user-profile.vue'
import ProductCard from '@/components/product-card.vue'
</script>

<template>
  <UserProfile />
  <ProductCard />
</template>
```

### React Components

React 组件（JSX/TSX）同样使用 kebab-case：

```tsx
// ✅ Good
user-profile.tsx
product-card.tsx
data-table.tsx

// ❌ Bad
UserProfile.tsx    # PascalCase
userProfile.tsx    # camelCase
```

## TypeScript Types

### Interfaces

接口使用 PascalCase：

```ts
// ✅ Good
interface UserInfo {
  id: number
  name: string
}

interface ApiResponse<T> {
  data: T
  status: number
}

// ❌ Bad
interface userInfo {}
interface apiResponse {}
```

### Type Aliases

类型别名使用 PascalCase：

```ts
// ✅ Good
type UserStatus = 'active' | 'inactive' | 'pending'
type AsyncState<T> = LoadingState | SuccessState<T> | ErrorState

// ❌ Bad
type userStatus = 'active' | 'inactive'
```

### Enums

枚举使用 PascalCase，枚举成员使用 PascalCase 或 UPPER_SNAKE_CASE：

```ts
// ✅ Good
enum UserRole {
  Admin = 'ADMIN',
  User = 'USER',
  Guest = 'GUEST'
}

enum HttpStatus {
  Ok = 200,
  NotFound = 404,
  ServerError = 500
}

// ❌ Bad
enum userRole {}
```

## Variables and Functions

### Variables

变量使用 camelCase：

```ts
// ✅ Good
const userName = 'John'
const isActive = true
const userList = []

// ❌ Bad
const user_name = 'John'   # snake_case
const UserName = 'John'    # PascalCase
const is_active = true     # snake_case
```

### Functions

函数使用 camelCase：

```ts
// ✅ Good
function fetchUserData() {}
function calculateTotal() {}
function isUserValid() {}

// ❌ Bad
function fetch_user_data() {}
function CalculateTotal() {}
```

### Constants

常量使用 UPPER_SNAKE_CASE：

```ts
// ✅ Good
const MAX_RETRY_COUNT = 3
const API_BASE_URL = 'https://api.example.com'
const DEFAULT_TIMEOUT = 5000

// ❌ Bad
const maxRetryCount = 3
const ApiBaseUrl = 'https://api.example.com'
```

## Boolean Variables

布尔值使用 is/has/can/should 前缀：

```ts
// ✅ Good
const isActive = true
const hasPermission = true
const canEdit = false
const shouldUpdate = true
const isLoading = false

// ❌ Bad
const active = true
const permission = true
const edit = false
const loading = false
```

### Naming Patterns

| Prefix | Usage | Example |
|--------|-------|---------|
| `is` | 是否为某状态 | `isActive`, `isVisible` |
| `has` | 是否拥有某属性 | `hasPermission`, `hasChildren` |
| `can` | 是否有权限/能力 | `canEdit`, `canDelete` |
| `should` | 是否应该做某事 | `shouldUpdate`, `shouldRedirect` |

## Store Naming

### Pinia Stores

Store 使用描述性的名称，文件使用 kebab-case：

```ts
// stores/user-store.ts
export const useUserStore = defineStore('user', () => {
  // store implementation
})

// stores/auth-store.ts
export const useAuthStore = defineStore('auth', () => {
  // store implementation
})
```

### Zustand Stores

```ts
// stores/useUserStore.ts
export const useUserStore = create((set) => ({
  // store implementation
}))
```

## API Related Naming

### API Functions

```ts
// ✅ Good
async function fetchUser(id: number) {}
async function createUser(data: CreateUserDTO) {}
async function updateUser(id: number, data: UpdateUserDTO) {}
async function deleteUser(id: number) {}

// ❌ Bad
async function getUser() {}      # 缺少参数说明
async function addUser() {}      # 使用 add 而非 create
```

### Request/Response Types

```ts
// ✅ Good
interface CreateUserRequest {
  name: string
  email: string
}

interface UserResponse {
  id: number
  name: string
  email: string
  createdAt: Date
}

// ❌ Bad
interface UserRequest {}      # 不明确是创建还是更新
interface UserResult {}       # 使用 result 而非 response
```

## CSS Classes

CSS 类名使用 kebab-case：

```css
/* ✅ Good */
.user-profile {
  display: flex;
}

.card-header {
  padding: 16px;
}

/* ❌ Bad */
.userProfile {
  display: flex;
}

.cardHeader {
  padding: 16px;
}
```

## Vue Router Routes

路由命名使用 kebab-case：

```ts
// router/index.ts
const routes = [
  {
    path: '/user-profile',
    name: 'user-profile',
    component: UserProfile
  },
  {
    path: '/product-details/:id',
    name: 'product-details',
    component: ProductDetails
  }
]
```

## Best Practices

1. **一致性优先** - 在整个项目中保持命名风格一致
2. **描述性** - 命名要有意义，能表达意图
3. **简洁** - 在保证清晰的前提下尽量简短
4. **避免缩写** - 除非是广泛认可的缩写（如 `id`, `api`, `url`）
5. **同类型同风格** - 同一类型的变量使用相同的命名模式
