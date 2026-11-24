// browser/app.js applies this rule setting after native table startup.
// Raw authored-table references omit the player setting and retain their input.
export const mainPlayerSettings=Object.freeze({tiltSensitivity:0});
export const mainBallSettings=Object.freeze({frontDecal:''});
export const mainSceneSettings=Object.freeze({hideNativeDmd:true});

export function applyPlayerSettings(rules,settings){
  if(settings?.tiltSensitivity===undefined)return;
  const sensitivity=settings.tiltSensitivity;
  if(!Number.isFinite(sensitivity)||sensitivity<0)throw Error('Invalid player tilt sensitivity');
  rules.execute(`Tilt=0:TiltSensitivity=${sensitivity}`);
}

export function applySceneSettings(rules,settings){
  if(!settings?.hideNativeDmd)return;
  for(let i=1;i<=41;i++)rules.objects.get('digit'+String(i).padStart(3,'0')).visible=false;
  rules.objects.get('digitgrid').visible=false;
}

export function applyBallSettings(rules,settings){
  if(settings?.frontDecal===undefined)return;
  if(typeof settings.frontDecal!=='string')throw Error('Invalid player ball decal');
  rules.objects.get('table1').ballfrontdecal=settings.frontDecal;
}
