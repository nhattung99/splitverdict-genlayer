const { spawnSync } = require('child_process');
const path = require('path');

const script = path.join(__dirname, '..', 'frontend', 'scripts', 'check-no-float-money.cjs');
const result = spawnSync(process.execPath, [script], { stdio: 'inherit' });
process.exit(result.status ?? 1);
