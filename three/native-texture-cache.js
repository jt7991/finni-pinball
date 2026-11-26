// Native image-cache bindings belong to the table that produced them.
// The previous revision collided Spotflash with flipperx; the current table
// has distinct keys and uses its original Spotflash image.
const files={
 '3ae17f498f745efa19076ca33e08f96f66d766367fc984e37aacf50774a35e14':'texture-cache.json',
 '6160e43c1a74f6dc70fd9852433c3373fe11b3e55d4f3a3fedc435265591b5c5':'texture-cache-current.json',
 '1e3d738c10398afc89691dcf585ce3c2330ab200dd038daec64ba111faba1997':'texture-cache-cc6f04f.json',
 'a0acae6e039580a027a704238325031d737149595a417c12ad22d11b1275c1f3':'texture-cache-d259c2b.json',
};
export function nativeTextureCacheFile(tableSHA256){
 const file=files[tableSHA256];if(!file)throw Error('No native texture-cache binding for source table '+tableSHA256);return file;
}
