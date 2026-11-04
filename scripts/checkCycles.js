/**
 * Circular Dependency Static Scanner for Flash Chat Client & Server
 */
const fs = require('fs');
const path = require('path');

function getFiles(dir, extensions) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat && stat.isDirectory()) {
      if (file !== 'node_modules' && file !== 'dist' && file !== '.git') {
        results = results.concat(getFiles(filePath, extensions));
      }
    } else {
      const ext = path.extname(file);
      if (extensions.includes(ext)) {
        results.push(filePath);
      }
    }
  });
  return results;
}

function resolveImport(importPath, currentFile, baseDir) {
  if (!importPath.startsWith('.')) return null; // Ignore node packages
  const dir = path.dirname(currentFile);
  let resolved = path.resolve(dir, importPath);
  
  const extensions = ['.js', '.jsx', '.json', ''];
  for (const ext of extensions) {
    const candidate = resolved + ext;
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
      return candidate;
    }
    const indexCandidate = path.join(resolved, 'index' + ext);
    if (fs.existsSync(indexCandidate) && fs.statSync(indexCandidate).isFile()) {
      return indexCandidate;
    }
  }
  return null;
}

function buildGraph(baseDir, extensions) {
  const files = getFiles(baseDir, extensions);
  const graph = {};
  const importRegex = /(?:import\s+(?:[\w*\s{},]*\s+from\s+)?['"]([^'"]+)['"]|require\(['"]([^'"]+)['"]\))/g;

  files.forEach(file => {
    graph[file] = [];
    const content = fs.readFileSync(file, 'utf8');
    let match;
    while ((match = importRegex.exec(content)) !== null) {
      const importTarget = match[1] || match[2];
      const resolved = resolveImport(importTarget, file, baseDir);
      if (resolved && !graph[file].includes(resolved)) {
        graph[file].push(resolved);
      }
    }
  });
  return graph;
}

function findCycles(graph) {
  const visited = {};
  const recStack = {};
  const cycles = [];

  function dfs(node, pathStack) {
    visited[node] = true;
    recStack[node] = true;
    pathStack.push(node);

    const neighbors = graph[node] || [];
    for (const neighbor of neighbors) {
      if (!visited[neighbor]) {
        dfs(neighbor, pathStack);
      } else if (recStack[neighbor]) {
        const cycleStartIndex = pathStack.indexOf(neighbor);
        const cycle = pathStack.slice(cycleStartIndex).concat(neighbor);
        cycles.push(cycle);
      }
    }

    pathStack.pop();
    recStack[node] = false;
  }

  Object.keys(graph).forEach(node => {
    if (!visited[node]) {
      dfs(node, []);
    }
  });

  return cycles;
}

console.log('========================================================================');
console.log('🔄 FLASH CHAT CIRCULAR DEPENDENCY STATIC AUDIT (madge/graph check)');
console.log('========================================================================\n');

const clientSrc = path.join(__dirname, '../client/src');
const serverSrc = path.join(__dirname, '../server');

const clientGraph = buildGraph(clientSrc, ['.js', '.jsx']);
const clientCycles = findCycles(clientGraph);

console.log(`[1] Client Graph Analysis (${Object.keys(clientGraph).length} source files audited):`);
if (clientCycles.length === 0) {
  console.log('  ✔ Client (/client/src): 0 circular import cycles detected.');
} else {
  console.log(`  ❌ Client detected ${clientCycles.length} circular cycles:`);
  clientCycles.forEach(c => console.log('    - ' + c.map(f => path.basename(f)).join(' -> ')));
}

const serverGraph = buildGraph(serverSrc, ['.js']);
const serverCycles = findCycles(serverGraph);

console.log(`\n[2] Server Graph Analysis (${Object.keys(serverGraph).length} source files audited):`);
if (serverCycles.length === 0) {
  console.log('  ✔ Server (/server): 0 circular import cycles detected.');
} else {
  console.log(`  ❌ Server detected ${serverCycles.length} circular cycles:`);
  serverCycles.forEach(c => console.log('    - ' + c.map(f => path.basename(f)).join(' -> ')));
}

console.log('\n========================================================================');
if (clientCycles.length === 0 && serverCycles.length === 0) {
  console.log('✅ Circular Dependency Audit: 0 Cycles Detected Across Repository!');
  console.log('========================================================================\n');
  process.exit(0);
} else {
  console.log('❌ Circular Dependency Audit Failed.');
  console.log('========================================================================\n');
  process.exit(1);
}
