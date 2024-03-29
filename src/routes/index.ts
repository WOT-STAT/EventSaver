import { Hono } from "hono";

import eventProcessor from './events/index'

const router = new Hono();

router.get("/api", c => {
  return c.json({
    status: 'online',
    time: new Date().toISOString(),
    version: '1.1.0',
    env: Bun.env.NODE_ENV
  })
})

router.route('/api/events', eventProcessor)

export default router
