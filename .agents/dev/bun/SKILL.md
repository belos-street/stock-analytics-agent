---
name: bun
title: Bun Runtime
description: Fast, modern JavaScript runtime and toolkit. IMPORTANT: This is Bun, NOT Node.js. Use Bun-specific APIs below. Do NOT use Node.js APIs like require(), process, fs (use Bun.file() instead).
icon: 🥟
tags: [javascript, runtime, bun, performance]
---

Bun 是面向现代 JavaScript 生态的全新运行时，定位为 Node.js 的替代方案，基于 JavaScriptCore 引擎和 Zig 语言编写。**请使用 Bun 特有的 API，不要使用 Node.js 的写法。**

## Quick Start

```bash
# Install Bun
curl -fsSL https://bun.sh/install | bash

# Run a file
bun run index.ts

# Install dependencies
bun install

# Run tests
bun test
```

## Key Features

- **Native TypeScript**: 直接运行 .ts/.tsx 文件，无需转译
- **Built-in Tools**: 包管理器、测试、打包工具内置
- **Node.js Compatible**: 兼容大部分 Node.js 生态
- **Web APIs**: 原生 fetch, WebSocket, ReadableStream
- **Bun.serve()**: 高性能 HTTP 服务
- **Bun.file()**: 简化文件操作
- **Bun.password**: 原生密码哈希（argon2）
- **bun:test**: 零配置测试框架

---

## Module Import/Export

**重要**: Bun 默认使用 ES 模块，兼容 CommonJS，无需额外配置。

```ts
// ✅ Bun 写法 - 默认 ES 模块
import fs from 'fs/promises';
export const foo = 'bar';

// ✅ Bun 写法 - 原生支持 TS/JSX（无需转译）
import App from './App.tsx';

// ✅ Bun 兼容 CommonJS（无需额外配置）
const fs = require('fs');
module.exports = { foo: 'bar' };

// ❌ 避免 - Node.js CommonJS 写法
const fs = require('fs');  // 可以用，但推荐上面写法
```

---

## Global Objects

**重要**: Bun 有自己的全局对象，优先使用 Bun 特有的写法。

```ts
// ✅ Bun 特有 - import.meta.dir/file (所有模块类型通用)
console.log(import.meta.dir);  // 当前目录
console.log(import.meta.file); // 当前文件

// ❌ 避免 - Node.js 写法
// console.log(__dirname);  // 不推荐
// console.log(__filename); // 不推荐

// ✅ Bun 特有 - Bun 全局对象
console.log(Bun.env.NODE_ENV);       // 自动读取 .env
console.log(Bun.version);            // Bun 版本
console.log(Bun.memoryUsage());      // 内存使用

// ✅ Bun 兼容 - process 仍可用
console.log(process.env.NODE_ENV);
console.log(process.pid);

// ✅ Bun 特有 - crypto 全局可用
const bytes = crypto.randomBytes(32);

// ❌ 避免 - Node.js 显式引入
// const crypto = require('crypto'); // 不需要
```

---

## HTTP Server (最核心差异)

**重要**: 使用 `Bun.serve()` 而非 `http.createServer()`。

```ts
// ✅ Bun 写法 - Bun.serve() (简洁高效)
Bun.serve({
  port: 3000,
  fetch(req) {
    return new Response('Hello Bun', {
      headers: { 'Content-Type': 'text/plain' }
    });
  }
});

// ✅ Bun 特有 - 原生 WebSocket 支持
Bun.serve({
  port: 3000,
  fetch(req) {
    if (req.headers.get('upgrade') === 'websocket') {
      const ws = new WebSocket(req);
      ws.on('message', (data) => console.log('Message:', data));
      return ws;
    }
    return new Response('Hello Bun');
  }
});

// ❌ 避免 - Node.js 写法
// const http = require('http');
// const server = http.createServer((req, res) => { ... });
```

---

## File Operations

**重要**: 使用 `Bun.file()` 和 `Bun.write()` 而非 fs 模块。

