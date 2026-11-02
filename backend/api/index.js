/**
 * Vercel Serverless Function entry point for Lakbay Backend API.
 *
 * Imports the Express app from src/server.js and exports it as the
 * Vercel-compatible handler. app.listen() is skipped on Vercel
 * (guarded by process.env.VERCEL check in server.js).
 *
 * Routes are mounted under /api in server.js, so Vercel should route
 * all /api/* requests to this function.
 */
import app from '../src/server.js';

export default app;
