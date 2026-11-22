// Scoped compatibility/performance patches for the pinned MIT-licensed engine.
// String interning returns identical immutable lowercase strings regardless of
// cache eviction order. FIFO retains its 2000-entry bound without two Map writes
// on every cache hit in the table's 1000Hz timer callbacks.
import fs from 'node:fs';
const root=new URL('../',import.meta.url),directory=new URL('node_modules/@devscholar/vbs-engine-js/',root);
const metadata=JSON.parse(fs.readFileSync(new URL('package.json',directory),'utf8'));
if(metadata.version!=='1.4.0')throw Error('Review the identifier-cache patch before changing vbs-engine-js 1.4.0');
const path=new URL('dist/vbs-engine.js',directory),original=fs.readFileSync(path,'utf8'),marker='/* finni: bounded FIFO identifier cache */';let source=original;
if(!source.includes(marker)){
  const old='(this.pool.delete(t), this.pool.set(t, n), n)',replacement=`(${marker} n)`;
  if(source.split(old).length!==2)throw Error('Upstream identifier cache changed; refusing an unreviewed patch');
  source=source.replace(old,replacement);
}
// The upstream parser also accepts VBA-style GoTo labels. It classifies any
// bare identifier followed by ':' as a label, silently dropping VBScript's
// no-argument calls (including the authored aTriggers_Hit -> PlaySfx call).
// This player executes VBScript; On Error GoTo0 has its own unchanged parser.
const colonMarker='/* finni: VBScript colon call */';
if(!source.includes(colonMarker)){
  const old='default: return this.state.checkIdentifier() && this.state.peek(1).type === "Colon" ? this.parseLabelStatement() : this.statementsParser.parseExpressionStatement();',replacement=`default: return ${colonMarker} this.statementsParser.parseExpressionStatement();`;
  if(source.split(old).length!==2)throw Error('Upstream colon/label parser changed; refusing an unreviewed patch');
  source=source.replace(old,replacement);
}
if(source!==original)fs.writeFileSync(path,source);
