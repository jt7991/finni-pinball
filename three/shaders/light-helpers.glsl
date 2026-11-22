// SPDX-License-Identifier: GPL-3.0-or-later
// Visual Pinball Helpers.fxh, 195f214dd4849b8ef6113fd377258b78d0dec3bf.
float acos_approx_divPI(const float v)
{
    //return acos(v)*(1./PI);

    const float x = abs(v);
    if(1. - x <= FLT_MIN_VALUE) // necessary due to compiler doing 1./rsqrt instead of sqrt
       return (v >= 0.) ? 0. : 1.;
    const float res = ((-0.155972/PI)/*C1*/ * x + (1.56467/PI)/*C0*/) * sqrt(1. - x);
    return (v >= 0.) ? res : 1. - res;
}

float atan2_approx_div2PI(const float y, const float x)
{
	//return atan2(y,x)*(0.5/PI);

	const float abs_y = abs(y);
	const float abs_x = abs(x);

	if(abs_x <= FLT_MIN_VALUE && abs_y <= FLT_MIN_VALUE)
	   return 0.;//(PI/4.)*(0.5/PI);

	const float r = (abs_x - abs_y) / (abs_x + abs_y);
	const float angle = ((x < 0.) ? (3./8.) : (1./8.))
	                  + (0.211868/*C3*//(2.*PI) * r * r - 0.987305/*C1*//(2.*PI)) * ((x < 0.) ? -r : r);
	return (y < 0.) ? -angle : angle;
}

#if 0
float asin_approx(const float v)
{
    const float x = abs(v);
    if(1. - x <= FLT_MIN_VALUE) // necessary due to compiler doing 1./rsqrt instead of sqrt
       return (v >= 0.) ? (0.5*PI) : -(0.5*PI);
    const float res = (-0.155972/*C1*/ * x + 1.56467/*C0*/) * sqrt(1. - x);
    return (v >= 0.) ? (0.5*PI) - res : -(0.5*PI) + res;
}
#endif

float asin_approx_divPI(const float v)
{
	//return asin(v) / PI;

    const float x = abs(v);
    if(1. - x <= FLT_MIN_VALUE) // necessary due to compiler doing 1./rsqrt instead of sqrt
       return (v >= 0.) ? 0.5 : -0.5;
    const float res = ((-0.155972/PI)/*C1*/ * x + (1.56467/PI)/*C0*/) * sqrt(1. - x);
    return (v >= 0.) ? 0.5 - res : -0.5 + res;
}

float2 ray_to_equirectangular_uv(const float3 ray)
{
   return float2( // remap to 2D envmap coords
		0.5 + atan2_approx_div2PI(ray.y, ray.x),
		acos_approx_divPI(ray.z));
}

float4 ScreenHDR (const float4 cBase, const float4 cBlend)
{
	return max(1.0 - (1.0 - cBase) * (1.0 - cBlend), float4(0.,0.,0.,0.));
}

float4 OverlayHDR (const float4 cBase, const float4 cBlend)
{
	// overlay has two output possbilities
	// which is taken is decided if pixel value
	// is below half or not

	float4 cNew = step(0.5, cBase);

	// we pick either solution
	// depending on pixel

	// first is case of < 0.5
	// second is case for >= 0.5

	// interpolate between the two, 
	// using color as influence value
	cNew = max(lerp(cBase*cBlend*2.0, 1.0-2.0*(1.0-cBase)*(1.0-cBlend), cNew), float4(0.,0.,0.,0.));

	//cNew.a = 1.0;
	return cNew;
}
