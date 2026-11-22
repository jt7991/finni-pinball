// SPDX-License-Identifier: GPL-3.0-or-later
// Native flipper meshes and BasicShader textured material, Visual Pinball
// 195f214dd4849b8ef6113fd377258b78d0dec3bf; see VPX-Physics-NOTICE.txt.
import * as THREE from 'three';
import {nativeFlipperMesh} from './flipper-mesh.js';
import {nativeMaterialGLSL,nativeMaterialUniforms,nativeViewMatrix} from './classic-render.js';
import {nativeFlipperWorld} from './flipper-transform.js';
import {nativeModelMatrices} from './primitive-transform.js';
import {NativeMatrixStream} from './native-basic-render.js';
const f=Math.fround,DEGREES=f(Math.PI/180);
const vertex=`attribute vec3 nativePosition;attribute vec3 nativeNormal;uniform mat4 nativeWorldView;uniform mat3 nativeNormalView;uniform mat4 nativeWorldViewProj;uniform bool nativeProjectionEnabled;uniform int nativeLayer;varying vec2 tex01;varying vec3 worldPos;varying vec3 surfaceNormal;flat varying float nativeEye;
layout(std140) uniform nativeBasicMatrixBlock{mat4 nativeModel;mat4 nativeCameraView[1];mat4 nativeModelView[1];mat3x4 nativeNormalMatrix[1];vec4 nativeNormalFiller[1];mat4 nativeModelViewProj[1];};
void main(){tex01=uv;int eye=gl_InstanceID+nativeLayer;nativeEye=float(eye);if(nativeProjectionEnabled){vec4 pos=vec4(nativePosition,1.);worldPos=(nativeModelView[eye]*pos).xyz;surfaceNormal=normalize((nativeNormalMatrix[eye]*nativeNormal).xyz);gl_Position=nativeModelViewProj[eye]*pos;}else{worldPos=(nativeWorldView*vec4(nativePosition,1.)).xyz;surfaceNormal=normalize(nativeNormalView*nativeNormal);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}}`;
// The authored flippers are opaque, with no normal map, refraction, reflection
// probe, ball-shadow light or transmission. Keep that native BasicShader path.
const fragment=nativeMaterialGLSL+`uniform sampler2D tex_base_color;uniform vec4 staticColor_Alpha;varying vec2 tex01;varying vec3 worldPos;varying vec3 surfaceNormal;flat varying float nativeEye;
void main(){vec4 pixel=texture(tex_base_color,tex01);pixel.a*=cBase_Alpha.a;if(fDisableLighting_top_below.x<1.)pixel.xyz=clamp(pixel.xyz,0.,1.);vec3 diffuse=pixel.xyz*cBase_Alpha.xyz;vec3 glossy=is_metal?diffuse:(pixel.xyz*cGlossy_ImageLerp.w+(1.-cGlossy_ImageLerp.w))*cGlossy_ImageLerp.xyz*.08;vec3 specular=cClearcoat_EdgeAlpha.xyz*.08;float edge=is_metal?1.:Roughness_WrapL_Edge_Thickness.z;vec3 V=normalize(-worldPos),N=normalize(surfaceNormal);vec4 color=vec4(lightLoop(worldPos,N,V,diffuse,glossy,specular,edge,is_metal,nativeEye),pixel.a);if(color.a<1.)color.a=GeometricOpacity(dot(N,V),color.a,cClearcoat_EdgeAlpha.w,Roughness_WrapL_Edge_Thickness.w);gl_FragColor=color*staticColor_Alpha;}`;

