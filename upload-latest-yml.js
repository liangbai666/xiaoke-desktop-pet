// 发版后：把草稿 Release 发布为非草稿，并自动生成/上传 latest.yml（electron-updater 自动更新必需）。
// 运行前需设置环境变量 GH_TOKEN。
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

const api = (url, opts = {}) => fetch(url, {
  ...opts,
  headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', ...(opts.headers || {}) },
});

async function main() {
  // 用 releases 列表按 tag_name 查找（比 releases/tags/<tag> 更稳，避免缺少 tag ref 时报错）
  const listRes = await api(`https://api.github.com/repos/${owner}/${repo}/releases?per_page=100`);
  const list = await listRes.json();
  const rel = list.find(r => r.tag_name === `v${version}`);
  if (!rel) { console.error(`找不到 tag=v${version} 的 Release，请先运行 npm run release`); process.exit(1); }

  // 若是草稿，先发布（GitHub 不允许草稿被 electron-updater 看到）
  if (rel.draft) {
    const p = await api(`https://api.github.com/repos/${owner}/${repo}/releases/${rel.id}`, {
      method: 'PATCH', body: JSON.stringify({ draft: false, make_latest: 'true' }),
      headers: { 'Content-Type': 'application/json' },
    });
    if (!p.ok) { console.error('发布草稿失败:', await p.text()); process.exit(1); }
    console.log('✓ 草稿已发布为非草稿（可供自动更新）');
  }

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
    await api(existing.url, { method: 'DELETE' });
    console.log('已删除旧的 latest.yml');
  }

  const up = await api(
    `https://uploads.github.com/repos/${owner}/${repo}/releases/${rel.id}/assets?name=latest.yml`,
    { method: 'POST', headers: { 'Content-Type': 'application/octet-stream' }, body: fs.readFileSync('latest.yml') }
  );
  const j = await up.json();
  if (up.ok) console.log('✓ 已上传 latest.yml ->', j.name, j.size, '字节（指向', remoteExe + '）');
  else { console.error('上传失败:', j.message || up.status); process.exit(1); }
}
main().catch(e => { console.error(e); process.exit(1); });
