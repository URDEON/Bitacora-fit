import { readdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
async function walk(dir) {
  const files = await readdir(dir, { withFileTypes: true });
  return (
    await Promise.all(
      files.map((f) =>
        f.isDirectory() ? walk(`${dir}/${f.name}`) : `${dir}/${f.name}`,
      ),
    )
  ).flat();
}
// Media-scanner markers belong to distributed folders, not the web precache.
// Some hosts reject dotfiles, which must not prevent offline installation.
const files = (await walk("dist")).filter(
  (p) => !p.endsWith("/sw.js") && !p.endsWith("/.nomedia"),
);
const hash = createHash("sha256");
for (const p of files) hash.update(await readFile(p));
const cache = `bitacora-fit-${hash.digest("hex").slice(0, 16)}`;
const urls = files.map((p) => "./" + p.slice(5));
await writeFile(
  "dist/sw.js",
  `const CACHE=${JSON.stringify(cache)};const FILES=${JSON.stringify(urls)};self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(FILES)).then(()=>self.skipWaiting())));self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('bitacora-fit-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));self.addEventListener('fetch',e=>{if(e.request.method!=='GET'||new URL(e.request.url).origin!==self.location.origin)return;e.respondWith(caches.match(e.request,{ignoreVary:true}).then(hit=>hit||fetch(e.request).catch(err=>{if(e.request.mode==='navigate')return caches.match('./index.html');throw err})));});`,
);
console.log(`Sin conexión: ${urls.length} recursos locales preparados.`);
