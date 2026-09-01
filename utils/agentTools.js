// utils/agentTools.js
// Shared Claude client + read-only data tools used by both the guest concierge
// agent (agent.controller.js) and the marketing agent (marketingAgent.controller.js),
// so both work off the same real inventory and the same regex-safety fix.
import Anthropic from "@anthropic-ai/sdk";
import Property from "../models/property.model.js";
import Package from "../models/package.model.js";

export const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
  // Only some API keys ("identity-linked" ones from console.anthropic.com) require this;
  // leave ANTHROPIC_WORKSPACE_ID unset if your key doesn't need it.
  defaultHeaders: process.env.ANTHROPIC_WORKSPACE_ID
    ? { "anthropic-workspace-id": process.env.ANTHROPIC_WORKSPACE_ID }
    : undefined,
});

export const MODEL = "claude-haiku-4-5-20251001";

export const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export const SEARCH_PACKAGES_TOOL = {
  name: "search_packages",
  description: "Search the company's safari packages by keyword, category, or price range.",
  input_schema: {
    type: "object",
    properties: {
      query: { type: "string", description: "Free-text search against the package name/location" },
      category: { type: "string", enum: ["Wildlife", "Photography", "Luxury", "Family", "Adventure"] },
      maxPrice: { type: "number" },
      minPrice: { type: "number" },
      featured: { type: "boolean", description: "Only return featured/popular packages" },
    },
  },
};

export const SEARCH_PROPERTIES_TOOL = {
  name: "search_properties",
  description: "Search the company's lodges/properties by keyword, category, location, or price.",
  input_schema: {
    type: "object",
    properties: {
      query: { type: "string", description: "Free-text search against the property name" },
      category: { type: "string", enum: ["bush", "beach"] },
      location: { type: "string" },
      maxPrice: { type: "number", description: "Max base price per night" },
    },
  },
};

export async function runSearchPackages({ query, category, maxPrice, minPrice, featured }) {
  const q = {};
  if (query) {
    const safe = escapeRegex(query);
    q.$or = [{ name: { $regex: safe, $options: "i" } }, { location: { $regex: safe, $options: "i" } }];
  }
  if (category) q.category = category;
  if (featured !== undefined) q.featured = featured;
  if (maxPrice !== undefined || minPrice !== undefined) {
    q.price = {};
    if (maxPrice !== undefined) q.price.$lte = maxPrice;
    if (minPrice !== undefined) q.price.$gte = minPrice;
  }
  const packages = await Package.find(q).limit(6).lean();
  return packages.map((p) => ({
    id: p._id,
    name: p.name,
    location: p.location,
    price: p.price,
    duration: p.duration,
    category: p.category,
    rating: p.rating,
    featured: p.featured,
    destinations: p.destinations,
    image: p.image || p.mainImage,
  }));
}

export async function runSearchProperties({ query, category, location, maxPrice }) {
  const q = {};
  if (query) q.name = { $regex: escapeRegex(query), $options: "i" };
  if (category) q.category = category;
  if (location) q.location = { $regex: escapeRegex(location), $options: "i" };
  if (maxPrice !== undefined) q.basePricePerNight = { $lte: maxPrice };
  const properties = await Property.find(q).limit(6).lean();
  return properties.map((p) => ({
    id: p._id,
    name: p.name,
    location: p.location,
    basePricePerNight: p.basePricePerNight,
    category: p.category,
    rating: p.rating,
    featured: p.featured,
    images: p.images,
  }));
}
