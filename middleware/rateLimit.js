import rateLimit from "express-rate-limit";

const makeLoginLimiter = () =>
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { msg: "Too many login attempts. Please try again in 15 minutes." },
    skipSuccessfulRequests: true,
  });

// Separate instances so a lockout on one endpoint (e.g. user login)
// doesn't also block the other (e.g. admin login) for the same IP.
export const loginLimiter = makeLoginLimiter();
export const adminLoginLimiter = makeLoginLimiter();
