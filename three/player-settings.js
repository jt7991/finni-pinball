// browser/app.js applies this rule setting after native table startup.
// Raw authored-table references omit the player setting and retain their input.
export const mainPlayerSettings=Object.freeze({tiltSensitivity:0});
export const mainBallSettings=Object.freeze({frontDecal:''});

export function applyPlayerSettings(rules,settings){
  if(settings?.tiltSensitivity===undefined)return;
  const sensitivity=settings.tiltSensitivity;
  if(!Number.isFinite(sensitivity)||sensitivity<0)throw Error('Invalid player tilt sensitivity');
  rules.execute(`Tilt=0:TiltSensitivity=${sensitivity}`);
}

export function applyBallSettings(rules,settings){
  if(settings?.frontDecal===undefined)return;
  if(typeof settings.frontDecal!=='string')throw Error('Invalid player ball decal');
  rules.objects.get('table1').ballfrontdecal=settings.frontDecal;
}
