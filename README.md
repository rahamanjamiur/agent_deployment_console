# Agent Deployment Console

A prototype control plane for configuring, provisioning, and deploying AI agents. Users select a name, description, datasets, and tools, then deploy a pre-built agent runtime and receive an API connection example.

## Architecture

The prototype currently uses:

* **React, Vite, and Tailwind CSS** for the deployment dashboard.
* **Express** for the control-plane API.
* **Convex** for agent configuration and deployment status.
* **PostgreSQL** for per-agent conversation history, stored in separate schemas (`agent_<id>`).
* **Google Cloud Run** and **Artifact Registry** for hosting the pre-built agent runtime.
* **Google Gemini** for model inference.

The dataset and tool choices are currently example catalog entries. The runtime includes their names in the model instructions; it does not yet connect to the underlying data sources or execute tools.

### Project structure

* `src/`: React deployment dashboard.
* `server.ts`: Express control plane that stores configuration, provisions database tables, and creates the runtime service.
* `agent-template/`: Node.js container runtime deployed for each agent.
  * `server.js`: Handles chat requests, loads agent configuration, calls the model, and records conversation history.
  * `Dockerfile`: Container image build specification.
* `convex/`: Configuration schema and agent queries/mutations.
* `FLOWCHART.md`: Deployment and runtime flow diagrams.

## Prerequisites

Configure your own accounts and resources before deploying:

1. **Cloud project and container hosting**: Enable the required service APIs, create a container image repository, and provide credentials with permission to create services and assign their runtime identity.
2. **Configuration store**: Create a Convex deployment for agent configuration and lifecycle status.
3. **PostgreSQL**: Provide a database for conversation history.
4. **Model API**: Create an API key for Google Gemini.

The deployment code is currently implemented for Google Cloud Run, Convex, PostgreSQL, and Gemini. This prototype is branding-neutral, not provider-agnostic.

## Local setup

### 1. Install dependencies

```bash
npm install
cd agent-template
npm install
cd ..
```

### 2. Configure environment variables

Copy the example file and replace each placeholder with values from your own environment:

```bash
cp .env.example .env
```

Set the model API key, cloud project and region, credentials, runtime image location, configuration-store deployment and key, and PostgreSQL connection string. Do not commit `.env` or real credentials.

### 3. Start the configuration-store development process

In a separate terminal:

```bash
npx convex dev
```

Leave it running to synchronize the schema and generate types in `convex/_generated`.

### 4. Build and publish the runtime image

Build and publish the `agent-template` image to a container registry you control. The configured cloud runtime requires a Linux AMD64 image; on Apple Silicon, include `--platform linux/amd64` when building.

```bash
cd agent-template
docker build --platform linux/amd64 -t "$TEMPLATE_IMAGE_URL" .
docker push "$TEMPLATE_IMAGE_URL"
cd ..
```

Authenticate Docker with your registry using the registry provider's documented setup before pushing.

### 5. Start the control plane

```bash
npm run dev
```

The dashboard is available at `http://localhost:3000`.

## Deploy and test an agent

1. Open `http://localhost:3000`.
2. Enter an agent name and description.
3. Select example datasets and tools.
4. Click **Deploy Agent**.
5. After deployment, send a chat request to the endpoint returned by the control plane:

```bash
curl -X POST "$AGENT_URL/api/chat" \
  -H "Content-Type: application/json" \
  -d '{"message": "Hello!"}'
```

The runtime responds with the agent's reply and records the conversation in its PostgreSQL schema. Public access is currently enabled by the deployment flow; add authentication and access controls before using this prototype with real users or data.
