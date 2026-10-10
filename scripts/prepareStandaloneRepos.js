const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const SERVER_DIR = path.resolve(__dirname, '../../Flash-chat-server');
const CLIENT_DIR = path.resolve(__dirname, '../../Flash-chat-client');

console.log('⚡ Preparing Standalone Repositories for Flash Chat...\n');

// 1. Setup Server .gitignore
const serverGitignore = `# Dependencies
node_modules/
npm-debug.log*

# Environment files
.env
.env.local
.env.*.local
*.env

# Runtime uploads & logs
uploads/*
!uploads/.gitkeep
logs/
*.log
temp/
tmp/
scratch/

# OS & Editor
.DS_Store
Thumbs.db
.vscode/
.idea/
`;
fs.writeFileSync(path.join(SERVER_DIR, '.gitignore'), serverGitignore);
console.log('✔ Created Flash-chat-server/.gitignore');

// 2. Setup Server README.md
const serverReadme = `# ⚡ Flash Chat Server (Backend API & Realtime Engine)

Standalone backend server for **Flash Chat**, featuring dual JWT authentication, Socket.IO WebSockets, WebRTC call signaling, Google Gemini AI (Flash AI), zero-knowledge encrypted Pocket vault, contacts directory, and customer support desk.

## 🚀 Quick Start

### 1. Installation
\`\`\`bash
npm install
\`\`\`

### 2. Environment Configuration
Copy \`.env.example\` to \`.env\` and configure your keys:
\`\`\`bash
cp .env.example .env
\`\`\`

Key settings:
- \`PORT=5000\`
- \`MONGO_URI=mongodb://localhost:27017/flashchat\`
- \`CLIENT_URL=http://localhost:5173\`
- \`JWT_ACCESS_SECRET\` & \`JWT_REFRESH_SECRET\` (32+ chars)
- \`GEMINI_API_KEY\` (Optional - live generative AI)
- \`CLOUDINARY_*\` (Optional - cloud media storage)

### 3. Run Development Server
\`\`\`bash
npm run dev
\`\`\`
Server starts on [http://localhost:5000](http://localhost:5000).

### 4. Run Test Suites
\`\`\`bash
npm test
\`\`\`

## 🐳 Docker Deployment
\`\`\`bash
docker build -f Dockerfile.prod -t flash-chat-server .
docker run -p 5000:5000 --env-file .env flash-chat-server
\`\`\`

## 📖 API Documentation
See [\`API.md\`](./API.md) for full REST and WebSocket endpoint specifications.
`;
fs.writeFileSync(path.join(SERVER_DIR, 'README.md'), serverReadme);
console.log('✔ Created Flash-chat-server/README.md');

// 3. Setup Client .gitignore
const clientGitignore = `# Dependencies
node_modules/
npm-debug.log*

# Production build output
dist/
build/

# Environment files
.env
.env.local
.env.*.local
*.env

# OS & Editor
.DS_Store
Thumbs.db
.vscode/
.idea/
`;
fs.writeFileSync(path.join(CLIENT_DIR, '.gitignore'), clientGitignore);
console.log('✔ Created Flash-chat-client/.gitignore');

// 4. Setup Client README.md
const clientReadme = `# ⚡ Flash Chat Client (Frontend Web App & PWA)

Standalone modern React (Vite) frontend application for **Flash Chat**, featuring rich dark/light UI, 8-semantic-token design system, offline PWA support, WebRTC calling, Socket.IO messaging, zero-knowledge encrypted Pocket vault, and Flash AI assistant.

## 🚀 Quick Start

### 1. Installation
\`\`\`bash
npm install
\`\`\`

### 2. Environment Configuration
Copy \`.env.example\` to \`.env\`:
\`\`\`bash
cp .env.example .env
\`\`\`

Settings:
- \`VITE_API_URL=http://localhost:5000\`
- \`VITE_SOCKET_URL=http://localhost:5000\`

### 3. Run Development Server
\`\`\`bash
npm run dev
\`\`\`
Application opens on [http://localhost:5173](http://localhost:5173).

### 4. Build for Production
\`\`\`bash
npm run build
\`\`\`

### 5. Run Test Suites
\`\`\`bash
npm test
\`\`\`

## 🎨 Design System & Accessibility
See [\`DESIGN_SYSTEM.md\`](./DESIGN_SYSTEM.md) and [\`ACCESSIBILITY.md\`](./ACCESSIBILITY.md).
`;
fs.writeFileSync(path.join(CLIENT_DIR, 'README.md'), clientReadme);
console.log('✔ Created Flash-chat-client/README.md');

// 5. Initialize Git Repositories if not already initialized
function initGit(dir, repoName) {
  try {
    if (!fs.existsSync(path.join(dir, '.git'))) {
      execSync('git init', { cwd: dir, stdio: 'pipe' });
      execSync('git add -A', { cwd: dir, stdio: 'pipe' });
      execSync(`git -c user.name="Flash Chat" -c user.email="dev@flashchat.io" commit -m "feat: initial standalone ${repoName} release"`, { cwd: dir, stdio: 'pipe' });
      console.log(`✔ Initialized Git repository for ${repoName}`);
    } else {
      console.log(`ℹ Git repository already initialized for ${repoName}`);
    }
  } catch (err) {
    console.error(`Warning initializing git for ${repoName}:`, err.message);
  }
}

initGit(SERVER_DIR, 'Flash-chat-server');
initGit(CLIENT_DIR, 'Flash-chat-client');

console.log('\n🎉 Successfully created and initialized standalone backend and frontend repositories!');
