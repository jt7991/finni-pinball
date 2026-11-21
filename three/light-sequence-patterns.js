// SPDX-License-Identifier: GPL-3.0-or-later
// LightSeq::SetupTracers, Visual Pinball contributors, parts/lightseq.cpp
// 195f214dd4849b8ef6113fd377258b78d0dec3bf. See public/licenses/VPX-Physics-NOTICE.txt.
export const SEQ=Object.freeze({
  "SeqUpOn": 1,
  "SeqUpOff": 2,
  "SeqDownOn": 3,
  "SeqDownOff": 4,
  "SeqRightOn": 5,
  "SeqRightOff": 6,
  "SeqLeftOn": 7,
  "SeqLeftOff": 8,
  "SeqDiagUpRightOn": 9,
  "SeqDiagUpRightOff": 10,
  "SeqDiagUpLeftOn": 11,
  "SeqDiagUpLeftOff": 12,
  "SeqDiagDownRightOn": 13,
  "SeqDiagDownRightOff": 14,
  "SeqDiagDownLeftOn": 15,
  "SeqDiagDownLeftOff": 16,
  "SeqMiddleOutHorizOn": 17,
  "SeqMiddleOutHorizOff": 18,
  "SeqMiddleInHorizOn": 19,
  "SeqMiddleInHorizOff": 20,
  "SeqMiddleOutVertOn": 21,
  "SeqMiddleOutVertOff": 22,
  "SeqMiddleInVertOn": 23,
  "SeqMiddleInVertOff": 24,
  "SeqStripe1HorizOn": 25,
  "SeqStripe1HorizOff": 26,
  "SeqStripe2HorizOn": 27,
  "SeqStripe2HorizOff": 28,
  "SeqStripe1VertOn": 29,
  "SeqStripe1VertOff": 30,
  "SeqStripe2VertOn": 31,
  "SeqStripe2VertOff": 32,
  "SeqHatch1HorizOn": 33,
  "SeqHatch1HorizOff": 34,
  "SeqHatch2HorizOn": 35,
  "SeqHatch2HorizOff": 36,
  "SeqHatch1VertOn": 37,
  "SeqHatch1VertOff": 38,
  "SeqHatch2VertOn": 39,
  "SeqHatch2VertOff": 40,
  "SeqCircleOutOn": 41,
  "SeqCircleOutOff": 42,
  "SeqCircleInOn": 43,
  "SeqCircleInOff": 44,
  "SeqClockRightOn": 45,
  "SeqClockRightOff": 46,
  "SeqClockLeftOn": 47,
  "SeqClockLeftOff": 48,
  "SeqRadarRightOn": 49,
  "SeqRadarRightOff": 50,
  "SeqRadarLeftOn": 51,
  "SeqRadarLeftOff": 52,
  "SeqWiperRightOn": 53,
  "SeqWiperRightOff": 54,
  "SeqWiperLeftOn": 55,
  "SeqWiperLeftOff": 56,
  "SeqFanLeftUpOn": 57,
  "SeqFanLeftUpOff": 58,
  "SeqFanLeftDownOn": 59,
  "SeqFanLeftDownOff": 60,
  "SeqFanRightUpOn": 61,
  "SeqFanRightUpOff": 62,
  "SeqFanRightDownOn": 63,
  "SeqFanRightDownOff": 64,
  "SeqArcBottomLeftUpOn": 65,
  "SeqArcBottomLeftUpOff": 66,
  "SeqArcBottomLeftDownOn": 67,
  "SeqArcBottomLeftDownOff": 68,
  "SeqArcBottomRightUpOn": 69,
  "SeqArcBottomRightUpOff": 70,
  "SeqArcBottomRightDownOn": 71,
  "SeqArcBottomRightDownOff": 72,
  "SeqArcTopLeftUpOn": 73,
  "SeqArcTopLeftUpOff": 74,
  "SeqArcTopLeftDownOn": 75,
  "SeqArcTopLeftDownOff": 76,
  "SeqArcTopRightUpOn": 77,
  "SeqArcTopRightUpOff": 78,
  "SeqArcTopRightDownOn": 79,
  "SeqArcTopRightDownOff": 80,
  "SeqScrewRightOn": 81,
  "SeqScrewRightOff": 82,
  "SeqScrewLeftOn": 83,
  "SeqScrewLeftOff": 84,
  "SeqLastDynamic": 85,
  "SeqAllOff": 1000,
  "SeqAllOn": 1001,
  "SeqBlinking": 1002,
  "SeqRandom": 1003
});
const tracer=()=>({type:0,delay:0,length:0,frameCount:0,x:0,stepX:0,processStepX:0,y:0,stepY:0,processStepY:0,radius:0,stepRadius:0,processRadiusNeg:false,angle:0,stepAngle:0});
export function sequenceTracers(animation,tail,repeat,pause,rate,width,height,cx,cy){
 const ax=Math.abs(Math.trunc(width/2)-cx),ay=Math.abs(Math.trunc(height/2)-cy);
 let inverse=false,h1=tracer(),h2=tracer(),t1=tracer(),t2=tracer();
 switch (animation)
 {
 case SEQ.SeqBlinking:
 h1.type = 1; h1.length = Math.trunc(tail);
 tail = 0;
 h1.frameCount = Math.trunc(2);
 break;
 case SEQ.SeqRandom:
 h1.type = 2; h1.length = Math.trunc(tail); h1.frameCount = Math.trunc(pause / rate);
 tail = 0;
 repeat = 1;
 pause = 0;
 break;
 case SEQ.SeqUpOff:
 inverse = true;
 case SEQ.SeqUpOn:
 h1.type = 3; h1.x = 0; h1.stepX = 0; h1.processStepX = 1.0; h1.y = (height - 1); h1.stepY = -1.0; h1.processStepY = 0; h1.length = Math.trunc(width); h1.frameCount = Math.trunc(height);
 break;
 case SEQ.SeqDownOff:
 inverse = true;
 case SEQ.SeqDownOn:
 h1.type = 3; h1.x = 0; h1.stepX = 0; h1.processStepX = 1.0; h1.y = 0; h1.stepY = 1.0; h1.processStepY = 0; h1.length = Math.trunc(width); h1.frameCount = Math.trunc(height);
 break;
 case SEQ.SeqRightOff:
 inverse = true;
 case SEQ.SeqRightOn:
 h1.type = 3; h1.x = 0; h1.stepX = 1.0; h1.processStepX = 0; h1.y = 0; h1.stepY = 0; h1.processStepY = 1.0; h1.length = Math.trunc(height); h1.frameCount = Math.trunc(width);
 tail = Math.trunc(tail / 2);
 break;
 case SEQ.SeqLeftOff:
 inverse = true;
 case SEQ.SeqLeftOn:
 h1.type = 3; h1.x = (width - 1); h1.stepX = -1.0; h1.processStepX = 0; h1.y = 0; h1.stepY = 0; h1.processStepY = 1.0; h1.length = Math.trunc(height); h1.frameCount = Math.trunc(width);
 tail = Math.trunc(tail / 2);
 break;
 case SEQ.SeqDiagUpRightOff:
 inverse = true;
 case SEQ.SeqDiagUpRightOn:
 h1.type = 3; h1.x = 0; h1.stepX = 0; h1.processStepX = 0.5; h1.y = height - 1; h1.stepY = -1.0; h1.processStepY = 1.0; h1.length = Math.trunc(width * 2); h1.frameCount = Math.trunc(height + (width * 2));
 break;
 case SEQ.SeqDiagUpLeftOff:
 inverse = true;
 case SEQ.SeqDiagUpLeftOn:
 h1.type = 3; h1.x = (width - 1); h1.stepX = 0; h1.processStepX = -0.5; h1.y = (height - 1); h1.stepY = -1.0; h1.processStepY = 1.0; h1.length = Math.trunc(width * 2); h1.frameCount = Math.trunc(height + (width * 2));
 break;
 case SEQ.SeqDiagDownRightOff:
 inverse = true;
 case SEQ.SeqDiagDownRightOn:
 h1.type = 3; h1.x = 0; h1.stepX = 0; h1.processStepX = 0.5; h1.y = 0; h1.stepY = 1.0; h1.processStepY = -1.0; h1.length = Math.trunc(width * 2); h1.frameCount = Math.trunc(height + (width * 2));
 break;
 case SEQ.SeqDiagDownLeftOff:
 inverse = true;
 case SEQ.SeqDiagDownLeftOn:
 h1.type = 3; h1.x = (width - 1); h1.stepX = 0; h1.processStepX = -0.5; h1.y = 0; h1.stepY = 1.0; h1.processStepY = -1.0; h1.length = Math.trunc(width * 2); h1.frameCount = Math.trunc(height + (width * 2));
 break;
 case SEQ.SeqMiddleOutHorizOff:
 inverse = true;
 case SEQ.SeqMiddleOutHorizOn:
 h1.type = 3; h1.x = cx - 1.0; h1.stepX = -1.0; h1.processStepX = 0; h1.y = 0; h1.stepY = 0; h1.processStepY = 1.0; h1.length = Math.trunc(height); h1.frameCount = Math.trunc(Math.trunc(width / 2) + ax); h2.type = 3; h2.x = cx; h2.stepX = 1.0; h2.processStepX = 0; h2.y = 0; h2.stepY = 0; h2.processStepY = 1.0; h2.length = Math.trunc(height); h2.frameCount = Math.trunc(Math.trunc(width / 2) + ax);
 tail = Math.trunc(tail / 4);
 break;
 case SEQ.SeqMiddleInHorizOff:
 inverse = true;
 case SEQ.SeqMiddleInHorizOn:
 {
 const effectlength = (Math.trunc(width / 2) + ax);
 h1.type = 3; h1.x = cx - effectlength; h1.stepX = 1.0; h1.processStepX = 0; h1.y = 0; h1.stepY = 0; h1.processStepY = 1.0; h1.length = Math.trunc(height); h1.frameCount = Math.trunc(effectlength + 1); h2.type = 3; h2.x = cx + effectlength; h2.stepX = -1.0; h2.processStepX = 0; h2.y = 0; h2.stepY = 0; h2.processStepY = 1.0; h2.length = Math.trunc(height); h2.frameCount = Math.trunc(effectlength);
 tail = Math.trunc(tail / 4);
 }
 break;
 case SEQ.SeqMiddleOutVertOff:
 inverse = true;
 case SEQ.SeqMiddleOutVertOn:
 h1.type = 3; h1.x = 0; h1.stepX = 0; h1.processStepX = 1.0; h1.y = cy - 1.0; h1.stepY = -1; h1.processStepY = 0; h1.length = Math.trunc(width); h1.frameCount = Math.trunc(Math.trunc(height / 2) + ay); h2.type = 3; h2.x = 0; h2.stepX = 0; h2.processStepX = 1.0; h2.y = cy; h2.stepY = 1.0; h2.processStepY = 0; h2.length = Math.trunc(width); h2.frameCount = Math.trunc(Math.trunc(height / 2) + ay);
 tail = Math.trunc(tail / 2);
 break;
 case SEQ.SeqMiddleInVertOff:
 inverse = true;
 case SEQ.SeqMiddleInVertOn:
 {
 const effectlength = (Math.trunc(height / 2) + ay);
 h1.type = 3; h1.x = 0; h1.stepX = 0; h1.processStepX = 1.0; h1.y = cy - effectlength; h1.stepY = 1.0; h1.processStepY = 0; h1.length = Math.trunc(width); h1.frameCount = Math.trunc(effectlength + 1); h2.type = 3; h2.x = 0; h2.stepX = 0; h2.processStepX = 1.0; h2.y = cy + effectlength; h2.stepY = -1.0; h2.processStepY = 0; h2.length = Math.trunc(width); h2.frameCount = Math.trunc(effectlength);
 tail = Math.trunc(tail / 2);
 }
 break;
 case SEQ.SeqStripe1HorizOff:
 inverse = true;
 case SEQ.SeqStripe1HorizOn:
 h1.type = 3; h1.x = 0; h1.stepX = 1.0; h1.processStepX = 0; h1.y = cy - 1.0; h1.stepY = 0; h1.processStepY = -1.0; h1.length = Math.trunc(Math.trunc(height / 2) + ay); h1.frameCount = Math.trunc(width); h2.type = 3; h2.x = (width - 1); h2.stepX = -1.0; h2.processStepX = 0; h2.y = cy; h2.stepY = 0; h2.processStepY = 1.0; h2.length = Math.trunc(Math.trunc(height / 2) + ax); h2.frameCount = Math.trunc(width);
 tail = Math.trunc(tail / 2);
 break;
 case SEQ.SeqStripe2HorizOff:
 inverse = true;
 case SEQ.SeqStripe2HorizOn:
 h1.type = 3; h1.x = (width - 1); h1.stepX = -1.0; h1.processStepX = 0; h1.y = cy - 1.0; h1.stepY = 0; h1.processStepY = -1.0; h1.length = Math.trunc(Math.trunc(height / 2) + ay); h1.frameCount = Math.trunc(width); h2.type = 3; h2.x = 0; h2.stepX = 1.0; h2.processStepX = 0; h2.y = cy; h2.stepY = 0; h2.processStepY = 1.0; h2.length = Math.trunc(Math.trunc(height / 2) + ay); h2.frameCount = Math.trunc(width);
 tail = Math.trunc(tail / 2);
 break;
 case SEQ.SeqStripe1VertOff:
 inverse = true;
 case SEQ.SeqStripe1VertOn:
 h1.type = 3; h1.x = cx - 1.0; h1.stepX = 0; h1.processStepX = -1.0; h1.y = (height - 1); h1.stepY = -1.0; h1.processStepY = 0; h1.length = Math.trunc(Math.trunc(width / 2) + ax); h1.frameCount = Math.trunc(height); h2.type = 3; h2.x = cx; h2.stepX = 0; h2.processStepX = 1.0; h2.y = 0; h2.stepY = 1.0; h2.processStepY = 0; h2.length = Math.trunc(Math.trunc(width / 2) + ax); h2.frameCount = Math.trunc(height);
 break;
 case SEQ.SeqStripe2VertOff:
 inverse = true;
 case SEQ.SeqStripe2VertOn:
 h1.type = 3; h1.x = cx - 1.0; h1.stepX = 0; h1.processStepX = -1.0; h1.y = 0; h1.stepY = 1.0; h1.processStepY = 0; h1.length = Math.trunc(Math.trunc(width / 2) + ax); h1.frameCount = Math.trunc(height); h2.type = 3; h2.x = cx; h2.stepX = 0; h2.processStepX = 1.0; h2.y = (height - 1); h2.stepY = -1.0; h2.processStepY = 0; h2.length = Math.trunc(Math.trunc(width / 2) + ax); h2.frameCount = Math.trunc(height);
 break;
 case SEQ.SeqHatch1HorizOff:
 inverse = true;
 case SEQ.SeqHatch1HorizOn:
 h1.type = 3; h1.x = 0; h1.stepX = 1.0; h1.processStepX = 0; h1.y = 0; h1.stepY = 0; h1.processStepY = 2.0; h1.length = Math.trunc(Math.trunc(height / 2)); h1.frameCount = Math.trunc(width); h2.type = 3; h2.x = (width - 1); h2.stepX = -1.0; h2.processStepX = 0; h2.y = 1.0; h2.stepY = 0; h2.processStepY = 2.0; h2.length = Math.trunc(Math.trunc(height / 2)); h2.frameCount = Math.trunc(width);
 tail = Math.trunc(tail / 2);
 break;
 case SEQ.SeqHatch2HorizOff:
 inverse = true;
 case SEQ.SeqHatch2HorizOn:
 h1.type = 3; h1.x = (width - 1); h1.stepX = -1.0; h1.processStepX = 0; h1.y = 0; h1.stepY = 0; h1.processStepY = 2.0; h1.length = Math.trunc(Math.trunc(height / 2)); h1.frameCount = Math.trunc(width); h2.type = 3; h2.x = 0; h2.stepX = 1.0; h2.processStepX = 0; h2.y = 1.0; h2.stepY = 0; h2.processStepY = 2.0; h2.length = Math.trunc(Math.trunc(height / 2)); h2.frameCount = Math.trunc(width);
 tail = Math.trunc(tail / 2);
 break;
 case SEQ.SeqHatch1VertOff:
 inverse = true;
 case SEQ.SeqHatch1VertOn:
 h1.type = 3; h1.x = 0; h1.stepX = 0; h1.processStepX = 2.0; h1.y = (height - 1); h1.stepY = -1.0; h1.processStepY = 0; h1.length = Math.trunc(Math.trunc(width / 2)); h1.frameCount = Math.trunc(height); h2.type = 3; h2.x = 1.0; h2.stepX = 0; h2.processStepX = 2.0; h2.y = 0; h2.stepY = 1.0; h2.processStepY = 0; h2.length = Math.trunc(Math.trunc(width / 2)); h2.frameCount = Math.trunc(height);
 break;
 case SEQ.SeqHatch2VertOff:
 inverse = true;
 case SEQ.SeqHatch2VertOn:
 h1.type = 3; h1.x = 0; h1.stepX = 0; h1.processStepX = 2.0; h1.y = 0; h1.stepY = 1.0; h1.processStepY = 0; h1.length = Math.trunc(Math.trunc(width / 2)); h1.frameCount = Math.trunc(height); h2.type = 3; h2.x = 1.0; h2.stepX = 0; h2.processStepX = 2.0; h2.y = (height - 1); h2.stepY = -1.0; h2.processStepY = 0; h2.length = Math.trunc(Math.trunc(width / 2)); h2.frameCount = Math.trunc(height);
 break;
 case SEQ.SeqCircleOutOff:
 inverse = true;
 case SEQ.SeqCircleOutOn:
 h1.type = 4; h1.radius = 0; h1.stepRadius = 1.0; h1.x = cx; h1.y = cy; h1.frameCount = Math.trunc(Math.trunc(width / 2) + ax + Math.trunc(height / 2) + ay);
 break;
 case SEQ.SeqCircleInOff:
 inverse = true;
 case SEQ.SeqCircleInOn:
 h1.type = 4; h1.radius = (Math.trunc(width / 2) + ax + Math.trunc(height / 2) + ay); h1.stepRadius = -1.0; h1.x = cx; h1.y = cy; h1.frameCount = Math.trunc(Math.trunc(width / 2) + ax + Math.trunc(height / 2) + ay);
 break;
 case SEQ.SeqClockRightOff:
 inverse = true;
 case SEQ.SeqClockRightOn:
 h1.type = 5; h1.angle = 0; h1.stepAngle = 1.0; h1.processRadiusNeg = false; h1.x = cx; h1.y = cy; h1.length = Math.trunc(Math.trunc(width / 2) + ax + Math.trunc(height / 2) + ay); h1.frameCount = Math.trunc(360);
 break;
 case SEQ.SeqClockLeftOff:
 inverse = true;
 case SEQ.SeqClockLeftOn:
 h1.type = 5; h1.angle = 0; h1.stepAngle = -1.0; h1.processRadiusNeg = false; h1.x = cx; h1.y = cy; h1.length = Math.trunc(Math.trunc(width / 2) + ax + Math.trunc(height / 2) + ay); h1.frameCount = Math.trunc(360);
 break;
 case SEQ.SeqRadarRightOff:
 inverse = true;
 case SEQ.SeqRadarRightOn:
 h1.type = 5; h1.angle = 270.0; h1.stepAngle = 1.0; h1.processRadiusNeg = false; h1.x = cx; h1.y = (height - 1); h1.length = Math.trunc(height + width + ay + ax); h1.frameCount = Math.trunc(180);
 break;
 case SEQ.SeqRadarLeftOff:
 inverse = true;
 case SEQ.SeqRadarLeftOn:
 h1.type = 5; h1.angle = 90.0; h1.stepAngle = -1.0; h1.processRadiusNeg = false; h1.x = cx; h1.y = (height - 1); h1.length = Math.trunc(height + width + ay + ax); h1.frameCount = Math.trunc(180);
 break;
 case SEQ.SeqWiperRightOff:
 inverse = true;
 case SEQ.SeqWiperRightOn:
 h1.type = 5; h1.angle = 270.0; h1.stepAngle = -1.0; h1.processRadiusNeg = false; h1.x = cx; h1.y = 0; h1.length = Math.trunc(height + width + ay + ax); h1.frameCount = Math.trunc(180);
 break;
 case SEQ.SeqWiperLeftOff:
 inverse = true;
 case SEQ.SeqWiperLeftOn:
 h1.type = 5; h1.angle = 90.0; h1.stepAngle = 1.0; h1.processRadiusNeg = false; h1.x = cx; h1.y = 0; h1.length = Math.trunc(height + width + ay + ax); h1.frameCount = Math.trunc(180);
 break;
 case SEQ.SeqFanLeftUpOff:
 inverse = true;
 case SEQ.SeqFanLeftUpOn:
 h1.type = 5; h1.angle = 180.0; h1.stepAngle = -1.0; h1.processRadiusNeg = false; h1.x = 0; h1.y = cy; h1.length = Math.trunc(height + width + ay + ax); h1.frameCount = Math.trunc(180);
 break;
 case SEQ.SeqFanLeftDownOff:
 inverse = true;
 case SEQ.SeqFanLeftDownOn:
 h1.type = 5; h1.angle = 0; h1.stepAngle = 1.0; h1.processRadiusNeg = false; h1.x = 0; h1.y = cy; h1.length = Math.trunc(height + width + ay + ax); h1.frameCount = Math.trunc(180);
 break;
 case SEQ.SeqFanRightUpOff:
 inverse = true;
 case SEQ.SeqFanRightUpOn:
 h1.type = 5; h1.angle = 180.0; h1.stepAngle = -1.0; h1.processRadiusNeg = true; h1.x = (width - 1); h1.y = cy; h1.length = Math.trunc(height + width + ay + ax); h1.frameCount = Math.trunc(180);
 break;
 case SEQ.SeqFanRightDownOff:
 inverse = true;
 case SEQ.SeqFanRightDownOn:
 h1.type = 5; h1.angle = 0; h1.stepAngle = 1.0; h1.processRadiusNeg = true; h1.x = (width - 1); h1.y = cy; h1.length = Math.trunc(height + width + ay + ax); h1.frameCount = Math.trunc(180);
 break;
 case SEQ.SeqArcBottomLeftUpOff:
 inverse = true;
 case SEQ.SeqArcBottomLeftUpOn:
 h1.type = 5; h1.angle = 90.0; h1.stepAngle = -1.0; h1.processRadiusNeg = false; h1.x = 0; h1.y = (height - 1); h1.length = Math.trunc(height + width); h1.frameCount = Math.trunc(90);
 break;
 case SEQ.SeqArcBottomLeftDownOff:
 inverse = true;
 case SEQ.SeqArcBottomLeftDownOn:
 h1.type = 5; h1.angle = 0; h1.stepAngle = 1.0; h1.processRadiusNeg = false; h1.x = 0; h1.y = (height - 1); h1.length = Math.trunc(height + width); h1.frameCount = Math.trunc(90);
 break;
 case SEQ.SeqArcBottomRightUpOff:
 inverse = true;
 case SEQ.SeqArcBottomRightUpOn:
 h1.type = 5; h1.angle = 90.0; h1.stepAngle = 1.0; h1.processRadiusNeg = true; h1.x = (width - 1); h1.y = (height - 1); h1.length = Math.trunc(height + width); h1.frameCount = Math.trunc(90);
 break;
 case SEQ.SeqArcBottomRightDownOff:
 inverse = true;
 case SEQ.SeqArcBottomRightDownOn:
 h1.type = 5; h1.angle = 180.0; h1.stepAngle = -1.0; h1.processRadiusNeg = true; h1.x = (width - 1); h1.y = (height - 1); h1.length = Math.trunc(height + width); h1.frameCount = Math.trunc(90);
 break;
 case SEQ.SeqArcTopLeftUpOff:
 inverse = true;
 case SEQ.SeqArcTopLeftUpOn:
 h1.type = 5; h1.angle = 180.0; h1.stepAngle = -1.0; h1.processRadiusNeg = false; h1.x = 0; h1.y = 0; h1.length = Math.trunc(height + width); h1.frameCount = Math.trunc(90);
 break;
 case SEQ.SeqArcTopLeftDownOff:
 inverse = true;
 case SEQ.SeqArcTopLeftDownOn:
 h1.type = 5; h1.angle = 90.0; h1.stepAngle = 1.0; h1.processRadiusNeg = false; h1.x = 0; h1.y = 0; h1.length = Math.trunc(height + width); h1.frameCount = Math.trunc(90);
 break;
 case SEQ.SeqArcTopRightUpOff:
 inverse = true;
 case SEQ.SeqArcTopRightUpOn:
 h1.type = 5; h1.angle = 0; h1.stepAngle = 1.0; h1.processRadiusNeg = true; h1.x = (width - 1); h1.y = 0; h1.length = Math.trunc(height + width); h1.frameCount = Math.trunc(90);
 break;
 case SEQ.SeqArcTopRightDownOff:
 inverse = true;
 case SEQ.SeqArcTopRightDownOn:
 h1.type = 5; h1.angle = 90.0; h1.stepAngle = -1.0; h1.processRadiusNeg = true; h1.x = (width - 1); h1.y = 0; h1.length = Math.trunc(height + width); h1.frameCount = Math.trunc(90);
 break;
 case SEQ.SeqScrewRightOff:
 inverse = true;
 case SEQ.SeqScrewRightOn:
 h1.type = 5; h1.angle = 0; h1.stepAngle = 1.0; h1.processRadiusNeg = false; h1.x = cx; h1.y = cy - 1.0; h1.length = Math.trunc(Math.trunc(height / 2) + ay + Math.trunc(width / 2) + ax); h1.frameCount = Math.trunc(180); h2.type = 5; h2.angle = (180 - 1); h2.stepAngle = 1.0; h2.processRadiusNeg = false; h2.x = cx; h2.y = cy; h2.length = Math.trunc(Math.trunc(height / 2) + ay + Math.trunc(width / 2) + ax); h2.frameCount = Math.trunc(180);
 break;
 case SEQ.SeqScrewLeftOff:
 inverse = true;
 case SEQ.SeqScrewLeftOn:
 h1.type = 5; h1.angle = 0; h1.stepAngle = -1.0; h1.processRadiusNeg = false; h1.x = cx; h1.y = cy - 1.0; h1.length = Math.trunc(Math.trunc(height / 2) + ay + Math.trunc(width / 2) + ax); h1.frameCount = Math.trunc(180); h2.type = 5; h2.angle = (180 - 1); h2.stepAngle = -1.0; h2.processRadiusNeg = false; h2.x = cx; h2.y = cy; h2.length = Math.trunc(Math.trunc(height / 2) + ay + Math.trunc(width / 2) + ax); h2.frameCount = Math.trunc(180);
 break;
 default:
 h1.length = Math.trunc(0); h1.frameCount = Math.trunc(1);
 tail = 0;
 repeat = 1;
 pause = 0;
 break;
 }
 if(tail!==0){t1={...h1,delay:tail};t2={...h2,delay:tail};}
 if(inverse){[h1,t1]=[t1,h1];[h2,t2]=[t2,h2];}
 return {tracers:[h1,h2,t1,t2],tail,repeat,pause};
}
