# Bun Toolchain

Learn how to use Bun's built-in tools: build, run, and bunx.

## Bun Build

Bun's bundler is fast and efficient for building JavaScript/TypeScript applications.

### Basic Build

```ts
// index.ts
console.log('Hello from Bun!')
```

```bash
bun build index.ts --outdir ./dist
```

### Build for Different Targets

```bash
# Build for Node.js
bun build index.ts --target node --outfile ./dist/index.js

# Build for Browser
bun build index.ts --target browser --outfile ./dist/bundle.js
```

### Build with Entry Points

```bash
bun build src/index.ts src/cli.ts --outdir ./dist
```

### Build with External Dependencies

```bash
bun build index.ts --external lodash --outfile ./dist/index.js
```

### Build with Minification

```bash
bun build index.ts --minify --outfile ./dist/index.js
```

### Build with Source Maps

```bash
bun build index.ts --sourcemap --outfile ./dist/index.js
```

### Build Configuration

```json
{
  "name": "my-app",
  "version": "1.0.0",
  "scripts": {
    "build": "bun build src/index.ts --outdir ./dist",
    "build:min": "bun build src/index.ts --minify --outdir ./dist",
    "build:node": "bun build src/index.ts --target node --outfile ./dist/index.js"
  }
}
```

## Bun Run

Run scripts and files efficiently.

### Run TypeScript Files

```bash
bun run src/index.ts
```

### Run with Watch Mode

```bash
bun --watch run src/index.ts
```

### Run Package Scripts

```json
{
  "scripts": {
    "dev": "bun run src/index.ts",
    "build": "bun run build.ts",
    "test": "bun test"
  }
}
```

```bash
bun run dev
bun run build
bun run test
```

### Run with Environment Variables

```bash
API_KEY=secret bun run src/index.ts
```

### Run with Arguments

```bash
bun run src/index.ts -- --port 3000
```

## Bunx

Execute packages without installing them globally.

### Run Package

```bash
bunx vite
```

### Run Package with Arguments

```bash
bunx vite --port 3000
```

### Run Specific Version

```bash
bunx vite@4.0.0
```

### Run Multiple Packages

```bash
bunx prettier --write src/
bunx eslint src/
```

### Common Use Cases

```bash
# Run TypeScript compiler
bunx tsc --noEmit

# Run ESLint
bunx eslint src/

# Run Prettier
bunx prettier --write src/

# Run Vite dev server
bunx vite

# Run Next.js dev server
bunx next dev
```

## Bun REPL

Interactive JavaScript/TypeScript REPL.

### Start REPL

```bash
bun repl
```

### REPL Usage

```ts
> 1 + 1
2

> const x = 10
undefined

> x * 2
20

> console.log('Hello')
Hello
undefined

> .exit
```

### REPL Commands

```ts
> .help        # Show help
> .exit        # Exit REPL
> .clear       # Clear history
> .load file   # Load file
```

## Bun Init

Initialize a new project.

### Basic Init

```bash
bun init
```

Creates `package.json` and `tsconfig.json`.

### Init with Options

```bash
bun init --yes
bun init --name my-app
bun init --typescript
```

### Init with Template

```bash
bun create react my-app
bun create next my-app
```

## Best Practices

1. **Use bun build**: Fast and efficient bundling
2. **Use bunx**: Run packages without installing
3. **Use watch mode**: For development
4. **Use bun init**: Quick project setup
5. **Use source maps**: For debugging

## Common Mistakes

❌ **Using webpack/vite for simple builds**

```bash
vite build # ❌ Slower
```

✅ **Using bun build**

```bash
bun build src/index.ts --outdir ./dist # ✅ Faster
```

❌ **Installing packages globally**

```bash
npm install -g prettier # ❌ Slower
```

✅ **Using bunx**

```bash
bunx prettier --write src/ # ✅ Faster, no install needed
```

❌ **Not using watch mode**

```bash
bun run src/index.ts # ❌ Manual restart needed
```

✅ **Using watch mode**

```bash
bun --watch run src/index.ts # ✅ Auto-restart on changes
```

❌ **Not using source maps**

```bash
bun build src/index.ts --outfile ./dist/index.js # ❌ No source maps
```

✅ **Using source maps**

```bash
bun build src/index.ts --sourcemap --outfile ./dist/index.js # ✅ Source maps included
```
