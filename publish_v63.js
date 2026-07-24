// 发布助手：构建完成后生成 latest.yml 并上传到 GitHub Release
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const OWNER = 'liangbai666';
const REPO = 'xiaoke-desktop-pet';
const VERSION = '6.3.0';
const TAG = 'v' + VERSION;
const ROOT = __dirname;
const DIST = path.join(ROOT, 'dist');

function readToken() {
  const p = path.join(ROOT, '.gh_token');
  if (!fs.existsSync(p)) throw new Error('缺少 .gh_token');
  return fs.readFileSync(p, 'utf8').trim();
}

function sha512File(file) {
  const buf = fs.readFileSync(file);
  return crypto.createHash('sha512').update(buf).digest('base64');
}

function findAsset(pattern) {
  const files = fs.readdirSync(DIST);
  const m = files.find(f => pattern.test(f));
  if (!m) throw new Error('在 dist 找不到匹配 ' + pattern + ' 的文件，当前: ' + files.join(', '));
  return path.join(DIST, m);
}

async function gh(method, urlPath, token, body, isBinary) {
  const url = 'https://api.github.com' + urlPath;
  const headers = {
    'Authorization': 'Bearer ' + token,
    'Accept': 'application/vnd.github+json',
    'User-Agent': 'xiaoke-publish',
    'X-GitHub-Api-Version': '2022-11-28',
  };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const res = await fetch(url, {
    method,
    headers,
    body: body !== undefined ? (isBinary ? body : JSON.stringify(body)) : undefined,
  });
  const text = await res.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch (e) {}
  return { status: res.status, json, text };
}

async function ensureRelease(token) {
  const got = await gh('GET', `/repos/${OWNER}/${REPO}/releases/tags/${TAG}`, token);
  if (got.status === 200 && got.json) return got.json;
  const created = await gh('POST', `/repos/${OWNER}/${REPO}/releases`, token, {
    tag_name: TAG,
    name: '小柯桌面萌宠 v' + VERSION,
    body: 'v6.3 更新：\n• 瞳孔缩小融入眼睛（不再是大黑圈）\n• 溜达带弹跳走路动画\n• 顶栏金币/等级/开心度隐藏至设置面板\n• 界面更干净，只显示人物',
    draft: false,
    prerelease: false,
  });
  if (created.status !== 201 && created.status !== 200) {
    throw new Error('创建 Release 失败: ' + created.status + ' ' + created.text);
  }
  return created.json;
}

async function uploadAsset(release, filePath, token, nameOverride) {
  const name = nameOverride || path.basename(filePath);
  if (release.assets) {
    const exist = release.assets.find(a => a.name === name);
    if (exist) {
      await gh('DELETE', `/repos/${OWNER}/${REPO}/releases/assets/${exist.id}`, token);
      console.log('  已删除旧资产', name);
    }
  }
  const buf = fs.readFileSync(filePath);
  const url = `https://uploads.github.com/repos/${OWNER}/${REPO}/releases/${release.id}/assets?name=${encodeURIComponent(name)}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + token,
      'Content-Type': 'application/octet-stream',
      'User-Agent': 'xiaoke-publish',
      'X-GitHub-Api-Version': '2022-11-28',
    },
    body: buf,
  });
  const text = await res.text();
  if (res.status !== 201) throw new Error('上传 ' + name + ' 失败: ' + res.status + ' ' + text);
  console.log('  已上传', name, '(' + (buf.length / 1024 / 1024).toFixed(1) + ' MB)');
}

(async () => {
  const token = readToken();
  const exePath = findAsset(/小柯.*6\.3\.0.*\.exe$/);
  const zipPath = (() => { try { return findAsset(/小柯.*6\.3\.0.*\.zip$/); } catch (e) { return null; } })();

  const sha = sha512File(exePath);
  const size = fs.statSync(exePath).size;
  const exeName = path.basename(exePath);
  const releaseDate = new Date().toISOString();

  const latestYml = [
    'version: ' + VERSION,
    'files:',
    '  - url: ' + exeName,
    '    sha512: ' + sha,
    '    size: ' + size,
    'path: ' + exeName,
    'sha512: ' + sha,
    "releaseDate: '" + releaseDate + "'",
    '',
  ].join('\n');
  fs.writeFileSync(path.join(ROOT, 'latest.yml'), latestYml);
  console.log('已生成 latest.yml');

  console.log('确保 Release', TAG, '存在…');
  const release = await ensureRelease(token);
  console.log('Release id =', release.id);

  console.log('上传资产…');
  await uploadAsset(release, exePath, token);
  await uploadAsset(release, path.join(ROOT, 'latest.yml'), token, 'latest.yml');
  if (zipPath) await uploadAsset(release, zipPath, token);

  console.log('完成！下载地址: https://github.com/' + OWNER + '/' + REPO + '/releases/tag/' + TAG);
})().catch(e => { console.error('发布失败:', e.message); process.exit(1); });
