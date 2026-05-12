# Use a lightweight Node.js image
FROM node:22-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies (including devDependencies for building)
RUN npm install

# Copy all source files
COPY . .

# Build the frontend assets
RUN npm run build

# Prune dev dependencies to keep image small
# Note: if using tsx in production, we need it installed. 
# Since we keep tsx, we don't prune everything or we ensure tsx is in dependencies.
# For simplicity and to avoid build errors, we'll keep the dependencies as is for now.

# Environment variables
ENV NODE_ENV=production
ENV PORT=3000

# Expose the application port
EXPOSE 3000

# Start the server using tsx to run the TypeScript entry point
# This is the easiest way to run the fullstack app in one container
CMD ["npx", "tsx", "server.ts"]
