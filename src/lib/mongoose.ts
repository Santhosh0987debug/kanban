import mongoose from "mongoose";

/**
 * Resolves the MongoDB connection string with fail-fast configuration errors.
 * - Missing variable -> clear error naming where to set it.
 * - localhost/127.0.0.1 in production -> explicit refusal (serverless
 *   functions have no local MongoDB; attempting it surfaces only as a
 *   cryptic MongooseServerSelectionError ECONNREFUSED).
 * The URI itself is never logged or returned to clients.
 */
function resolveMongoUri(): string {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error(
      "Missing MONGODB_URI environment variable. Set it in .env.local for " +
        "local development or in the hosting provider's environment settings " +
        "(e.g. Vercel project settings) for production, using a MongoDB " +
        "Atlas connection string."
    );
  }
  if (
    // Local `next build` also runs with NODE_ENV=production, so exempt the
    // build phase — the guard targets hosted runtimes (e.g. Vercel),
    // where localhost MongoDB is unreachable.
    process.env.NODE_ENV === "production" &&
    process.env.NEXT_PHASE !== "phase-production-build" &&
    /^mongodb(\+srv)?:\/\/(localhost|127\.0\.0\.1)([:/?]|$)/.test(uri)
  ) {
    throw new Error(
      "Invalid MONGODB_URI for production: localhost/127.0.0.1 is " +
        "unreachable from hosted serverless functions. Set MONGODB_URI to " +
        "the production MongoDB Atlas connection string in the hosting " +
        "provider's environment settings."
    );
  }
  return uri;
}

const MONGODB_URI = resolveMongoUri();

interface MongooseCache {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
}

declare global {
  var _mongooseCache: MongooseCache | undefined;
}

const cached: MongooseCache = global._mongooseCache ?? {
  conn: null,
  promise: null,
};

if (!global._mongooseCache) {
  global._mongooseCache = cached;
}

/**
 * Cached Mongoose connection for Next.js App Router / serverless.
 * Reuses the same connection across HMR reloads and lambda invocations.
 */
export async function dbConnect(): Promise<typeof mongoose> {
  if (cached.conn) return cached.conn;

  if (!cached.promise) {
    cached.promise = mongoose.connect(MONGODB_URI, {
      dbName: "kanban",
      maxPoolSize: 10,
    });
  }

  try {
    cached.conn = await cached.promise;
  } catch (err) {
    cached.promise = null;
    throw err;
  }

  return cached.conn;
}
