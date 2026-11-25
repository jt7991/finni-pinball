// Transport-only repack of the committed, independently observed native mesh.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {gzipSync} from 'node:zlib';
import {decodeNativeGeometry,encodeNativeGeometry,NATIVE_GEOMETRY_DICTIONARY} from '../three/native-geometry-codec.js';
const directory=path.resolve(process.argv[2]??'three/public/native-table'),file=path.join(directory,'native-table.json');
const metadata=JSON.parse(fs.readFileSync(file)),geometry=metadata.geometry,sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const original=fs.readFileSync(path.join(directory,geometry.file));assert.equal(sha(original),geometry.encodedSHA256);
const raw=Buffer.from(decodeNativeGeometry(original,metadata.parts,geometry.encoding));assert.equal(sha(raw),geometry.sha256);assert.equal(raw.length,geometry.bytes);
const packed=encodeNativeGeometry(raw,metadata.parts,NATIVE_GEOMETRY_DICTIONARY);assert.ok(Buffer.from(decodeNativeGeometry(packed,metadata.parts,NATIVE_GEOMETRY_DICTIONARY)).equals(raw));
const legacy=encodeNativeGeometry(raw,metadata.parts),summary={rawSHA256:sha(raw),legacySHA256:sha(legacy),encodedSHA256:sha(packed),rawBytes:raw.length,legacyBytes:legacy.length,packedBytes:packed.length,legacyGzipBytes:gzipSync(legacy).length,packedGzipBytes:gzipSync(packed).length};
Object.assign(geometry,{encoding:NATIVE_GEOMETRY_DICTIONARY,encodedSHA256:summary.encodedSHA256});
fs.writeFileSync(path.join(directory,geometry.file),packed);fs.writeFileSync(file,JSON.stringify(metadata));console.log(JSON.stringify(summary));
