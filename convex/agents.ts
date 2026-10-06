import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

/**
 * Phase 2: Create a new agent record with 'provisioning' status.
 */
export const create = mutation({
  args: {
    name: v.string(),
    description: v.string(),
    datasets: v.array(v.string()),
    tools: v.array(v.string()),
    status: v.optional(v.string()),
    templateVersion: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const agentId = await ctx.db.insert("agents", {
      name: args.name,
      description: args.description,
      datasets: args.datasets,
      tools: args.tools,
      status: args.status ?? "provisioning",
      templateVersion: args.templateVersion ?? "v1",
    });
    return agentId;
  },
});

/**
 * Phase 6 & Error handling: Update status to 'live' or 'failed', and optionally save cloudRunUrl.
 */
export const updateStatus = mutation({
  args: {
    id: v.id("agents"),
    status: v.string(),
    cloudRunUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args;
    await ctx.db.patch(id, updates);
  },
});

/**
 * Phase 5 Runtime: Fetch agent configuration by ID during container cold-start.
 */
export const getById = query({
  args: {
    id: v.id("agents"),
  },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

/**
 * UI / Control Plane: List all agents ordered by newest first.
 */
export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("agents").order("desc").collect();
  },
});
