// Simple seed runner — avoids PowerShell JSON quoting issues
// Run with: node run-seed.js

process.env.TS_NODE_TRANSPILE_ONLY = 'true';
require('ts-node').register({ transpileOnly: true });
require('./prisma/seed');
