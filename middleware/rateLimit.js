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

// Guards the AI concierge endpoint, which costs real money per request.
export const chatLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { msg: "Too many messages. Please wait a moment and try again." },
});

// Site-wide daily ceiling on AI concierge messages, on top of the per-IP limiter above.
// Caps worst-case spend if the endpoint gets hit from many different IPs at once
// (bot scraping, a link getting shared, etc). Resets at local midnight.
// In-memory: fine for a single server process; resets on restart/deploy.
const DAILY_CAP = Number(process.env.AGENT_DAILY_MESSAGE_CAP) || 500;
let dailyCount = 0;
let dailyResetDate = new Date().toDateString();

export const chatDailyCap = (req, res, next) => {
  const today = new Date().toDateString();
  if (today !== dailyResetDate) {
    dailyResetDate = today;
    dailyCount = 0;
  }
  if (dailyCount >= DAILY_CAP) {
    return res.status(429).json({
      msg: "Our AI assistant has reached its message limit for today. Please try again tomorrow or contact us directly.",
    });
  }
  dailyCount++;
  next();
};
