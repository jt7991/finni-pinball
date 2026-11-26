// SPDX-License-Identifier: GPL-3.0-or-later
// Read-through storage for bodies moved exclusively by the native integrator.
// Cache backend results, not requested writes: Rapier can reject a write or
// retain a different signed zero. Raw body callers still use the original API.
const POSITION=1,VELOCITY=2,ANGULAR=4,ALL=7;
const mutations={
  setTranslation:POSITION,setLinvel:VELOCITY,setAngvel:ANGULAR,
  applyImpulse:VELOCITY,applyTorqueImpulse:ANGULAR,applyImpulseAtPoint:VELOCITY|ANGULAR,
  setRotation:ALL,setBodyType:ALL,sleep:ALL,setEnabled:ALL,
  setNextKinematicTranslation:ALL,setNextKinematicRotation:ALL,
  lockTranslations:ALL,lockRotations:ALL,setEnabledTranslations:ALL,
  restrictTranslations:ALL,setEnabledRotations:ALL,restrictRotations:ALL,
  recomputeMassPropertiesFromColliders:ALL,setAdditionalMass:ALL,setAdditionalMassProperties:ALL,
};

export class NativeBodyStorage {
  constructor(body,onRelease=()=>{}){
    this.body=body;this.onRelease=onRelease;this.active=true;this.valid=0;this.values=[];this.wrappers=[];
    for(const [name,mask]of Object.entries(mutations)){
      const original=body[name];if(typeof original!=='function')continue;
      const descriptor=Object.getOwnPropertyDescriptor(body,name),storage=this;
      const wrapper=function(...args){
        if(storage.active)storage.valid&=~mask;
        return original.apply(this,args);
      };
      Object.defineProperty(body,name,{configurable:true,writable:true,enumerable:descriptor?.enumerable??true,value:wrapper});
      this.wrappers.push({name,descriptor,wrapper});
    }
  }
  read(name,index,mask){
    if(!this.active)return this.body[name]();
    if(!(this.valid&mask)){
      this.values[index]=this.body[name]();this.valid|=mask;
    }
    // Internal borrowed vectors. NativeBall returns independent public vectors
    // and must not modify these backend observations.
    return this.values[index];
  }
  translation(){return this.read('translation',0,POSITION);}
  linvel(){return this.read('linvel',1,VELOCITY);}
  angvel(){return this.read('angvel',2,ANGULAR);}
  release(){
    if(!this.active)return;
    this.active=false;this.valid=0;this.values=[];
    for(const {name,descriptor,wrapper}of this.wrappers){
      if(this.body[name]!==wrapper)continue;
      if(descriptor)Object.defineProperty(this.body,name,descriptor);else delete this.body[name];
    }
    this.wrappers=[];this.onRelease(this);
  }
}
