# Bun Test

Learn how to use Bun's built-in test runner.

## Basic Test

Create a test file:

```ts
// math.test.ts
import { expect, test } from 'bun:test'

test('adds 1 + 2', () => {
  expect(1 + 2).toBe(3)
})
```

Run tests:

```bash
bun test
```

## Running Tests

### Run All Tests

```bash
bun test
```

### Run Specific Test File

```bash
bun test math.test.ts
```

### Run Tests in Watch Mode

```bash
bun test --watch
```

### Run Tests with Coverage

```bash
bun test --coverage
```

## Test Structure

### Describe Block

```ts
import { describe, test, expect } from 'bun:test'

describe('Math operations', () => {
  test('addition', () => {
    expect(1 + 2).toBe(3)
  })
  
  test('subtraction', () => {
    expect(5 - 2).toBe(3)
  })
})
```

### Nested Describe

```ts
describe('Calculator', () => {
  describe('addition', () => {
    test('positive numbers', () => {
      expect(1 + 2).toBe(3)
    })
    
    test('negative numbers', () => {
      expect(-1 + -2).toBe(-3)
    })
  })
})
```

## Assertions

### Basic Assertions

```ts
test('basic assertions', () => {
  expect(1 + 2).toBe(3)
  expect('hello').toBe('hello')
  expect(true).toBe(true)
})
```

### Not Assertions

```ts
test('not assertions', () => {
  expect(1 + 2).not.toBe(4)
  expect('hello').not.toBe('world')
})
```

### Equality

```ts
test('equality', () => {
  expect({ a: 1 }).toEqual({ a: 1 })
  expect([1, 2, 3]).toEqual([1, 2, 3])
})
```

### Type Assertions

```ts
test('type assertions', () => {
  expect('hello').toBeString()
  expect(123).toBeNumber()
  expect([1, 2]).toBeArray()
  expect({ a: 1 }).toBeObject()
})
```

### Truthiness

```ts
test('truthiness', () => {
  expect(true).toBeTruthy()
  expect(false).toBeFalsy()
  expect(1).toBeTruthy()
  expect(0).toBeFalsy()
})
```

### Numbers

```ts
test('number assertions', () => {
  expect(10).toBeGreaterThan(5)
  expect(10).toBeLessThan(20)
  expect(10).toBeGreaterThanOrEqual(10)
  expect(10).toBeLessThanOrEqual(10)
  expect(10).toBeCloseTo(10.1, 0)
})
```

### Strings

```ts
test('string assertions', () => {
  expect('hello world').toContain('hello')
  expect('hello world').toMatch(/world/)
  expect('hello').toHaveLength(5)
})
```

### Arrays

```ts
test('array assertions', () => {
  expect([1, 2, 3]).toContain(2)
  expect([1, 2, 3]).toHaveLength(3)
  expect([1, 2, 3]).toEqual(expect.arrayContaining([1, 2]))
})
```

### Objects

```ts
test('object assertions', () => {
  expect({ a: 1, b: 2 }).toHaveProperty('a')
  expect({ a: 1, b: 2 }).toMatchObject({ a: 1 })
})
```

## Async Tests

### Promise Tests

```ts
test('async test', async () => {
  const result = await Promise.resolve(42)
  expect(result).toBe(42)
})
```

### Async/Await

```ts
test('async/await', async () => {
  const data = await fetchData()
  expect(data).toBeDefined()
})
```

### Error Handling

```ts
test('throws error', async () => {
  await expect(asyncOperation()).rejects.toThrow('Error message')
})
```

## Setup and Teardown

### Before Each

```ts
describe('Database', () => {
  let db: Database
  
  beforeEach(() => {
    db = new Database()
  })
  
  afterEach(() => {
    db.close()
  })
  
  test('query', () => {
    const result = db.query('SELECT * FROM users')
    expect(result).toBeDefined()
  })
})
```

### Before All

```ts
describe('API', () => {
  let server: Server
  
  beforeAll(() => {
    server = startServer()
  })
  
  afterAll(() => {
    server.close()
  })
  
  test('request', async () => {
    const response = await fetch('http://localhost:3000')
    expect(response.ok).toBe(true)
  })
})
```

## Mocking

### Mock Function

```ts
test('mock function', () => {
  const mockFn = Bun.mock(() => 'mocked')
  
  expect(mockFn()).toBe('mocked')
  expect(mockFn).toHaveBeenCalled()
  expect(mockFn).toHaveBeenCalledTimes(1)
})
```

### Mock Module

```ts
import { mock } from 'bun:test'

mock('./api', () => ({
  fetchData: () => Promise.resolve({ data: 'mocked' })
}))

test('mocked api', async () => {
  const { fetchData } = await import('./api')
  const result = await fetchData()
  expect(result.data).toBe('mocked')
})
```

## Best Practices

1. **Use describe blocks**: Group related tests
2. **Use beforeEach/afterEach**: Setup and teardown
3. **Test one thing**: Each test should test one thing
4. **Use descriptive names**: Clear test names
5. **Use watch mode**: For development

## Common Mistakes

❌ **Not using async/await**

```ts
test('async test', () => {
  const result = fetchData() // ❌ Not awaited
  expect(result).toBeDefined()
})
```

✅ **Using async/await**

```ts
test('async test', async () => {
  const result = await fetchData() // ✅ Awaited
  expect(result).toBeDefined()
})
```

❌ **Not cleaning up**

```ts
describe('Database', () => {
  let db = new Database() // ❌ Not cleaned up
  
  test('query', () => {
    db.query('SELECT * FROM users')
  })
})
```

✅ **Cleaning up**

```ts
describe('Database', () => {
  let db: Database
  
  beforeEach(() => {
    db = new Database()
  })
  
  afterEach(() => {
    db.close() // ✅ Cleaned up
  })
  
  test('query', () => {
    db.query('SELECT * FROM users')
  })
})
```

❌ **Testing multiple things**

```ts
test('calculator', () => {
  expect(1 + 2).toBe(3) // ❌ Testing addition
  expect(5 - 2).toBe(3) // ❌ Testing subtraction
  expect(2 * 3).toBe(6) // ❌ Testing multiplication
})
```

✅ **Testing one thing**

```ts
test('addition', () => {
  expect(1 + 2).toBe(3) // ✅ Only addition
})

test('subtraction', () => {
  expect(5 - 2).toBe(3) // ✅ Only subtraction
})
```
