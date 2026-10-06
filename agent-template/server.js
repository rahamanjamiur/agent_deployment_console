import express from 'express';
import { GoogleGenAI } from '@google/genai';
import { ConvexHttpClient } from 'convex/browser';
import pg from 'pg';

const { Pool } = pg;
const app = express();
app.use(express.json());

const PORT = process.env.PORT || 8080;
// AGENT_ID is injected by the Control Plane during Cloud Run provisioning
const AGENT_ID = process.env.AGENT_ID || 'local-dev-agent';
const DB_SCHEMA = process.env.DB_SCHEMA || 'public';

// In-memory cache for the agent's configuration (tackling cold-starts)
let agentConfig = null;
let geminiApiKey = process.env.GEMINI_API_KEY;

// Initialize Convex client if CONVEX_URL is provided
const convexClient = process.env.CONVEX_URL
  ? new ConvexHttpClient(process.env.CONVEX_URL)
  : null;

// Initialize PostgreSQL pool if DATABASE_URL is provided
const dbPool = process.env.DATABASE_URL
  ? new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: {
        rejectUnauthorized: false,
      },
    })
  : null;

/**
 * PHASE 5: Runtime Configuration Fetching
 * Fetches config from Convex on boot. WorkOS vault remains commented out.
 */
async function loadAgentConfiguration() {
  if (agentConfig) return agentConfig;

  console.log(`[Agent ${AGENT_ID}] Booting up and loading configuration...`);

  try {
    let fetchedConfig = null;

    // Fetch live configuration from Convex
    if (convexClient && AGENT_ID && AGENT_ID !== 'local-dev-agent') {
      try {
        console.log(`[Agent ${AGENT_ID}] Fetching configuration from Convex...`);
        fetchedConfig = await convexClient.query('agents:getById', { id: AGENT_ID });
      } catch (convexErr) {
        console.warn(`[Agent ${AGENT_ID}] Could not fetch from Convex, using fallback:`, convexErr.message);
      }
    }

    // Default fallback configuration if Convex record is not found or in local testing
    agentConfig = fetchedConfig || {
      name: "AI Assistant",
      description: "A helpful general-purpose assistant.",
      datasets: [],
      tools: []
    };

    // [PLACEHOLDER - WORKOS VAULT]: Kept disabled/commented out
    // const workos = new WorkOS(process.env.WORKOS_API_KEY);
    // const secret = await workos.vault.getSecret(`${AGENT_ID}-gemini-key`);
    // if (secret?.value) geminiApiKey = secret.value;

    // Read Gemini API Key directly from environment
    if (process.env.GEMINI_API_KEY) {
      geminiApiKey = process.env.GEMINI_API_KEY;
    }

    console.log(`[Agent ${AGENT_ID}] Configuration loaded for: "${agentConfig.name}"`);
    return agentConfig;
  } catch (error) {
    console.error(`[Agent ${AGENT_ID}] Failed to load configuration:`, error);
    throw error;
  }
}

// Background pre-fetch configuration so cold-start delay is minimized
loadAgentConfiguration().catch(console.error);

// Primary chat endpoint for the agent
app.post('/api/chat', async (req, res) => {
  try {
    const { message, userId } = req.body;
    let { conversationId } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    // Ensure agent config is loaded
    const config = await loadAgentConfiguration();

    if (!geminiApiKey) {
      return res.status(500).json({ error: 'Gemini API key is not configured.' });
    }

    // --- PostgreSQL: Record User Message in Isolated Schema ---
    if (dbPool) {
      try {
        if (!conversationId) {
          const convRes = await dbPool.query(
            `INSERT INTO "${DB_SCHEMA}".conversations (user_id) VALUES ($1) RETURNING id`,
            [userId || 'anonymous']
          );
          conversationId = convRes.rows[0].id;
        }

        await dbPool.query(
          `INSERT INTO "${DB_SCHEMA}".messages (conversation_id, role, content) VALUES ($1, $2, $3)`,
          [conversationId, 'user', message]
        );
      } catch (dbErr) {
        console.error(`[DB Error - Schema ${DB_SCHEMA}] Failed to save user message:`, dbErr.message);
      }
    }

    // Initialize Gemini AI
    const ai = new GoogleGenAI({ apiKey: geminiApiKey });

    // Dynamic system prompt using datasets and tools from Convex
    const datasetsList = (config.datasets || []).join(', ');
    const toolsList = (config.tools || []).join(', ');
    const systemInstruction = `You are ${config.name}. ${config.description || ''} You have access to datasets: [${datasetsList}] and tools: [${toolsList}]. Provide helpful, accurate responses.`;

    // Generate LLM response
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: message,
      config: {
        systemInstruction: systemInstruction,
      },
    });

    const replyText = response.text || '';

    // --- PostgreSQL: Record Assistant Response ---
    if (dbPool && conversationId) {
      try {
        await dbPool.query(
          `INSERT INTO "${DB_SCHEMA}".messages (conversation_id, role, content) VALUES ($1, $2, $3)`,
          [conversationId, 'assistant', replyText]
        );
      } catch (dbErr) {
        console.error(`[DB Error - Schema ${DB_SCHEMA}] Failed to save assistant message:`, dbErr.message);
      }
    }

    res.json({
      reply: replyText,
      agentName: config.name,
      conversationId: conversationId || null,
      status: 'success',
    });

  } catch (error) {
    console.error('Chat error:', error);
    res.status(500).json({ error: 'Internal agent error' });
  }
});

// Health check endpoint required by Google Cloud Run
app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Agent Template runtime listening on port ${PORT} (Schema: ${DB_SCHEMA})`);
});
