// Scoped compatibility/performance patches for the pinned MIT-licensed engine.
// String interning returns identical immutable lowercase strings regardless of
// cache eviction order. FIFO retains its 2000-entry bound without two Map writes
// on every cache hit in the table's 1000Hz timer callbacks.
import fs from 'node:fs';
const root=new URL('../',import.meta.url),directory=new URL('node_modules/@devscholar/vbs-engine-js/',root);
const metadata=JSON.parse(fs.readFileSync(new URL('package.json',directory),'utf8'));
if(metadata.version!=='1.4.0')throw Error('Review the compatibility patches before changing vbs-engine-js 1.4.0');
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
// Abs preserves the numeric subtype rather than narrowing a small Long to
// Integer. The compiled native host also preserves Date, converts numeric
// strings to Double, and reports overflow at the signed integer minima.
// Keep the upstream Null, Currency, Single and other coercion paths intact.
const absMarker='/* finni: native Abs subtype and overflow */';
if(!source.includes(absMarker)){
  const old='return yi(e, Math.abs(t));',replacement=`${absMarker}
        if ((e.type === "Integer" && t === -32768) || (e.type === "Long" && t === -2147483648)) throw b(y.Overflow, "Overflow: Abs");
        if (e.type === "Long") return {type:"Long", value:Math.abs(t)};
        if (e.type === "Date") return {type:"Date", value:E(Math.abs(t))};
        if (e.type === "String") return {type:"Double", value:Math.abs(t)};
        return yi(e, Math.abs(t));`;
  if(source.split(old).length!==2||!source.includes('function E(e) {'))throw Error('Upstream Abs or date conversion changed; refusing an unreviewed patch');
  source=source.replace(old,replacement);
}
// HitTarget exposes a deliberate, noncanonical VT_BOOL +1. Normal JS Boolean
// truth is retained, while its native signed payload survives numeric/bitwise
// operations, aliases and CBool. Ordinary True/False values are unchanged.
const booleanMarker='/* finni: native Boolean payload */';
if(!source.includes(booleanMarker)){
  const changes=[
    ['if (e.type === "Boolean") return e.value ? -1 : 0;',`if (e.type === "Boolean") return ${booleanMarker} e.nativeBoolean ?? (e.value ? -1 : 0);`],
    ['kind: "Boolean",\n\t\t\tvalue: e.value ? -1 : 0','kind: "Boolean",\n\t\t\tvalue: e.nativeBoolean ?? (e.value ? -1 : 0)'],
    ['type: "Boolean",\n\t\t\tvalue: t !== 0','type: "Boolean",\n\t\t\tvalue: t !== 0,\n\t\t\t...(t !== 0 && t !== -1 ? {nativeBoolean:t} : {})'],
    ['CBool: (e) => ({\n\t\ttype: "Boolean",\n\t\tvalue: Hn(e)\n\t}),','CBool: (e) => e.type === "Boolean" ? e : ({\n\t\ttype: "Boolean",\n\t\tvalue: Hn(e)\n\t}),'],
    ['e.type === "Boolean" ? e.value ? BigInt(-1) : BigInt(0)','e.type === "Boolean" ? BigInt(L(e))'],
  ];
  for(const[old,replacement]of changes){if(source.split(old).length!==2)throw Error('Upstream Boolean conversion changed; refusing an unreviewed patch');source=source.replace(old,replacement);}
}
if(source!==original)fs.writeFileSync(path,source);
