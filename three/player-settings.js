// browser/app.js applies this rule setting after native table startup.
// Raw authored-table references omit the player setting and retain their input.
export const mainPlayerSettings=Object.freeze({tiltSensitivity:0});

export function applyPlayerSettings(rules,settings){
  if(settings?.tiltSensitivity===undefined)return;
  const sensitivity=settings.tiltSensitivity;
  if(!Number.isFinite(sensitivity)||sensitivity<0)throw Error('Invalid player tilt sensitivity');
  rules.execute(`Tilt=0:TiltSensitivity=${sensitivity}`);
}
