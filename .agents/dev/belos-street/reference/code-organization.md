---
name: code-organization
description: 代码组织约定：项目目录结构、pages/router 映射、扁平化路由、import 顺序、feature-based 组织、职责单一。搭项目结构或组织代码时读。
---

# Code Organization

个人编码习惯 - 代码组织方式

## Project Directory Structure

推荐的项目目录结构：

```
src/
├── api/                    # API 请求层
│   ├── index.ts            # API 统一出口
│   ├── user-api.ts         # 用户相关 API
│   └── product-api.ts      # 产品相关 API
│
├── assets/                 # 静态资源
│   ├── images/
│   └── styles/
│
├── components/             # 公共组件
│   ├── ui/                 # 基础 UI 组件（按钮、输入框等）
│   │   ├── base-button.vue
│   │   └── base-input.vue
│   ├── layout/             # 布局组件
│   │   ├── app-header.vue
│   │   ├── app-sidebar.vue
│   │   └── app-layout.vue
│   └── common/             # 通用业务组件
│       ├── data-table.vue
│       └── empty-state.vue
│
├── composables/            # Vue Composables（可选，hooks/ 也可）
│   ├── use-auth.ts
│   ├── use-fetch.ts
│   └── use-modal.ts
│
├── config/                 # 配置文件
│   ├── constants.ts        # 常量定义
│   ├── env.ts              # 环境变量
│   └── settings.ts         # 应用设置
│
├── features/               # 功能模块（按功能组织）
│   ├── auth/              # 认证功能
│   │   ├── components/    # 认证相关组件
│   │   ├── composables/   # 认证相关 hooks
│   │   └── types/         # 认证相关类型
│   │
│   ├── user/              # 用户功能
│   │   ├── components/
│   │   ├── composables/
│   │   └── types/
│   │
│   └── product/           # 产品功能
│       ├── components/
│       ├── composables/
│       └── types/
│
├── pages/                  # 页面（与路由对应）
│   ├── index/             # 首页
│   │   └── index.vue
│   │
│   ├── user/              # 用户相关页面
│   │   ├── user-list.vue
│   │   ├── user-detail.vue
│   │   └── user-edit.vue
│   │
│   ├── product/           # 产品相关页面
│   │   ├── product-list.vue
│   │   ├── product-detail.vue
│   │   └── product-create.vue
│   │
│   └── auth/              # 认证相关页面
│       ├── login.vue
│       ├── register.vue
│       └── forgot-password.vue
│
├── router/                # 路由配置
│   ├── index.ts           # 路由入口
│   ├── routes/            # 路由规则
│   │   ├── index.ts       # 汇总所有路由
│   │   ├── auth-routes.ts
│   │   ├── user-routes.ts
│   │   └── product-routes.ts
│   └── guards/            # 路由守卫
│       ├── auth-guard.ts
│       └── permission-guard.ts
│
├── stores/                # 状态管理（Pinia/Zustand）
│   ├── user-store.ts
│   ├── product-store.ts
│   └── ui-store.ts
│
├── types/                 # 全局类型定义
│   ├── api.types.ts
│   └── global.d.ts
│
├── utils/                 # 工具函数
│   ├── date.ts
│   ├── validate.ts
│   └── format.ts
│
├── App.vue
└── main.ts
```

## Pages 与 Router 映射关系

### 对应关系

pages 目录结构与 router/routes 是一一对应的：

```
pages/                         router/routes/
├── index/                     ├── index.ts (首页路由)
│   └── index.vue              → path: '/'
│
├── user/                      ├── user-routes.ts
│   ├── user-list.vue          → path: '/user'
│   ├── user-detail.vue        → path: '/user/:id'
│   └── user-edit.vue          → path: '/user/:id/edit'
│
├── product/                   ├── product-routes.ts
│   ├── product-list.vue       → path: '/product'
│   ├── product-detail.vue     → path: '/product/:id'
│   └── product-create.vue     → path: '/product/create'
│
└── auth/                      ├── auth-routes.ts
    ├── login.vue              → path: '/login'
    ├── register.vue           → path: '/register'
    └── forgot-password.vue    → path: '/forgot-password'
```

### Router 配置示例

```ts
// router/routes/user-routes.ts
export const userRoutes = [
  {
    path: '/user',
    name: 'user-list',
    component: () => import('@/pages/user/user-list.vue'),
    meta: { title: '用户列表' }
  },
  {
    path: '/user/:id',
    name: 'user-detail',
    component: () => import('@/pages/user/user-detail.vue'),
    meta: { title: '用户详情' }
  },
  {
    path: '/user/:id/edit',
    name: 'user-edit',
    component: () => import('@/pages/user/user-edit.vue'),
    meta: { title: '编辑用户' }
  }
]
```

### 多层嵌套路由

当路由有多层嵌套，但页面都是同一个维度时（如 `/org/:orgId/project/:projectId/task/:taskId/detail`），推荐使用扁平化结构：

```
pages/
├── org/                        # 组织
│   └── index.vue              → path: '/org'
│
├── project/                   # 项目（扁平，不嵌套在 org 下）
│   ├── project-list.vue       → path: '/project'     # 列表页（与 index.vue 二选一）
│   └── project-detail.vue     → path: '/project/:projectId'
│
├── task/                      # 任务（扁平，不嵌套在 project 下）
│   ├── task-list.vue          → path: '/task'        # 列表页（与 index.vue 二选一）
│   ├── task-detail.vue        → path: '/task/:taskId'
│   └── task-edit.vue         → path: '/task/:taskId/edit'
│
└── workspace/                 # 工作空间
    ├── index.vue
    ├── workspace-list.vue
    └── workspace-detail.vue
```

