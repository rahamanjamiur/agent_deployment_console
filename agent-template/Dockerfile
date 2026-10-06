# Base image for the Node.js agent runtime
FROM node:20-alpine

WORKDIR /app

# Copy dependency manifests
COPY package*.json ./
RUN npm ci --only=production

# Copy agent runtime source code
COPY . .

# Cloud Run expects the container to listen on PORT
ENV PORT=8080
ENV NODE_ENV=production

EXPOSE 8080

# Start the agent service
CMD ["npm", "start"]
