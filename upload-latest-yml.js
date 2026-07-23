// 发版后自动生成并上传 latest.yml（electron-builder 的 portable 目标不会自动生成它，
// 而 electron-updater 自动更新依赖这个文件）。运行前需设置环境变量 GH_TOKEN。
const fs = require('fs');
const crypto = require('crypto');

const token = process.env.GH_TOKEN;
if (!token) { console.error('缺少 GH_TOKEN 环境变量'); process.exit(1); }

const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const version = pkg.version;
const { owner, repo } = pkg.build.publish;

if (!owner || !repo) { console.error('package.json 的 build.publish 缺少 owner/repo'); process.exit(1); }

// 找到本地刚构建好的 portable exe（与上传到 GitHub 的是同一份字节）
const distDir = 'dist';
const exeName = fs.readdirSync(distDir).find(f => /便携版|portable/i.test(f) && f.endsWith('.exe'))
  || fs.readdirSync(distDir).find(f => f.endsWith('.exe') && !f.endsWith('.blockmap'));
if (!exeName) { console.error('dist/ 下找不到构建好的 .exe'); process.exit(1); }

const buf = fs.readFileSync(`${distDir}/${exeName}`);
const sha512 = crypto.createHash('sha512').update(buf).digest('base64');
const size = buf.length;

async function main() {
  const relRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/releases/tags/v${version}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' },
  });
  if (!relRes.ok) { console.error('找不到对应 Release（tag=v' + version + '），请先 npm run release'); process.exit(1); }
  const rel = await relRes.json();

  const exeAsset = rel.assets.find(a => a.name.endsWith('.exe'));
  if (!exeAsset) { console.error('Release 中没有 .exe 资源'); process.exit(1); }
  const remoteExe = exeAsset.name;

  const yml =
`version: ${version}
files:
  - url: ${remoteExe}
    sha512: ${sha512}
    size: ${size}
path: ${remoteExe}
sha512: ${sha512}
releaseDate: '${new Date().toISOString()}'
`;
  fs.writeFileSync('latest.yml', yml);

  // 若已存在 latest.yml 资产则先删除，避免重复
  const existing = rel.assets.find(a => a.name === 'latest.yml');
  if (existing) {
    await fetch(existing.url, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
    console.log('已删除旧的 latest.yml');
  }

  const up = await fetch(
    `https://uploads.github.com/repos/${owner}/${repo}/releases/${rel.id}/assets?name=latest.yml`,
    { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/octet-stream' }, body: fs.readFileSync('latest.yml') }
  );
  const j = await up.json();
  if (up.ok) console.log('✓ 已上传 latest.yml ->', j.name, j.size, '字节（指向', remoteExe + '）');
  else { console.error('上传失败:', j.message || up.status); process.exit(1); }
}
main().catch(e => { console.error(e); process.exit(1); });