```ts
// ✅ Bun 写法 - Bun.file() (简洁高效)
// 读取文件
const file = Bun.file('./test.txt');
const text = await file.text();           // 读取为文本
const json = await file.json();            // 读取为 JSON（Bun 特有）
const buffer = = await file.arrayBuffer(); // 读取为 Buffer

// 写入文件
await Bun.write('./test.txt', 'Hello Bun');
await Bun.write('./test.json', { name: 'Bun' }); // 自动序列化

// ✅ Bun 兼容 - 目录操作仍需 fs
import { readdir, mkdir } from 'node:fs/promises';
const files = await readdir(import.meta.dir);
await mkdir('./newDir', { recursive: true });

// ❌ 避免 - Node.js fs 写法（可以但不是最优）
// const fs = require('fs/promises');
// const content = await fs.readFile('./test.txt', 'utf8');
```

---

## Cryptography

**重要**: 使用 `Bun.password` 和 `Bun.hash` 而非第三方库。

```ts
// ✅ Bun 特有 - 密码哈希（无需第三方包）
const hash = await Bun.password.hash('123456'); // 默认 argon2 算法
const isMatch = await Bun.password.verify('123456', hash);

// ✅ Bun 特有 - 哈希计算
const hash1 = Bun.hash('test');        // 默认 wyhash，返回 32 位整数
const hash2 = Bun.hash.sha256('test'); // SHA256，返回十六进制

// ❌ 避免 - Node.js bcrypt 写法
// const bcrypt = require('bcrypt');
// const hash = await bcrypt.hash('123456', 10);
```

---

## Environment Variables

**重要**: Bun 自动读取 .env，使用 `Bun.env` 而非 `dotenv`。

```ts
// ✅ Bun 特有 - 自动读取 .env（无需依赖）
console.log(Bun.env.DB_URL);
console.log(Bun.env.PORT);

// ✅ Bun 兼容 - process.env 仍可用
console.log(process.env.DB_URL);

// ✅ Bun 特有 - TypeScript 类型声明
declare module "bun" {
  interface Env {
    DB_URL: string;
    PORT: string;
  }
}
Bun.env.DB_URL; // 自动提示类型

// ❌ 避免 - Node.js dotenv 写法
// require('dotenv').config(); // 不需要
```

---

## Package Manager

```bash
# ✅ Bun 写法
bun install axios
bun run start
bunx cowsay "Hello"

# ❌ 避免 - npm 写法（可以用但推荐 bun）
# npm install axios
# npm run start
```

---

## Testing

**重要**: 使用 `bun:test` 而非 Jest/Vitest。

```ts
// ✅ Bun 写法 - bun:test（零配置，速度快）
import { test, expect } from 'bun:test';

test('1 + 1 = 2', () => {
  expect(1 + 1).toBe(2);
});

// ❌ 避免 - Jest 写法（不需要安装）
// const { test, expect } = require('@jest/globals');
```

---

## Common Patterns

### Running TypeScript

```ts
// ✅ Bun 直接运行（无需配置 tsc）
// app.ts
interface User {
  id: number;
  name: string;
}

const user: User = { id: 1, name: 'John' };
console.log(user);
```

```bash
bun run app.ts
```

### SQLite

```ts
const db = new Bun.Database('my.db');
const users = db.query('SELECT * FROM users').all();
```

---

## Migration Checklist

| Node.js | Bun | Notes |
|---------|-----|-------|
| `require()` | `import` | 默认 ESM |
| `__dirname` | `import.meta.dir` | |
| `fs.readFile` | `Bun.file().text()` | 更简洁 |
| `http.createServer` | `Bun.serve()` | 性能更好 |
| `bcrypt` | `Bun.password` | 内置 |
| `dotenv` | `Bun.env` | 自动读取 |
| `Jest` | `bun:test` | 零配置 |
| `npm` | `bun` | 速度更快 |

---

## Key Points

1. **使用 Bun API**: 优先使用 `Bun.serve()`, `Bun.file()`, `Bun.write()`, `Bun.password`, `Bun.hash`
2. **使用 import**: 默认 ES 模块，直接 `import` 而非 `require`
3. **使用 import.meta.dir**: 获取当前目录
4. **使用 Bun.env**: 访问环境变量，自动读取 .env
5. **使用 bun:test**: 内置测试框架
6. **使用 bun**: 包管理和运行脚本

## Resources

- [Official Documentation](https://bun.sh/docs)
- [GitHub Repository](https://github.com/oven-sh/bun)
- [Bun vs Node.js](https://bun.sh/docs/runtime/bun-vs-node)
