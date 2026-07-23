// 自动把 package.json 的版本号 patch +1（每次发更新用）
const fs = require('fs');
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const parts = pkg.version.split('.').map(Number);
parts[2] = (parts[2] || 0) + 1; // patch +1
pkg.version = parts.join('.');
fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n');
console.log('版本号已自增为 v' + pkg.version);
