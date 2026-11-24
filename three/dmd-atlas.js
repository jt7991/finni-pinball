// Share the lossless delivery atlas. The Canvas display uses browser-default
// bitmap decoding; native flashers retain their explicit raw decode settings.
const sources=new Map();
export const DMD_ATLAS_FILE='dmd-atlas.webp';

export function loadDmdAtlasBlob(url){
  const key=new URL(url,globalThis.document?.baseURI??import.meta.url).href;
  let source=sources.get(key);
  if(!source){
    source=fetch(key).then(response=>{
      if(!response.ok)throw Error('DMD sprite atlas unavailable');
      return response.blob();
    });
    sources.set(key,source);
    source.catch(()=>{if(sources.get(key)===source)sources.delete(key);});
  }
  return source;
}

export async function loadDmdAtlasDisplayBitmap(url){
  // Decode before the first draw instead of making Canvas decode the entire
  // atlas synchronously while it submits a game frame.
  return createImageBitmap(await loadDmdAtlasBlob(url));
}
