// 发布前准备：用 GitHub Token 自动获取用户名、改好 package.json、建好公开仓库。
// 之后由 npm run release（electron-builder）把新版本上传到 GitHub Releases。
const https = require('https');
const fs = require('fs');

const token = process.env.GH_TOKEN;
if (!token) {
  console.error('未检测到 GH_TOKEN，请先设置后再运行。');
  process.exit(1);
}

function api(path, method = 'GET', body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const headers = {
      Authorization: 'token ' + token,
      'User-Agent': 'xiaoke-release',
      'Content-Type': 'application/json',
    };
    if (data) headers['Content-Length'] = Buffer.byteLength(data);
    const req = https.request(
      { hostname: 'api.github.com', path, method, headers },
      (r) => {
        let s = '';
        r.on('data', (d) => (s += d));
        r.on('end', () => {
          try { resolve({ status: r.statusCode, body: JSON.parse(s || '{}') }); }
          catch (e) { resolve({ status: r.statusCode, body: {} }); }
        });
      }
    );
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

(async () => {
  const me = await api('/user');
  const login = me.body.login;
  if (!login) {
    console.error('获取 GitHub 用户名失败，请确认 Token 有效且拥有 repo 权限。');
    process.exit(1);
  }
  console.log('✅ GitHub 用户名:', login);

  const p = 'package.json';
  const j = JSON.parse(fs.readFileSync(p, 'utf8'));
  if (j.build && j.build.publish) j.build.publish.owner = login;
  fs.writeFileSync(p, JSON.stringify(j, null, 2));
  console.log('✅ 已将 package.json 的发布者改为', login);

  const repo = j.build.publish.repo;
  const exist = await api(`/repos/${login}/${repo}`);
  if (exist.status === 404) {
    const c = await api('/user/repos', 'POST', { name: repo, private: false });
    console.log(c.status === 201 ? '✅ 已创建公开仓库 ' + repo : '⚠️ 仓库创建返回状态 ' + c.status);
  } else {
    console.log('✅ 仓库已存在，跳过创建');
  }
  console.log('准备完成，开始发布新版本…');
})().catch((e) => {
  console.error('准备失败:', e && e.message ? e.message : e);
  process.exit(1);
});
