// Historical comparisons retain the actual source art and material bindings.
// These three revisions shared their render inputs; their texture-cache
// identities remain selected independently by native-texture-cache.js.
const previous=new Set([
  '3ae17f498f745efa19076ca33e08f96f66d766367fc984e37aacf50774a35e14',
  '6160e43c1a74f6dc70fd9852433c3373fe11b3e55d4f3a3fedc435265591b5c5',
  '1e3d738c10398afc89691dcf585ce3c2330ab200dd038daec64ba111faba1997',
]);
export function nativeRenderFiles(source){
  return previous.has(source)
    ?{table:'native-table-cc6f04f.json',flashers:'native-flashers-cc6f04f.json',atlas:'dmd-atlas-cc6f04f.webp'}
    :{table:'native-table.json',flashers:'native-flashers.json',atlas:'dmd-atlas.webp'};
}
