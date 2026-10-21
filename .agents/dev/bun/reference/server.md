# Bun Server

Learn how to create HTTP servers with Bun.

## Basic Server

Create a simple HTTP server:

```ts
Bun.serve({
  port: 3000,
  fetch(req) {
    return new Response('Hello World!')
  }
})
```

Run the server:

```bash
bun run server.ts
```

## Request Handling

### Get Request Info

```ts
Bun.serve({
  port: 3000,
  fetch(req) {
    const url = new URL(req.url)
    const method = req.method
    
    return new Response(`Method: ${method}, Path: ${url.pathname}`)
  }
})
```

### Route Handling

```ts
Bun.serve({
  port: 3000,
  fetch(req) {
    const url = new URL(req.url)
    
    if (url.pathname === '/') {
      return new Response('Home Page')
    }
    
    if (url.pathname === '/api/users') {
      return new Response(JSON.stringify({ users: [] }), {
        headers: { 'Content-Type': 'application/json' }
      })
    }
    
    return new Response('Not Found', { status: 404 })
  }
})
```

### HTTP Methods

```ts
Bun.serve({
  port: 3000,
  fetch(req) {
    const url = new URL(req.url)
    
    if (req.method === 'GET' && url.pathname === '/api/users') {
      return new Response(JSON.stringify({ users: [] }), {
        headers: { 'Content-Type': 'application/json' }
      })
    }
    
    if (req.method === 'POST' && url.pathname === '/api/users') {
      return new Response('User Created', { status: 201 })
    }
    
    return new Response('Method Not Allowed', { status: 405 })
  }
})
```

## Request Body

### Read JSON Body

```ts
Bun.serve({
  port: 3000,
  async fetch(req) {
    if (req.method === 'POST') {
      const body = await req.json()
      return new Response(JSON.stringify(body), {
        headers: { 'Content-Type': 'application/json' }
      })
    }
    return new Response('OK')
  }
})
```

### Read Text Body

```ts
Bun.serve({
  port: 3000,
  async fetch(req) {
    const body = await req.text()
    return new Response(`Received: ${body}`)
  }
})
```

### Read Form Data

```ts
Bun.serve({
  port: 3000,
  async fetch(req) {
    const formData = await req.formData()
    const name = formData.get('name')
    return new Response(`Hello ${name}`)
  }
})
```

## Response Headers

### Set Headers

```ts
Bun.serve({
  port: 3000,
  fetch(req) {
    return new Response('Hello', {
      headers: {
        'Content-Type': 'text/plain',
        'X-Custom-Header': 'value'
      }
    })
  }
})
```

### CORS

```ts
Bun.serve({
  port: 3000,
  fetch(req) {
    return new Response('Hello', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE',
        'Access-Control-Allow-Headers': 'Content-Type'
      }
    })
  }
})
```

## Static Files

### Serve Static Files

```ts
Bun.serve({
  port: 3000,
  async fetch(req) {
    const url = new URL(req.url)
    const filePath = `./public${url.pathname}`
    
    try {
      const file = Bun.file(filePath)
      return new Response(file)
    } catch {
      return new Response('Not Found', { status: 404 })
    }
  }
})
```

## WebSocket

### Basic WebSocket

```ts
Bun.serve({
  port: 3000,
  fetch(req, server) {
    if (req.headers.get('Upgrade') === 'websocket') {
      return server.upgrade(req)
    }
    return new Response('Upgrade Required', { status: 426 })
  },
  websocket: {
    message(ws, message) {
      ws.send(`Echo: ${message}`)
    },
    open(ws) {
      console.log('Client connected')
    },
    close(ws) {
      console.log('Client disconnected')
    }
  }
})
```

### WebSocket Client

```ts
const ws = new WebSocket('ws://localhost:3000')

ws.onopen = () => {
  ws.send('Hello Server!')
}

ws.onmessage = (event) => {
  console.log('Received:', event.data)
}
```

## Server Options

### Server Configuration

```ts
Bun.serve({
  port: 3000,
  hostname: 'localhost',
  development: true,
  fetch(req) {
    return new Response('Hello')
  }
})
```

### Error Handling

```ts
Bun.serve({
  port: 3000,
  async fetch(req) {
    try {
      const data = await fetchData()
      return new Response(JSON.stringify(data), {
        headers: { 'Content-Type': 'application/json' }
      })
    } catch (error) {
      return new Response('Internal Server Error', { status: 500 })
    }
  }
})
```

## Best Practices

1. **Use async/await**: For async operations
2. **Handle errors**: Proper error handling
3. **Set headers**: Correct content types
4. **Use routes**: Organize your routes
5. **Use WebSocket**: For real-time features

## Common Mistakes

❌ **Not handling async operations**

```ts
Bun.serve({
  port: 3000,
  fetch(req) {
    const data = fetchData() // ❌ Not awaited
    return new Response(JSON.stringify(data))
  }
})
```

✅ **Handling async operations**

```ts
Bun.serve({
  port: 3000,
  async fetch(req) {
    const data = await fetchData() // ✅ Awaited
    return new Response(JSON.stringify(data))
  }
})
```

❌ **Not setting content type**

```ts
Bun.serve({
  port: 3000,
  fetch(req) {
    return new Response(JSON.stringify({ data: 'test' })) // ❌ No content type
  }
})
```

✅ **Setting content type**

```ts
Bun.serve({
  port: 3000,
  fetch(req) {
    return new Response(JSON.stringify({ data: 'test' }), {
      headers: { 'Content-Type': 'application/json' } // ✅ Content type set
    })
  }
})
```

❌ **Not handling errors**

```ts
Bun.serve({
  port: 3000,
  async fetch(req) {
    const data = await fetchData() // ❌ No error handling
    return new Response(JSON.stringify(data))
  }
})
```

✅ **Handling errors**

```ts
Bun.serve({
  port: 3000,
  async fetch(req) {
    try {
      const data = await fetchData()
      return new Response(JSON.stringify(data))
    } catch (error) {
      return new Response('Internal Server Error', { status: 500 }) // ✅ Error handled
    }
  }
})
```
