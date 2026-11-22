// SPDX-License-Identifier: GPL-3.0-or-later
// Native GL sampler objects keep immutable image storage separate from draw
// filtering/wrapping, as VPX does. Three otherwise uploads another image for
// each texture-parameter combination, including the 2048x4550 playfield.
const registries=new WeakMap();
export function nativeSamplersFor(renderer){
 if(registries.has(renderer))return registries.get(renderer);
 const gl=renderer.getContext(),samplers=new Map(),registered=new Map(),units=new WeakMap(),stats={draws:0,bindings:0};let active=null;
 const anisotropy=gl.getExtension('EXT_texture_filter_anisotropic'),maxAnisotropy=anisotropy?gl.getParameter(anisotropy.MAX_TEXTURE_MAX_ANISOTROPY_EXT):1;
 const samplerFor=parameters=>{const key=JSON.stringify(parameters);if(samplers.has(key))return samplers.get(key);const sampler=gl.createSampler();for(const name of [gl.TEXTURE_MAG_FILTER,gl.TEXTURE_MIN_FILTER,gl.TEXTURE_WRAP_S,gl.TEXTURE_WRAP_T])gl.samplerParameteri(sampler,name,parameters[name]);if(anisotropy)gl.samplerParameterf(sampler,anisotropy.TEXTURE_MAX_ANISOTROPY_EXT,Math.min(parameters[34046]??1,maxAnisotropy));samplers.set(key,sampler);return sampler;};
 const originals=new Map(),wrappers=new Map();
 for(const name of ['drawElements','drawArrays','drawElementsInstanced','drawArraysInstanced']){const original=gl[name];originals.set(name,original);const wrapped=function(...args){const material=active;active=null;if(!material)return original.apply(this,args);const bindings=registered.get(material),program=renderer.properties.get(material).currentProgram.program;let locations=units.get(program);if(!locations){locations=new Map();units.set(program,locations);}const bound=[];try{for(const [name,sampler]of bindings){let unit=locations.get(name);if(unit===undefined){const location=gl.getUniformLocation(program,name);unit=location?gl.getUniform(program,location):-1;locations.set(name,unit);}if(unit<0)continue;gl.bindSampler(unit,sampler);bound.push(unit);stats.bindings++;}stats.draws++;return original.apply(this,args);}finally{for(const unit of bound)gl.bindSampler(unit,null);}};wrappers.set(name,wrapped);gl[name]=wrapped;}
 const registry={samplers,stats,register(material,bindings){if(registered.has(material))throw Error('Native material sampler registration repeated');const values=Object.entries(bindings).map(([name,parameters])=>[name,samplerFor(parameters)]),before=material.onBeforeRender;registered.set(material,values);material.onBeforeRender=function(...args){before.apply(this,args);active=material;};return()=>{registered.delete(material);material.onBeforeRender=before;if(active===material)active=null;};},dispose(){if(registered.size)throw Error('Dispose native materials before their sampler registry');for(const [name,wrapper]of wrappers)if(gl[name]===wrapper)gl[name]=originals.get(name);for(const sampler of samplers.values())gl.deleteSampler(sampler);registries.delete(renderer);}};
 registries.set(renderer,registry);return registry;
}