export async function loadFlipperVisuals(base,anisotropy){
  const metadata=await(await fetch(base+'flipper-tops.json')).json(),buffer=await(await fetch(base+metadata.file)).arrayBuffer(),images=[...new Set(['flipperx',...metadata.parts.map(p=>p.spec.image)])],textures={};
  await Promise.all(images.map(async name=>{const sampler=metadata.samplers[name],texture=await new THREE.TextureLoader().loadAsync(base+name+'.webp');texture.flipY=false;texture.colorSpace=THREE.SRGBColorSpace;texture.wrapS=sampler[10242]===10497?THREE.RepeatWrapping:THREE.ClampToEdgeWrapping;texture.wrapT=sampler[10243]===10497?THREE.RepeatWrapping:THREE.ClampToEdgeWrapping;texture.anisotropy=Math.min(anisotropy,sampler[34046]??1);textures[name]=texture;}));
  return{metadata,buffer,textures};
}
export function createFlipperMaterial(spec,lighting,view,texture,program,stream){
  // Retain native UBO packing and dynamic eye indexing: ordinary matrix uniforms
  // changed vertex arithmetic in ANGLE, despite identical uploaded float bits.
  const group=new THREE.UniformsGroup().setName(program?'basicMatrixBlock':'nativeBasicMatrixBlock').setUsage(THREE.DynamicDrawUsage);for(let i=0;i<5;i++)group.add(new THREE.Uniform(new THREE.Matrix4()));
  const Material=program?THREE.RawShaderMaterial:THREE.ShaderMaterial,material=new Material({...(program?{glslVersion:THREE.GLSL3}:{}),uniformsGroups:[group],uniforms:{...nativeMaterialUniforms(spec,lighting,view),nativeWorldView:{value:new THREE.Matrix4()},nativeNormalView:{value:new THREE.Matrix3()},nativeWorldViewProj:{value:new THREE.Matrix4()},nativeLayer:{value:0},nativeProjectionEnabled:{value:false},tex_base_color:{value:texture},staticColor_Alpha:{value:new THREE.Vector4(1,1,1,1)}},vertexShader:program?.vertex??vertex,fragmentShader:program?.fragment??fragment,side:THREE.BackSide});material.userData.nativeMatrices=group;
  if(program){const black=new THREE.DataTexture(new Uint8Array(4),1,1,THREE.RGBAFormat);black.needsUpdate=true;Object.assign(material.uniforms,{layer:{value:0},doNormalMapping:{value:false},objectSpaceNormalMap:{value:false},doRefractions:{value:false},matProj:{value:new Float32Array(16)},w_h_height:{value:new Float32Array(4)},mirrorNormal_factor:{value:new THREE.Vector4()},lightCenter_doShadow:{value:new THREE.Vector4()},balls:{value:new Float32Array(32)}});for(const name of ['tex_base_transmission','tex_reflection','tex_base_normalmap','tex_refraction','tex_probe_depth'])material.uniforms[name]={value:black};material.addEventListener('dispose',()=>black.dispose());}
  if(stream)material.uniformsGroups=[];const packet=new Float32Array(80);
  material.onBeforeRender=(_renderer,_scene,camera)=>{material.uniforms.nativeProjectionEnabled.value=!!camera.userData.nativeCamera;if(stream){for(let i=0;i<5;i++)packet.set(group.uniforms[i].value.elements,i*16);stream.upload(material,packet);}};material.addEventListener('dispose',()=>group.dispose());return material;
}
function geometry(values,indices,offset=0,count=values.length/8,topSize){
  const positions=[],normals=[],uv=[],native=[],nativeNormals=[];
  for(let i=offset;i<offset+count*8;i+=8){const x=values[i],y=values[i+1],z=values[i+2];native.push(x,y,z);nativeNormals.push(values[i+3],values[i+4],values[i+5]);
    positions.push(-y*(topSize?.y??1)*.01,-x*(topSize?.x??1)*.01,z*(topSize?.z??1)*.01);normals.push(-values[i+4],-values[i+3],values[i+5]);uv.push(values[i+6],values[i+7]);}
  // Retain original triangle indices and the source FRONT cull state.
  const result=new THREE.BufferGeometry();result.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));result.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));result.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));const p=new THREE.Float32BufferAttribute(native,3),n=new THREE.Float32BufferAttribute(nativeNormals,3);result.setAttribute('nativePosition',p);result.setAttribute('vPosition',p);result.setAttribute('nativeNormal',n);result.setAttribute('vNormal',n);result.setAttribute('tc',result.getAttribute('uv'));result.setIndex(Array.from(indices));return result;
}
export function createFlipperVisuals(game,scene,lighting,assets,{program,renderer}={}){
  const view=new THREE.Matrix4(),materials=new Map(lighting.metadata.materials.map(m=>[m.name,m])),parts=[],flippers=[],stream=program?new NativeMatrixStream(renderer):null;
  const make=(name,shape,material,image,spec,state,flipper,top=false)=>{
    const legacyMaterial=createFlipperMaterial(materials.get(material),lighting,view,assets.textures[image]),mesh=new THREE.Mesh(shape,program?createFlipperMaterial(materials.get(material),lighting,view,assets.textures[image],program,stream):legacyMaterial);mesh.name=name;scene.add(mesh);parts.push({mesh,spec,state,flipper,top,legacyMaterial});return mesh;
  };
  for(const flipper of game.flippers){
    const spec=flipper.spec;if(!spec)throw Error('Authored flipper visual settings are missing');const generated=nativeFlipperMesh(spec,(spec.surface_height??0)*100),state=game.rules.objects.get(spec.name.toLowerCase());
    const base=make(spec.name+':Base',geometry(generated.vertices,generated.indices,0,104),spec.material,spec.image,spec,state,flipper),rubber=spec.rubber_thickness>0?make(spec.name+':Rubber',geometry(generated.vertices,generated.indices,832,104),spec.rubber_material,spec.image,spec,state,flipper):null;
    const topPart=assets.metadata.parts.find(p=>p.spec.name===spec.name+'Top');let top;
    if(topPart){const p=topPart.spec;top=make(p.name,geometry(new Float32Array(assets.buffer,topPart.vertexByteOffset,topPart.vertices*8),new Uint16Array(assets.buffer,topPart.indexByteOffset,topPart.indices),0,topPart.vertices,p.size),p.material,p.image,p,game.rules.objects.get(p.name.toLowerCase()),flipper,true);}
    flippers.push({spec,base,rubber,top});
  }
  const world=new THREE.Matrix4(),normal=new THREE.Matrix4(),worldData=new Float32Array(16);
  return{view,parts,flippers,update(camera){nativeViewMatrix(view,camera);const size=renderer?.getDrawingBufferSize(new THREE.Vector2());
    for(const part of parts){const {mesh,spec,state,flipper,top}=part,angle=top?f(f(state.rotz)*DEGREES):f(Math.PI/2-flipper.angle),position=top?spec.position:spec.center,reflection=!!camera.userData.nativeCamera?.reflection;
      const order=top?assets.metadata.parts.find(part=>part.spec.name===spec.name)?.[reflection?'reflectionDrawOrder':'drawOrder']:assets.metadata.bodyDrawOrders?.[spec.name]?.[reflection?'reflection':'main']?.[mesh.name.endsWith(':Rubber')?1:0];
      mesh.visible=!!state.visible&&(!camera.userData.nativeCamera?.reflection||spec.is_reflection_enabled!==false);mesh.position.set(position.x*.01,(2115-position.y)*.01,top?position.z*.01:0);mesh.rotation.z=Math.PI/2-angle;
      if(mesh.visible&&!Number.isInteger(order))throw Error('Native flipper draw order unavailable: '+mesh.name);mesh.renderOrder=order??0;
      world.fromArray(nativeFlipperWorld(spec,angle,top,worldData));
      const uniforms=mesh.material.uniforms;
      if(camera.userData.nativeCamera){const matrices=nativeModelMatrices(worldData,camera.userData.nativeCamera);uniforms.nativeWorldView.value.fromArray(matrices,32);normal.fromArray(matrices,48);uniforms.nativeNormalView.value.setFromMatrix4(normal);uniforms.nativeWorldViewProj.value.fromArray(matrices,64);for(let i=0;i<5;i++)mesh.material.userData.nativeMatrices.uniforms[i].value.fromArray(matrices,i*16);if(uniforms.matProj)uniforms.matProj.value.set(camera.userData.nativeCamera.projection);if(uniforms.w_h_height&&size)uniforms.w_h_height.value.set([1/size.x,1/size.y,0,0]);}
      else{uniforms.nativeWorldView.value.multiplyMatrices(view,world);uniforms.nativeNormalView.value.getNormalMatrix(uniforms.nativeWorldView.value);}
    }
  }};
}