路由配置同样扁平：

```ts
// router/routes/index.ts
export const routes = [
  // Org 路由
  {
    path: '/org',
    name: 'org-list',
    component: () => import('@/pages/org/index.vue')
  },

  // Project 路由（扁平，不嵌套）
  {
    path: '/project',
    name: 'project-list',
    component: () => import('@/pages/project/project-list.vue')
  },
  {
    path: '/project/:projectId',
    name: 'project-detail',
    component: () => import('@/pages/project/project-detail.vue')
  },

  // Task 路由（扁平，不嵌套）
  {
    path: '/task',
    name: 'task-list',
    component: () => import('@/pages/task/task-list.vue')
  },
  {
    path: '/task/:taskId',
    name: 'task-detail',
    component: () => import('@/pages/task/task-detail.vue')
  },
  {
    path: '/task/:taskId/edit',
    name: 'task-edit',
    component: () => import('@/pages/task/task-edit.vue')
  }
]
```

### 为什么扁平化更好？

| 嵌套方式 | 优点 | 缺点 |
|----------|------|------|
| **嵌套式** `/org/:orgId/project/:projectId/task/:taskId` | URL 语义清晰 | 目录深，查找不便，参数传递复杂 |
| **扁平式** `/task/:taskId` | 目录浅，易维护 | URL 语义稍弱 |

**结论**：如果页面都是同一维度（不是父子关系），优先使用扁平化结构。

### 真正的嵌套场景

只有当页面确实是父子关系（父页面包含子页面）时才使用嵌套：

```
pages/
├── dashboard/
│   ├── index.vue              # 父页面（包含 router-view）
│   ├── dashboard-overview.vue # 子页面 1
│   └── dashboard-analytics.vue # 子页面 2
```

```ts
// router/routes/dashboard-routes.ts
export const dashboardRoutes = [
  {
    path: '/dashboard',
    component: () => import('@/pages/dashboard/index.vue'),  # 父路由
    children: [
      {
        path: '',
        name: 'dashboard-overview',
        component: () => import('@/pages/dashboard/dashboard-overview.vue')
      },
      {
        path: 'analytics',
        name: 'dashboard-analytics',
        component: () => import('@/pages/dashboard/dashboard-analytics.vue')
      }
    ]
  }
]
```

## Import Order

文件内的导入顺序保持一致：

```ts
// 1. Vue/React 核心库
import { ref, computed, onMounted } from 'vue'
import React, { useState } from 'react'

// 2. 外部库
import { useRoute, useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import axios from 'axios'

// 3. 内部公共模块 - composables/hooks
import { useAuth } from '@/composables/use-auth'
import { useFetch } from '@/composables/use-fetch'

// 4. 内部公共模块 - components
import BaseButton from '@/components/ui/base-button.vue'
import DataTable from '@/components/common/data-table.vue'

// 5. 内部公共模块 - stores
import { useUserStore } from '@/stores/user-store'
import { useUIStore } from '@/stores/ui-store'

// 6. 内部公共模块 - utils
import { formatDate } from '@/utils/date'
import { validateEmail } from '@/utils/validate'

// 7. 内部公共模块 - types
import type { User, ApiResponse } from '@/types/api.types'

// 8. 当前目录/业务模块
import UserCard from './components/user-card.vue'
import { useUserList } from './composables/use-user-list'

// 9. 相对路径样式
import './styles.css'
```

## Feature-Based vs Type-Based

### 推荐：Feature-Based（按功能组织）

```
src/
├── features/
│   ├── auth/
│   │   ├── components/
│   │   ├── composables/
│   │   ├── types/
│   │   └── api/
│   └── user/
│       ├── components/
│       ├── composables/
│       ├── types/
│       └── api/
```

优点：
- 相关代码集中，易于查找
- 方便团队分工
- 模块边界清晰

### 适用场景

| 组织方式 | 适用场景 |
|----------|----------|
| Feature-Based | 中大型项目，多人协作 |
| Type-Based | 小型项目，简单应用 |
| 混合使用 | 公共部分抽离，业务按功能 |

## Single Responsibility

### 文件职责单一

```
# ✅ Good: 一个文件只做一件事
utils/
├── format-date.ts      # 日期格式化
├── format-currency.ts  # 货币格式化
└── format-phone.ts     # 手机号格式化

# ❌ Bad: 一个文件做多件事
utils/
└── formatters.ts       # 包含各种格式化函数
```

### 组件职责单一

```vue
<!-- ✅ Good: 展示组件只负责展示 -->
<!-- components/user/user-avatar.vue -->
<template>
  <img :src="src" :alt="alt" class="avatar" />
</template>

<script setup lang="ts">
defineProps<{
  src: string
  alt?: string
}>()
</script>
```

```vue
<!-- ❌ Bad: 组件职责过多 -->
<!-- components/user/user-card.vue -->
<template>
  <!-- 展示、交互、数据获取都在一个组件 -->
  <div>
    <img :src="user.avatar" />
    <h3>{{ user.name }}</h3>
    <button @click="follow">关注</button>
    <button @click="message">私信</button>
    <!-- ...更多功能 -->
  </div>
</template>
```

## Best Practices

1. **目录结构要一致** - 所有模块遵循相同的组织方式
2. **相关文件放一起** - 组件、类型、hooks 放在一起
3. **深度不要超过 3 层** - 避免嵌套过深
4. **名称要有意义** - 目录和文件名要能表达内容
5. **保持简洁** - 不要过度设计，按需调整
