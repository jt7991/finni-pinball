// Keep the upstream MIT-licensed engine intact except for its identifier cache.
// String interning returns identical immutable lowercase strings regardless of
// cache eviction order. FIFO retains its 2000-entry bound without two Map writes
// on every cache hit in the table's 1000Hz timer callbacks.
import fs from 'node:fs';
const root=new URL('../',import.meta.url),directory=new URL('node_modules/@devscholar/vbs-engine-js/',root);
const metadata=JSON.parse(fs.readFileSync(new URL('package.json',directory),'utf8'));
if(metadata.version!=='1.4.0')throw Error('Review the identifier-cache patch before changing vbs-engine-js 1.4.0');
const path=new URL('dist/vbs-engine.js',directory),source=fs.readFileSync(path,'utf8'),marker='/* finni: bounded FIFO identifier cache */';
if(!source.includes(marker)){
  const old='(this.pool.delete(t), this.pool.set(t, n), n)',replacement=`(${marker} n)`;
  if(source.split(old).length!==2)throw Error('Upstream identifier cache changed; refusing an unreviewed patch');
  fs.writeFileSync(path,source.replace(old,replacement));
}
