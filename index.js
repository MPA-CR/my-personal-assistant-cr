// ESM wrapper for Render deployment
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

// Install tsx runner
require('tsx/dist/cli');
// Load your TypeScript server
// This simulates running "tsx server/index.ts" 
process.argv.push('server/index.ts');
