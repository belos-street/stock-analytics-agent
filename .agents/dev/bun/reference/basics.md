# Bun Basics

Learn the fundamentals of Bun runtime.

## Installation

### macOS/Linux

```bash
curl -fsSL https://bun.sh/install | bash
```

### Windows

```powershell
powershell -c "irm bun.sh/install.ps1 | iex"
```

### Using npm

```bash
npm install -g bun
```

### Verify Installation

```bash
bun --version
```

## Running JavaScript/TypeScript

### Run JavaScript

```ts
// index.js
console.log('Hello from Bun!')
```

```bash
bun run index.js
```

### Run TypeScript

```ts
// index.ts
interface User {
  name: string
  age: number
}

const user: User = { name: 'John', age: 30 }
console.log(user)
```

```bash
bun run index.ts
```

### Run with Watch Mode

```bash
bun --watch index.ts
```

## Bun CLI Commands

### bun run

Run scripts from package.json:

```json
{
  "scripts": {
    "dev": "bun run src/index.ts",
    "build": "bun run build.ts"
  }
}
```

```bash
bun run dev
```

### bun repl

Start interactive REPL:

```bash
bun repl
```

```ts
> 1 + 1
2
> console.log('Hello')
Hello
```

### bun init

Initialize a new project:

```bash
bun init
```

Creates package.json and tsconfig.json.

## Environment Variables

### Using .env Files

```env
# .env
API_KEY=your_api_key
DATABASE_URL=postgres://localhost/mydb
```

```ts
// index.ts
const apiKey = process.env.API_KEY
const dbUrl = process.env.DATABASE_URL
```

### Loading .env

```bash
bun --env-file=.env run index.ts
```

## Built-in APIs

### Fetch API

```ts
const response = await fetch('https://api.example.com/data')
const data = await response.json()
console.log(data)
```

### WebSocket API

```ts
const ws = new WebSocket('ws://localhost:8080')

ws.onopen = () => {
  ws.send('Hello Server!')
}

ws.onmessage = (event) => {
  console.log('Received:', event.data)
}
```

### setTimeout/setInterval

```ts
setTimeout(() => {
  console.log('Delayed by 1 second')
}, 1000)

setInterval(() => {
  console.log('Every 2 seconds')
}, 2000)
```

## File Operations

### Read File

```ts
const file = Bun.file('data.txt')
const text = await file.text()
console.log(text)
```

### Write File

```ts
await Bun.write('output.txt', 'Hello Bun!')
```

### Read JSON

```ts
const data = await Bun.file('data.json').json()
console.log(data)
```

## Best Practices

1. **Use TypeScript**: Native TypeScript support
2. **Use watch mode**: For development
3. **Use .env files**: For environment variables
4. **Use built-in APIs**: Faster than external libraries
5. **Use bun init**: Quick project setup

## Common Mistakes

❌ **Using Node.js specific APIs**

```ts
const fs = require('fs') // ❌ Not needed in Bun
fs.readFile('data.txt', (err, data) => {
  console.log(data)
})
```

✅ **Using Bun APIs**

```ts
const file = Bun.file('data.txt') // ✅ Native Bun API
const text = await file.text()
console.log(text)
```

❌ **Not using TypeScript**

```ts
const user = { name: 'John', age: 30 } // ❌ No type safety
```

✅ **Using TypeScript**

```ts
interface User {
  name: string
  age: number
}

const user: User = { name: 'John', age: 30 } // ✅ Type safe
```

❌ **Not using watch mode**

```bash
bun run index.ts # ❌ Manual restart needed
```

✅ **Using watch mode**

```bash
bun --watch index.ts # ✅ Auto-restart on changes
```
