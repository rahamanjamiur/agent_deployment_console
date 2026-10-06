# Agent Deployment Console Architecture & Flowchart

This document illustrates the architecture and execution flows for the Agent Deployment Console prototype.

---

## 1. High-Level System Architecture

```mermaid
graph TB
    subgraph ClientLayer["Client & Dashboard Layer"]
        User["Workspace User"]
        UI["React Deployment Dashboard\n(http://localhost:3000)"]
        User -->|1. Configures Agent & Clicks Deploy| UI
    end

    subgraph ControlPlane["Control Plane (Express Backend)"]
        Server["Express Server\n(server.ts)"]
        UI -->|POST /api/deploy| Server
    end

    subgraph PersistenceLayer["Data & Persistence Layer"]
        Convex["Convex Database\n(agents table)"]
        Postgres["PostgreSQL Database\n(platform_agent_db)"]
        
        Server -->|Phase 2: Save Config| Convex
        Server -->|Phase 2.5: CREATE SCHEMA agent_id| Postgres
    end

    subgraph CloudLayer["Google Cloud Platform (Serverless Infrastructure)"]
        ArtifactRegistry["Artifact Registry\n(Docker Image: agent-template:v1)"]
        CloudRunAdmin["Cloud Run Admin API\n(@google-cloud/run)"]
        CloudRunService["Cloud Run Agent Service\n(deployed endpoint)"]
        
        Server -->|Phase 4: Provisions Service| CloudRunAdmin
        CloudRunAdmin -->|Pulls Image| ArtifactRegistry
        CloudRunAdmin -->|Deploys Container| CloudRunService
    end

    subgraph AgentRuntime["Agent Container Runtime (agent-template/server.js)"]
        CloudRunService -->|Boot Phase 5: Fetch Config| Convex
        CloudRunService -->|Reads Key & Schema| EnvVars["Environment Variables\n(GEMINI_API_KEY, DB_SCHEMA)"]
        
        EndUser["End User / API Client"] -->|POST /api/chat| CloudRunService
        CloudRunService -->|LLM Inference| Gemini["Google Gemini 2.5 Flash"]
        CloudRunService -->|Persist Conversations & Messages| Postgres
    end
```

---

## 2. End-to-End Agent Deployment Pipeline Flowchart

This flowchart shows the 6-phase pipeline that executes when a user clicks **Deploy Agent**:

```mermaid
sequenceDiagram
    autonumber
    actor User as Developer / User
    participant UI as React Dashboard (App.tsx)
    participant Server as Control Plane (server.ts)
    participant Convex as Convex Database
    participant Postgres as PostgreSQL (Database)
    participant GCP as Google Cloud Run API

    User->>UI: Enter Name, Description, select Datasets & Tools
    User->>UI: Click "Deploy Agent"
    UI->>Server: POST /api/deploy { name, description, datasets, tools }
    
    rect rgb(235, 245, 255)
        note over Server,Convex: Phase 2: Agent Configuration Persistence
        Server->>Convex: mutation(api.agents.create, status: "provisioning")
        Convex-->>Server: Returns a unique agentId
    end

    rect rgb(245, 245, 245)
        note over Server,Postgres: Phase 2.5: Dedicated Schema Isolation
        Server->>Postgres: CREATE SCHEMA IF NOT EXISTS "agent_<agentId>"
        Server->>Postgres: CREATE TABLE "agent_<agentId>".conversations (...)
        Server->>Postgres: CREATE TABLE "agent_<agentId>".messages (...)
        Postgres-->>Server: Schema & Tables Provisioned
    end

    rect rgb(240, 255, 240)
        note over Server,GCP: Phase 4: Google Cloud Run Provisioning
        Server->>GCP: ServicesClient.createService(serviceId, TEMPLATE_IMAGE_URL)
        note over Server,GCP: Injects AGENT_ID, GEMINI_API_KEY, DATABASE_URL, DB_SCHEMA
        GCP-->>Server: Service created, returns the deployed endpoint
        Server->>GCP: setIamPolicy(roles/run.invoker -> allUsers)
        GCP-->>Server: Public access granted
    end

    rect rgb(255, 250, 235)
        note over Server,Convex: Phase 6: Live Status Update
        Server->>Convex: mutation(api.agents.updateStatus, status: "live", cloudRunUrl: liveUrl)
        Convex-->>Server: Status updated
    end

    Server-->>UI: { success: true, url: liveUrl, snippet: "curl ..." }
    UI->>User: Displays Green Success Card, Live URL, and Copyable curl command
```

---

## 3. Runtime Chat Execution & Message Persistence Flowchart

Once deployed, the agent service runs independently on Google Cloud Run:

```mermaid
sequenceDiagram
    autonumber
    actor Client as API Client / Web User
    participant Agent as Cloud Run Container (server.js)
    participant Convex as Convex (Config Store)
    participant Postgres as PostgreSQL (agent_<id> schema)
    participant Gemini as Google Gemini AI (LLM)

    opt Cold-Start Boot (Once per instance)
        Agent->>Convex: query(agents:getById, id: AGENT_ID)
        Convex-->>Agent: Returns name, systemPrompt, datasets, tools
        Agent->>Agent: Cache configuration in memory
    end

    Client->>Agent: POST /api/chat { message: "What is traffic like?", conversationId?: string }
    
    rect rgb(245, 245, 255)
        note over Agent,Postgres: Log User Message
        alt conversationId is null
            Agent->>Postgres: INSERT INTO "agent_<id>".conversations (user_id) RETURNING id
            Postgres-->>Agent: Returns new conversationId
        end
        Agent->>Postgres: INSERT INTO "agent_<id>".messages (conversation_id, role="user", content)
    end

    rect rgb(240, 255, 240)
        note over Agent,Gemini: AI Inference
        Agent->>Gemini: generateContent(model="gemini-2.5-flash", systemInstruction, prompt)
        Gemini-->>Agent: Returns AI Reply text
    end

    rect rgb(245, 245, 255)
        note over Agent,Postgres: Log AI Reply
        Agent->>Postgres: INSERT INTO "agent_<id>".messages (conversation_id, role="assistant", content)
    end

    Agent-->>Client: { reply: "...", agentName: "Assistant", conversationId: "...", status: "success" }
```

---

## 4. Multi-Tenant Isolation Model

```mermaid
graph TD
    subgraph PostgreSQLInstance["PostgreSQL Server: platform_agent_db"]
        subgraph Schema1["Schema: agent_<id> (Agent One)"]
            T1["conversations (id, user_id, created_at)"]
            T2["messages (id, conversation_id, role, content)"]
        end
        
        subgraph Schema2["Schema: agent_j57bkv2d... (Weather Assistant)"]
            T3["conversations (id, user_id, created_at)"]
            T4["messages (id, conversation_id, role, content)"]
        end

        subgraph Schema3["Schema: agent_j57efb8z... (Custom Agent)"]
            T5["conversations (id, user_id, created_at)"]
            T6["messages (id, conversation_id, role, content)"]
        end
    end
```

### Key Architectural Benefits:
1. **Zero Cross-Contamination**: Each agent can only write and read from its own schema (`DB_SCHEMA`).
2. **Instant Deletion**: Deleting an agent drops only that specific schema (`DROP SCHEMA "agent_<id>" CASCADE;`) without table locking or migration overhead.
3. **10-15s Provisioning Speed**: Because the Golden Image (`agent-template:v1`) is already in Artifact Registry, Cloud Run provisions instantly without compiling source code.
