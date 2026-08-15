// Two separate connections: once a Redis connection issues SUBSCRIBE it can
// no longer run general commands (e.g. PING for health checks), so the
// subscriber gets its own dedicated client.
export const REDIS_CLIENT = Symbol('REDIS_CLIENT');
export const REDIS_SUBSCRIBER_CLIENT = Symbol('REDIS_SUBSCRIBER_CLIENT');
