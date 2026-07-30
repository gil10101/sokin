/**
 * Vercel serverless entrypoint.
 *
 * All configuration, middleware, routes, and error handling live in
 * src/index.ts — the single Express app used in every environment.
 * Keeping this file a bare re-export guarantees dev and production
 * cannot drift apart again.
 */
export { default } from '../src/index';
