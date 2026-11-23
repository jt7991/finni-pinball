// Read-only draw/pass observations shared by native and port profile checks.
export function installGraphicsProfileObserver(){
  const p=WebGL2RenderingContext.prototype,sources=new WeakMap(),attachments=new WeakMap(),programs=new WeakMap();
  const data=window.graphicsProfile={armed:false,frames:[],errors:[],maxFrames:8,textureAllocations:[]};
  const fresh=()=>({draws:0,ballDraws:0,reflectedBalls:0,post:[]});let frame=fresh();
  const shaderSource=p.shaderSource;p.shaderSource=function(shader,text){sources.set(shader,{type:this.getShaderParameter(shader,this.SHADER_TYPE),source:text});return shaderSource.call(this,shader,text);};
  const attach=p.attachShader;p.attachShader=function(program,shader){if(!attachments.has(program))attachments.set(program,[]);attachments.get(program).push(sources.get(shader));return attach.call(this,program,shader);};
  for(const name of ['texStorage2D','texImage2D']){const raw=p[name];p[name]=function(...args){if(name==='texStorage2D'||typeof args[3]==='number'&&typeof args[4]==='number')data.textureAllocations.push({width:args[3],height:args[4],format:args[2]});return raw.apply(this,args);};}
  for(const name of ['drawElements','drawArrays','drawElementsInstanced','drawArraysInstanced']){
    const raw=p[name];p[name]=function(...args){
      if(!data.armed)return raw.apply(this,args);
      let tone=false;
      try{
        const program=this.getParameter(this.CURRENT_PROGRAM);let spec=programs.get(program);
        if(!spec){const source=attachments.get(program)?.find(shader=>shader?.type===this.FRAGMENT_SHADER)?.source??'';spec={ball:this.getUniformBlockIndex(program,'ballMatrixBlock'),post:this.getUniformLocation(program,'AO_scale_timeblur')?'ambient_occlusion':source.match(/\/\/ps_main_([^\s(]+)\(/)?.[1]};programs.set(program,spec);}
        frame.draws++;
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
