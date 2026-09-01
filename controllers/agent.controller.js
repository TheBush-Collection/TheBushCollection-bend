// controllers/agent.controller.js
import Booking from "../models/booking.model.js";
import {
  anthropic,
  MODEL,
  SEARCH_PACKAGES_TOOL,
  SEARCH_PROPERTIES_TOOL,
  runSearchPackages,
  runSearchProperties,
} from "../utils/agentTools.js";

const MAX_TOOL_ITERATIONS = 4;
const MAX_HISTORY_MESSAGES = 20;
const MAX_MESSAGE_LENGTH = 2000;

const SYSTEM_PROMPT = `You are the Safari Assistant, a warm and concise concierge for The Bush Collection, a safari lodge and property booking company in East Africa.

Facts you can state directly without a tool:
- Cancellation policy: cancel within 24h of booking → 100% refund; 7+ days before check-in → 75% refund + $25 fee; 2-7 days before → 50% refund + $50 fee; under 48h → no refund. Guests need their Booking ID from their confirmation email, and should use the cancellation request page or contact support to actually process it.
- Contact: Mon-Fri, 8 AM - 5 PM EAT. Phone +254 700 613165, email info@thebushcollection.africa.

Rules:
- For anything about specific packages, properties, prices, or a guest's booking, ALWAYS call a tool rather than guessing — never invent a name, price, or availability.
- You cannot make, modify, or cancel a booking yourself. Point guests to the "Book Now" page for new bookings and the cancellation request page or contact support for cancellations.
- Keep replies short (2-4 sentences plus any tool results) and friendly. This is a chat widget, not an email.
- If a question is unrelated to travel/bookings, politely redirect to what you can help with.`;

const TOOLS = [
  SEARCH_PACKAGES_TOOL,
  SEARCH_PROPERTIES_TOOL,
  {
    name: "get_booking_status",
    description: "Look up a guest's booking status. Requires BOTH the booking ID and the email used to book — never call this without an email supplied by the guest in this conversation.",
    input_schema: {
      type: "object",
      properties: {
        bookingId: { type: "string" },
        email: { type: "string" },
      },
      required: ["bookingId", "email"],
    },
  },
];

async function runGetBookingStatus({ bookingId, email }) {
  if (!bookingId || !email) return { found: false, reason: "Missing bookingId or email" };
  const booking = await Booking.findOne({
    bookingId: bookingId.trim(),
    customerEmail: email.trim().toLowerCase(),
  }).lean();
  if (!booking) return { found: false };
  return {
    found: true,
    bookingId: booking.bookingId,
    status: booking.status,
    checkInDate: booking.checkInDate,
    checkOutDate: booking.checkOutDate,
    totalGuests: booking.totalGuests,
    total: booking.costs?.total,
  };
}

async function executeTool(name, input) {
  switch (name) {
    case "search_packages":
      return { packages: await runSearchPackages(input) };
    case "search_properties":
      return { properties: await runSearchProperties(input) };
    case "get_booking_status":
      return await runGetBookingStatus(input);
    default:
      return { error: `Unknown tool: ${name}` };
  }
}

function sanitizeHistory(messages) {
  if (!Array.isArray(messages)) return [];
  return messages
    .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
    .slice(-MAX_HISTORY_MESSAGES)
    .map((m) => ({ role: m.role, content: m.content.slice(0, MAX_MESSAGE_LENGTH) }));
}

export const chatWithAgent = async (req, res) => {
  try {
    if (!process.env.ANTHROPIC_API_KEY) {
      return res.status(503).json({ message: "The assistant is not configured yet." });
    }

    const history = sanitizeHistory(req.body?.messages);
    if (history.length === 0 || history[history.length - 1].role !== "user") {
      return res.status(400).json({ message: "messages must end with a user message." });
    }

    const conversation = [...history];
    const collectedPackages = [];
    const collectedProperties = [];

    let finalText = "";
    for (let i = 0; i < MAX_TOOL_ITERATIONS; i++) {
      const response = await anthropic.messages.create({
        model: MODEL,
        max_tokens: 512,
        system: SYSTEM_PROMPT,
        tools: TOOLS,
        messages: conversation,
      });

      const toolUses = response.content.filter((block) => block.type === "tool_use");
      const textBlocks = response.content.filter((block) => block.type === "text");
      finalText = textBlocks.map((b) => b.text).join("\n").trim();

      if (response.stop_reason !== "tool_use" || toolUses.length === 0) break;

      conversation.push({ role: "assistant", content: response.content });

      const toolResults = [];
      for (const toolUse of toolUses) {
        const result = await executeTool(toolUse.name, toolUse.input || {});
        if (result.packages) collectedPackages.push(...result.packages);
        if (result.properties) collectedProperties.push(...result.properties);
        toolResults.push({
          type: "tool_result",
          tool_use_id: toolUse.id,
          content: JSON.stringify(result),
        });
      }
      conversation.push({ role: "user", content: toolResults });
    }

    res.json({
      text: finalText || "Sorry, I couldn't come up with a response — could you rephrase that?",
      packages: collectedPackages.slice(0, 4),
      properties: collectedProperties.slice(0, 4),
    });
  } catch (err) {
    console.error("Agent chat error:", err);
    res.status(500).json({ message: "The assistant hit a problem. Please try again." });
  }
};
