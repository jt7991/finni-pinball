// Share the original encoded atlas while keeping the display's Image decoder
// and the native flasher's explicit ImageBitmap decode settings independent.
const sources=new Map();

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

export async function loadDmdAtlasImage(url){
  const blob=await loadDmdAtlasBlob(url),image=new Image(),source=URL.createObjectURL(blob);
  return new Promise((resolve,reject)=>{
    image.onload=()=>{URL.revokeObjectURL(source);resolve(image);};
    image.onerror=()=>{URL.revokeObjectURL(source);reject(Error('DMD sprite atlas could not be decoded'));};
    try{image.src=source;}catch(error){URL.revokeObjectURL(source);reject(error);}
  });
}
