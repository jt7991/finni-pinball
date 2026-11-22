import * as THREE from 'three';
import {computeNativeCamera} from './native-camera.js';
import {nativeReflectionCamera} from './native-reflection.js';
const worldToTable=new THREE.Matrix4().makeScale(100,-100,100).setPosition(0,2115,0),viewUnits=new THREE.Matrix4().makeScale(.01,.01,.01);
const tableToThree=new THREE.Matrix4().makeTranslation(0,21.15,0).multiply(new THREE.Matrix4().makeScale(.01,-.01,.01)),nativeUnits=new THREE.Matrix4().makeScale(100,100,100);
export function nativeViewMatrix(view,camera){return camera.userData.nativeCamera?view.fromArray(camera.userData.nativeCamera.view):view.copy(nativeUnits).multiply(camera.matrixWorldInverse).multiply(tableToThree);}
export function setNativeCamera(camera,native){
 camera.matrixAutoUpdate=false;camera.matrixWorldAutoUpdate=false;
 camera.matrixWorldInverse.copy(viewUnits).multiply(new THREE.Matrix4().fromArray(native.view)).multiply(worldToTable);
 camera.matrixWorld.copy(camera.matrixWorldInverse).invert();camera.matrix.copy(camera.matrixWorld);camera.position.setFromMatrixPosition(camera.matrixWorld);
 camera.projectionMatrix.fromArray(native.projection);for(let i=12;i<16;i++)camera.projectionMatrix.elements[i]*=.01;
 camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();camera.near=native.near*.01;camera.far=native.far*.01;camera.aspect=native.aspect;
 camera.userData.nativeCamera=native;
 return native;
}
export const applyNativeCamera=(camera,bounds,aspect,preset)=>setNativeCamera(camera,computeNativeCamera(bounds,aspect,preset));
export const applyNativeReflectionCamera=(camera,source,plane)=>setNativeCamera(camera,nativeReflectionCamera(source.userData.nativeCamera,plane));
