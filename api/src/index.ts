import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { PrismaClient } from '../generated/prisma/index.js'
import { cors } from 'hono/cors';

const app = new Hono();
const prisma = new PrismaClient();

app.use(
  cors({
    origin: 'http://localhost:3000',
  })
)

app.get('/', (c) => {
  return c.text('Hello Hono!')
})

app.get("/todos", async(c) => {
  const todos = await prisma.todo.findMany();
  return c.json(todos);
})

app.post("/todos", async(c) => {
  const { title } = await c.req.json();
  if(!title) {
    return c.json({ error: 'Title is required' }, 400);
  }
  
  const todo = await prisma.todo.create({
    data: { title }
  });
  return c.json(todo);
})

app.put("/todos/:id", async(c) => {
  const id = Number(c.req.param('id'));
  const body = await c.req.json();
  const { title, completed } = body;

  try {
    const todo = await prisma.todo.update({
      where: { id },
      data: { title, completed }
    });
    return c.json(todo);
  } catch (error) {
    return c.json({ error: 'Todo not found' }, 404);
  }
});

app.delete("/todos/:id", async(c) => {
  const id = Number(c.req.param('id'));

  try {
    await prisma.todo.delete({ where: { id }});
    return c.json({ success: true });
  } catch (error) {
    return c.json({ error: 'Todo not found' }, 404);
  }
});

serve({
  fetch: app.fetch,
  port: 8080
}, (info) => {
  console.log(`Server is running on http://localhost:${info.port}`)
})
