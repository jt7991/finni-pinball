// Read-only draw/pass observations shared by native and port profile checks.
export function installGraphicsProfileObserver({trace=false}={}){
  const p=WebGL2RenderingContext.prototype,sources=new WeakMap(),attachments=new WeakMap(),programs=new WeakMap();
  const data=window.graphicsProfile={armed:false,frames:[],errors:[],maxFrames:8,textureAllocations:[],...(trace?{programs:[]}: {})};
  const fresh=()=>({draws:0,ballDraws:0,reflectedBalls:0,post:[],...(trace?{techniques:{},details:[]}: {})});let frame=fresh();
  const shaderSource=p.shaderSource;p.shaderSource=function(shader,text){sources.set(shader,{type:this.getShaderParameter(shader,this.SHADER_TYPE),source:text});return shaderSource.call(this,shader,text);};
  const attach=p.attachShader;p.attachShader=function(program,shader){if(!attachments.has(program))attachments.set(program,[]);attachments.get(program).push(sources.get(shader));return attach.call(this,program,shader);};
  for(const name of ['texStorage2D','texImage2D']){const raw=p[name];p[name]=function(...args){if(name==='texStorage2D'||typeof args[3]==='number'&&typeof args[4]==='number')data.textureAllocations.push({width:args[3],height:args[4],format:args[2]});return raw.apply(this,args);};}
  for(const name of ['drawElements','drawArrays','drawElementsInstanced','drawArraysInstanced']){
    const raw=p[name];p[name]=function(...args){
      if(!data.armed)return raw.apply(this,args);
      let tone=false;
      try{
        const program=this.getParameter(this.CURRENT_PROGRAM);let spec=programs.get(program);
        if(!spec){const source=attachments.get(program)?.find(shader=>shader?.type===this.FRAGMENT_SHADER)?.source??'';spec={ball:this.getUniformBlockIndex(program,'ballMatrixBlock'),post:this.getUniformLocation(program,'AO_scale_timeblur')?'ambient_occlusion':source.match(/\/\/[pP][sS]_main_([^\s(]+)\(/)?.[1]};if(trace){spec.id=data.programs.length;const uniforms=[];for(let i=0;i<this.getProgramParameter(program,this.ACTIVE_UNIFORMS);i++)uniforms.push(this.getActiveUniform(program,i).name);data.programs.push({technique:spec.post,sourceTail:source.slice(-1200),uniforms});}programs.set(program,spec);}
        frame.draws++;
        if(trace){const viewport=Array.from(this.getParameter(this.VIEWPORT)),key=(spec.post??(spec.ball!==this.INVALID_INDEX?'ball':'unlabeled'))+'@'+viewport.slice(2).join('x');frame.techniques[key]=(frame.techniques[key]??0)+1;const uniforms={};for(const name of ['lightColor_intensity','lightColor2_falloff_power','lightCenter_maxRange','blend_modulate_vs_add']){const location=this.getUniformLocation(program,name);if(location){const value=this.getUniform(program,location);uniforms[name]=ArrayBuffer.isView(value)?Array.from(value):value;}}frame.details.push({program:spec.id,technique:key,method:name,mode:args[0],count:args[name.startsWith('drawArrays')?2:1],blend:this.isEnabled(this.BLEND),depthWrite:this.getParameter(this.DEPTH_WRITEMASK),cull:this.isEnabled(this.CULL_FACE),uniforms});}
        if(spec.ball!==this.INVALID_INDEX){
          const binding=this.getActiveUniformBlockParameter(program,spec.ball,this.UNIFORM_BLOCK_BINDING),buffer=this.getIndexedParameter(this.UNIFORM_BUFFER_BINDING,binding),previous=this.getParameter(this.UNIFORM_BUFFER_BINDING),values=new Float32Array(16);
          try{this.bindBuffer(this.UNIFORM_BUFFER,buffer);this.getBufferSubData(this.UNIFORM_BUFFER,0,values);}finally{this.bindBuffer(this.UNIFORM_BUFFER,previous);}
          frame.ballDraws++;if(values[10]<0)frame.reflectedBalls++;
        }
        if(spec.post?.startsWith('fb_')||spec.post==='ambient_occlusion')frame.post.push({name:spec.post,viewport:Array.from(this.getParameter(this.VIEWPORT))});
        tone=!!spec.post?.includes('tonemap');
      }catch(error){data.errors.push(error.message);}
      const result=raw.apply(this,args);
      if(tone){data.frames.push(frame);frame=fresh();if(data.frames.length>=data.maxFrames)data.armed=false;}
      return result;
    };
  }
}
