import 'dotenv/config';
import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { ConvexHttpClient } from 'convex/browser';
import { api } from './convex/_generated/api.js';
import { ServicesClient } from '@google-cloud/run';
import { GoogleAuth } from 'google-auth-library';
import pg from 'pg';

const { Pool } = pg;
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

// Initialize Convex Client if configured
const convexClient = process.env.CONVEX_DEPLOYMENT
  ? new ConvexHttpClient(process.env.CONVEX_DEPLOYMENT)
  : null;

async function startServer() {
  const app = express();
  
  // Parse JSON bodies
  app.use(express.json());

  // API Routes
  app.post('/api/deploy', async (req, res) => {
    const { name, description, datasets, tools } = req.body;
    
    console.log(`\n========================================`);
    console.log(`Starting Phase 2-6 Deployment Pipeline for: "${name}"`);
    console.log(`========================================`);

    let agentId: any = null;

    try {
      // --- PHASE 2: Agent Config Persistence ---
      console.log('[Phase 2] Saving config to Convex...');
      
      if (convexClient) {
        agentId = await convexClient.mutation(api.agents.create, {
          name,
          description: description || '',
          datasets: datasets || [],
          tools: tools || [],
          status: 'provisioning',
          templateVersion: 'v1',
        });
        console.log(`[Phase 2] Agent record created in Convex with ID: ${agentId}`);
      } else {
        agentId = `agent-${Date.now()}`;
        console.warn('[Phase 2] CONVEX_DEPLOYMENT not found in environment, using mock agent ID:', agentId);
      }

      // [PLACEHOLDER - WORKOS]: Secret storage in WorkOS Vault (Disabled/Commented out)
      // const workos = new WorkOS(process.env.WORKOS_API_KEY);
      // await workos.vault.createSecret({ name: `${agentId}-gemini-key`, value: process.env.GEMINI_API_KEY });

      // --- PHASE 2.5: PostgreSQL Schema & Table Provisioning ---
      const sanitizedId = String(agentId).replace(/[^a-zA-Z0-9_]/g, '_');
      const dbSchemaName = `agent_${sanitizedId}`;

      if (process.env.DATABASE_URL) {
        console.log(`[Phase 2.5] Provisioning PostgreSQL isolated schema: "${dbSchemaName}"...`);
        const pool = new Pool({
          connectionString: process.env.DATABASE_URL,
          ssl: {
            rejectUnauthorized: false,
          },
        });
        try {
          await pool.query(`CREATE SCHEMA IF NOT EXISTS "${dbSchemaName}";`);
          await pool.query(`
            CREATE TABLE IF NOT EXISTS "${dbSchemaName}".conversations (
              id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
              user_id TEXT,
              created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            );
            CREATE TABLE IF NOT EXISTS "${dbSchemaName}".messages (
              id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
              conversation_id UUID REFERENCES "${dbSchemaName}".conversations(id) ON DELETE CASCADE,
              role TEXT NOT NULL,
              content TEXT NOT NULL,
              created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            );
          `);
          console.log(`[Phase 2.5] Schema "${dbSchemaName}" and tables successfully provisioned in PostgreSQL.`);
        } finally {
          await pool.end();
        }
      } else {
        console.warn('[Phase 2.5] DATABASE_URL not set; skipping PostgreSQL schema provisioning.');
      }

      // --- PHASE 4: Provision Cloud Run service ---
      console.log('[Phase 4] Provisioning Cloud Run service...');
      let liveUrl = '';

      if (
        process.env.GCP_PROJECT_ID &&
        process.env.GCP_REGION &&
        process.env.TEMPLATE_IMAGE_URL
      ) {
        const credsEnv = process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim();
        let auth: GoogleAuth;

        if (credsEnv) {
          if (credsEnv.startsWith('{')) {
            // Direct JSON string
            auth = new GoogleAuth({
              credentials: JSON.parse(credsEnv),
              scopes: ['https://www.googleapis.com/auth/cloud-platform'],
            });
          } else if (credsEnv.startsWith('ey') || (!credsEnv.includes('/') && !credsEnv.endsWith('.json'))) {
            // Base64 encoded JSON string
            try {
              const decoded = Buffer.from(credsEnv, 'base64').toString('utf-8');
              auth = new GoogleAuth({
                credentials: JSON.parse(decoded),
                scopes: ['https://www.googleapis.com/auth/cloud-platform'],
              });
            } catch {
              auth = new GoogleAuth({
                keyFilename: path.resolve(process.cwd(), credsEnv),
                scopes: ['https://www.googleapis.com/auth/cloud-platform'],
              });
            }
          } else {
            // File path on disk
            auth = new GoogleAuth({
              keyFilename: path.resolve(process.cwd(), credsEnv),
              scopes: ['https://www.googleapis.com/auth/cloud-platform'],
            });
          }
        } else {
          auth = new GoogleAuth({
            scopes: ['https://www.googleapis.com/auth/cloud-platform'],
          });
        }

        const runClient = new ServicesClient({ auth });

        // Cloud Run service IDs must be lowercase, alphanumeric and dashes, max 63 chars
        const safeName = name
          .toLowerCase()
          .replace(/[^a-z0-9]/g, '-')
          .replace(/-+/g, '-')
          .replace(/^-|-$/g, '')
          .slice(0, 35) || 'agent';
        const serviceId = `agent-${safeName}-${Date.now().toString().slice(-6)}`;

        const parent = `projects/${process.env.GCP_PROJECT_ID}/locations/${process.env.GCP_REGION}`;
        console.log(`[Phase 4] Deploying Cloud Run service "${serviceId}" to ${parent}...`);

        const request = {
          parent,
          serviceId,
          service: {
            ingress: 'INGRESS_TRAFFIC_ALL',
            template: {
              containers: [
                {
                  image: process.env.TEMPLATE_IMAGE_URL,
                  env: [
                    { name: 'AGENT_ID', value: String(agentId) },
                    { name: 'GEMINI_API_KEY', value: process.env.GEMINI_API_KEY || '' },
                    { name: 'DATABASE_URL', value: process.env.DATABASE_URL || '' },
                    { name: 'DB_SCHEMA', value: dbSchemaName },
                    { name: 'CONVEX_URL', value: process.env.CONVEX_DEPLOYMENT || '' },
                  ],
                  ports: [{ containerPort: 8080 }],
                },
              ],
            },
          },
        };

        const [operation] = await runClient.createService(request);
        console.log('[Phase 4] Waiting for Cloud Run service creation operation to complete...');
        const [response] = await operation.promise();
        liveUrl = response.uri || '';
        console.log(`[Phase 4] Cloud Run service successfully deployed at: ${liveUrl}`);

        // Set public invoker policy (allows calling /api/chat without authentication)
        try {
          if (response.name) {
            const [currentPolicy] = await runClient.getIamPolicy({ resource: response.name });
            const bindings = currentPolicy.bindings || [];
            const invokerBinding = bindings.find((b) => b.role === 'roles/run.invoker');

            if (invokerBinding) {
              if (!invokerBinding.members?.includes('allUsers')) {
                invokerBinding.members = [...(invokerBinding.members || []), 'allUsers'];
              }
            } else {
              bindings.push({
                role: 'roles/run.invoker',
                members: ['allUsers'],
              });
            }

            currentPolicy.bindings = bindings;
            await runClient.setIamPolicy({
              resource: response.name,
              policy: currentPolicy,
            });
            console.log('[Phase 4] Public access (roles/run.invoker -> allUsers) granted successfully.');
          }
        } catch (policyErr: any) {
          console.warn('[Phase 4] Could not set public IAM policy automatically:', policyErr.message);
        }
      } else {
        console.warn('[Phase 4] Missing GCP credentials in .env. Falling back to simulated Cloud Run deployment.');
        await new Promise((resolve) => setTimeout(resolve, 3000));
        const formattedName = name.toLowerCase().replace(/[^a-z0-9-]/g, '-');
        liveUrl = `https://${formattedName}-demo.example.invalid`;
      }

      // --- PHASE 6: Status & Output ---
      console.log(`[Phase 6] Updating Convex status to 'live' with URL: ${liveUrl}...`);
      if (convexClient && agentId) {
        try {
          await convexClient.mutation(api.agents.updateStatus, {
            id: agentId,
            status: 'live',
            cloudRunUrl: liveUrl,
          });
          console.log('[Phase 6] Convex status successfully updated to live.');
        } catch (convexErr: any) {
          console.warn('[Phase 6] Could not update Convex status:', convexErr.message);
        }
      }

      res.json({
        success: true,
        url: liveUrl,
        agentId: String(agentId),
        snippet: `curl -X POST ${liveUrl}/api/chat \\\n  -H "Content-Type: application/json" \\\n  -d '{"message": "Hello Agent!"}'`,
      });
    } catch (error: any) {
      console.error('[Deployment Error]:', error);
      
      if (convexClient && agentId) {
        try {
          await convexClient.mutation(api.agents.updateStatus, {
            id: agentId,
            status: 'failed',
          });
        } catch (err) {
          console.error('Failed to update agent status to failed:', err);
        }
      }

      res.status(500).json({
        success: false,
        error: error.message || 'Deployment failed',
      });
    }
  });

  // Vite middleware for UI in development, static serving in production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
