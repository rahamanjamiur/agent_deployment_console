import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // Phase 2: Agent Configuration Storage
  agents: defineTable({
    name: v.string(),
    description: v.string(),
    datasets: v.array(v.string()),
    tools: v.array(v.string()),
    
    // Status tracking for Phase 1 & 6 (UI reactivity)
    // Values: 'pending', 'provisioning', 'live', 'failed'
    status: v.string(),
    
    // The provisioned Cloud Run URL
    cloudRunUrl: v.optional(v.string()),
    
    // The specific template tag this agent is running (e.g., 'v1')
    templateVersion: v.string(),
  })
});
