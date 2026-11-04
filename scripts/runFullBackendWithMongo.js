/**
 * Runner that boots local MongoDB, starts Express server, runs the integration test suites,
 * and cleanly shuts everything down.
 */

const { spawn } = require('child_process');
const net = require('net');
const http = require('http');
const path = require('path');
const fs = require('fs');

const MONGOD_BIN = 'C:\\Program Files\\MongoDB\\Server\\9.0\\bin\\mongod.exe';
const REPO_ROOT = path.resolve(__dirname, '..');
const MONGO_DATA = path.join(REPO_ROOT, '.mongo_data');
const SERVER_DIR = path.join(REPO_ROOT, 'server');

function checkPort(port, host = '127.0.0.1') {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(800);
    socket.on('connect', () => {
      socket.destroy();
      resolve(true);
    });
    socket.on('timeout', () => {
      socket.destroy();
      resolve(false);
    });
    socket.on('error', () => {
      socket.destroy();
      resolve(false);
    });
    socket.connect(port, host);
  });
}

function checkHttp(url) {
  return new Promise((resolve) => {
    const req = http.get(url, (res) => {
      resolve(res.statusCode === 200);
    });
    req.on('error', () => resolve(false));
    req.setTimeout(800, () => {
      req.destroy();
      resolve(false);
    });
  });
}

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  let mongodProcess = null;
  let serverProcess = null;

  try {
    console.log('[Runner] Checking MongoDB on port 27017...');
    let mongoRunning = await checkPort(27017);

    if (!mongoRunning) {
      if (!fs.existsSync(MONGOD_BIN)) {
        throw new Error(`mongod binary not found at ${MONGOD_BIN}`);
      }
      console.log(`[Runner] Starting mongod from ${MONGOD_BIN}...`);
      mongodProcess = spawn(MONGOD_BIN, ['--dbpath', MONGO_DATA, '--port', '27017', '--quiet'], {
        stdio: 'ignore',
        detached: false
      });

      // Wait up to 15s for mongod to be ready
      for (let i = 0; i < 30; i++) {
        await sleep(500);
        if (await checkPort(27017)) {
          mongoRunning = true;
          break;
        }
      }

      if (!mongoRunning) {
        throw new Error('Failed to connect to MongoDB on port 27017 after 15s');
      }
      console.log('[Runner] MongoDB is up and listening on port 27017.');
    } else {
      console.log('[Runner] MongoDB was already running on port 27017.');
    }

    console.log('[Runner] Checking server on port 5000...');
    let serverRunning = await checkHttp('http://localhost:5000/api/health');

    if (!serverRunning) {
      console.log('[Runner] Starting Express backend server...');
      serverProcess = spawn(process.execPath, ['server.js'], {
        cwd: SERVER_DIR,
        stdio: 'pipe',
        env: { ...process.env, NODE_ENV: 'test', PORT: '5000' }
      });

      serverProcess.stderr.on('data', (d) => {
        const str = d.toString();
        if (str.includes('Error')) console.error('[Server Err]', str.trim());
      });

      // Wait up to 20s for server /api/health
      for (let i = 0; i < 40; i++) {
        await sleep(500);
        if (await checkHttp('http://localhost:5000/api/health')) {
          serverRunning = true;
          break;
        }
      }

      if (!serverRunning) {
        throw new Error('Failed to reach http://localhost:5000/api/health after 20s');
      }
      console.log('[Runner] Express backend server is healthy on http://localhost:5000.');
    } else {
      console.log('[Runner] Express backend was already running on http://localhost:5000.');
    }

    // Now execute tests
    console.log('\n======================================================');
    console.log('⚡ EXECUTING LIVE INTEGRATION SUITES AGAINST LIVE BACKEND');
    console.log('======================================================\n');

    const testsToRun = [
      { name: 'Multi-User Chat Suite', file: path.join(__dirname, 'verifyMultiUserChat.js') },
      { name: 'Chat History Persistence Suite', file: path.join(__dirname, 'verifyChatHistoryPersistence.js') },
      { name: 'Phone Chat & Pending Suite', file: path.join(SERVER_DIR, 'tests', 'integration', 'phoneChatAndPendingSuite.test.js') }
    ];

    let allPassed = true;

    for (const t of testsToRun) {
      console.log(`\n▶ [Executing ${t.name}]...`);
      const exitCode = await new Promise((resolve) => {
        const child = spawn(process.execPath, [t.file], {
          cwd: REPO_ROOT,
          stdio: 'inherit',
          env: { ...process.env, NODE_ENV: 'test' }
        });
        child.on('exit', (code) => resolve(code));
      });

      if (exitCode === 0) {
        console.log(`✔ [${t.name}] PASSED!`);
      } else {
        console.error(`✖ [${t.name}] FAILED with code ${exitCode}`);
        allPassed = false;
      }
    }

    if (!allPassed) {
      process.exitCode = 1;
    } else {
      console.log('\n🎉 ALL LIVE INTEGRATION SUITES PASSED SUCCESSFULLY!');
    }
  } catch (err) {
    console.error('[Runner Fatal Error]', err.message);
    process.exitCode = 1;
  } finally {
    if (serverProcess) {
      console.log('[Runner] Terminating spawned server...');
      serverProcess.kill('SIGTERM');
    }
    if (mongodProcess) {
      console.log('[Runner] Terminating spawned mongod...');
      mongodProcess.kill('SIGTERM');
    }
  }
}

main();
