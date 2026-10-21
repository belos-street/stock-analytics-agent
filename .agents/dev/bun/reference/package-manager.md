# Bun Package Manager

Learn how to use Bun's fast package manager.

## Installing Dependencies

### Install All Dependencies

```bash
bun install
```

### Install Specific Package

```bash
bun add lodash
```

### Install as Dev Dependency

```bash
bun add -d typescript
```

### Install as Peer Dependency

```bash
bun add -p react
```

### Install Exact Version

```bash
bun add react@18.2.0
```

### Install from Git

```bash
bun add https://github.com/user/repo.git
```

## Removing Dependencies

### Remove Package

```bash
bun remove lodash
```

### Remove Multiple Packages

```bash
bun remove lodash axios
```

## Updating Dependencies

### Update All

```bash
bun update
```

### Update Specific Package

```bash
bun update react
```

### Update to Latest

```bash
bun update --latest
```

## Running Scripts

### Run Script

```bash
bun run dev
```

### Run Script with Arguments

```bash
bun run build -- --watch
```

### Run Direct Command

```bash
bunx vite
```

## Lock File

Bun uses `bun.lockb` for fast dependency resolution.

### View Lock File

```bash
bun pm ls
```

### Clean Cache

```bash
bun pm cache rm
```

## Performance

Bun's package manager is significantly faster than npm/yarn:

- **Install**: 20-100x faster than npm
- **Install from cache**: Near-instant
- **Deduplication**: Automatic and efficient

## Best Practices

1. **Use bun install**: Faster than npm/yarn
2. **Use bunx**: Run packages without installing
3. **Use bun pm ls**: View installed packages
4. **Use bun pm cache rm**: Clear cache when needed
5. **Use -d flag**: For dev dependencies

## Common Mistakes

❌ **Using npm instead of bun**

```bash
npm install # ❌ Slow
```

✅ **Using bun install**

```bash
bun install # ✅ Fast
```

❌ **Installing packages globally**

```bash
npm install -g typescript # ❌ Slower
```

✅ **Using bunx**

```bash
bunx typescript # ✅ Faster, no install needed
```

❌ **Not using dev dependencies**

```bash
bun add typescript # ❌ Installed as regular dependency
```

✅ **Using dev dependencies**

```bash
bun add -d typescript # ✅ Installed as dev dependency
```
