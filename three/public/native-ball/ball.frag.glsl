#version 300 es
#define SHADER_GLES30
#define SHADER_STANDALONE
#extension GL_ARB_shader_image_load_store : enable
#extension GL_ARB_conservative_depth : enable

// license:GPLv3+

#define GLSL

#define USE_GEOMETRY_SHADER 0
#define N_EYES 1
#define NUM_BALL_LIGHTS 8


// license:GPLv3+

//**************************************************************************
// GLSL defines to support common shader code
#ifdef GLSL
    #ifdef SHADER_GLES30 // OpenGL ES (for standalone builds)
        #define FLT_MIN_VALUE 0.00006103515625
        precision highp float;
        // Finni: preserve depth and HDR texture precision
        precision highp sampler2D;
        precision highp samplerCube;
        precision highp sampler2DArray;
        #define noperspective
        #define flat
        #define VS_CLIP_DISTANCE(pos) 
    #else
        #define FLT_MIN_VALUE 0.0000001
        #define VS_CLIP_DISTANCE(pos) gl_ClipDistance[0] = dot(pos, clip_plane)
    #endif

    //HLSL to GLSL helpers
    #define ddx(x) dFdx(x)
    #define ddy(x) dFdy(x)
    #define lerp(x,y,s) mix(x,y,s)
    #define saturate(x) clamp(x,0.0,1.0)
    #define any(x) (dot(x,x)>0.0005)
    #define sincos(phi,sp,cp) {sp=sin(phi);cp=cos(phi);}
    #define frac(x) fract(x)
    #define rsqrt(x) inversesqrt(x)
    #define rcp(x) (1.0/(x))

    #define mul(vecIn, MatIn) ((MatIn)*(vecIn))

    #define tex2Dlod(sampler, v) textureLod(sampler, (v).xy,(v).w)
    #define tex2D(sampler, v) texture(sampler, v)

    #define const
    #define UNIFORM uniform

    #define float4 vec4
    #define float3 vec3
    #define float2 vec2

    #define float4x4 mat4
    #define float3x3 mat3
    #define float2x2 mat2

    #define float4x3 mat4x3
    #define float3x4 mat3x4

    #define to_float3x3 mat3
    #define MAT3_BEGIN mat3(
    #define MAT_END )
    #define MAT_ROW3_BEGIN vec3(
    #define MAT_ROW_END )

    //Not working :-(
    //vec4 pow(vec4 b, float e) {return pow(b,vec4(e));}
    //vec3 pow(vec3 b, float e) {return pow(b,vec3(e));}
    //vec2 pow(vec2 b, float e) {return pow(b,vec2(e));}

    #define texNoLod(tex, pos) textureLod(tex, pos, 0.)
    #define BRANCH
    #define UNROLL

    #if (N_EYES == 1)
        #define samplerStereo sampler2D
        #define FS_LAYER_TO_GLOBAL
        #define texStereo(tex, pos) texture(tex, pos)
        #define texStereolod(tex, pos) textureLod(tex, (pos).xy, (pos).w)
        #define texStereoNoLod(tex, pos) textureLod(tex, pos, 0.)
        #define texStereoOffset(tex, pos, offset) textureOffset(tex, pos, offset)
        #define texStereoOffsetNoLod(tex, pos, offset) textureLodOffset(tex, pos, 0.0, offset)
        #define texStereoGather(tex, pos) textureGather(tex, pos)
    #else
        #define samplerStereo sampler2DArray
#if !defined(SHADER_GL410)
        #define GS_LAYER_COPY gl_Layer = eye_gs[0]
        #define FS_LAYER_TO_GLOBAL
        #define texStereo(tex, pos) texture(tex, vec3(vec2(pos).x, vec2(pos).y, gl_Layer))
        #define texStereolod(tex, pos) textureLod(tex, vec3((pos).x, (pos).y, gl_Layer), (pos).w)
        #define texStereoNoLod(tex, pos) textureLod(tex, vec3((pos).x, (pos).y, gl_Layer), 0.)
        #define texStereoOffset(tex, pos, offset) textureOffset(tex, vec3((pos).x, (pos).y, gl_Layer), offset)
        #define texStereoOffsetNoLod(tex, pos, offset) textureLodOffset(tex, vec3((pos).x, (pos).y, gl_Layer), 0.0, offset)
        #define texStereoGather(tex, pos) textureGather(tex, vec3((pos).x, (pos).y, gl_Layer))
#else
        #define GS_LAYER_COPY gl_Layer = eye_gs[0]; glLayer_gs = gl_Layer
        #define FS_LAYER_TO_GLOBAL g_glLayer = glLayer_gs
        #define texStereo(tex, pos) texture(tex, vec3(vec2(pos).x, vec2(pos).y, g_glLayer))
        #define texStereolod(tex, pos) textureLod(tex, vec3((pos).x, (pos).y, g_glLayer), (pos).w)
        #define texStereoNoLod(tex, pos) textureLod(tex, vec3((pos).x, (pos).y, g_glLayer), 0.)
        #define texStereoOffset(tex, pos, offset) textureOffset(tex, vec3((pos).x, (pos).y, g_glLayer), offset)
        #define texStereoOffsetNoLod(tex, pos, offset) textureLodOffset(tex, vec3((pos).x, (pos).y, g_glLayer), 0.0, offset)
        #define texStereoGather(tex, pos) textureGather(tex, vec3((pos).x, (pos).y, g_glLayer))
#endif
    #endif

    #if USE_GEOMETRY_SHADER
        #define VS_OUT(typ, name) out typ name##_gs
        #define VS_OUT_NOPERSP_NOGEOM(typ, name)
        #define VS_OUT_EYE out int eye_gs
        #define VS_VARYING(var, val) var##_gs = val
        #define VS_VARYING_NOGEOM(var, val)
        #define VS_POSITION(val_vs, val_gs) gl_Position = val_gs
        #define VS_EYE int eye_vs = gl_InstanceID + layer; eye_gs = eye_vs
    #else
        #define VS_OUT(typ, name) out typ name
        #define VS_OUT_NOPERSP_NOGEOM(typ, name) noperspective out typ name
        #define VS_OUT_EYE flat out float eye
        #define VS_VARYING(var, val) var = val
        #define VS_VARYING_NOGEOM(var, val) var = val
        #define VS_POSITION(val_vs, val_gs) gl_Position = val_vs
        #define VS_EYE int eye_vs = gl_InstanceID + layer; eye = float(eye_vs)
    #endif

//**************************************************************************
// HLSL defines to support common shader code
#else
    #define HLSL
    // disable warning 'pow(f, e) will not work for negative f, use abs(f) or conditionally handle negative values if you expect them' as it is fairly common and not actionable.
    #pragma warning(disable : 3571)

    #define N_EYES 1
    #define FLT_MIN_VALUE 0.0000001
    #define texNoLod(tex, pos) tex2Dlod(tex, float4(pos, 0., 0.))
    #define texStereoNoLod(tex, pos) texNoLod(tex, pos)
    #define BRANCH [branch]
    #define UNROLL [unroll]
    #define UNIFORM const
    #define to_float3x3 (float3x3)
    #define MAT3_BEGIN {
    #define MAT_END }
    #define MAT_ROW3_BEGIN {
    #define MAT_ROW_END }
#endif


//**************************************************************************
// Common definitions for OpenGL & HLSL

#ifdef SHADER_GL410
int g_glLayer = 0;
#endif

#define PI 3.1415926535897932384626433832795

float sqr(const float v)
{
    return v*v;
}

float2 sqr(const float2 v)
{
    return v*v;
}

float3 sqr(const float3 v)
{
    return v*v;
}

float3 mul_w1(const float3 v, const float4x4 m)
{
    return v.x*m[0].xyz + (v.y*m[1].xyz + (v.z*m[2].xyz + m[3].xyz));
}

float3 mul_w1(const float3 v, const float4x3 m)
{
    return v.x*m[0] + (v.y*m[1] + (v.z*m[2] + m[3]));
}

float3 mul_w0(const float3 v, const float4x3 m)
{
    return v.x*m[0] + v.y*m[1] + v.z*m[2];
}

#if 0
float acos_approx(const float v)
{
    const float x = abs(v);
    if(1. - x <= FLT_MIN_VALUE) // necessary due to compiler doing 1./rsqrt instead of sqrt
       return (v >= 0.) ? 0. : PI;
    const float res = (-0.155972/*C1*/ * x + 1.56467/*C0*/) * sqrt(1. - x);
    return (v >= 0.) ? res : PI - res;
}
#endif

float acos_approx_divPI(const float v)
{
    //return acos(v)*(1./PI);

    const float x = abs(v);
    if(1. - x <= FLT_MIN_VALUE) // necessary due to compiler doing 1./rsqrt instead of sqrt
       return (v >= 0.) ? 0. : 1.;
    const float res = ((-0.155972/PI)/*C1*/ * x + (1.56467/PI)/*C0*/) * sqrt(1. - x);
    return (v >= 0.) ? res : 1. - res;
}

#if 0
float atan2_approx(const float y, const float x)
{
	const float abs_y = abs(y);
	const float abs_x = abs(x);

	if(abs_x <= FLT_MIN_VALUE && abs_y <= FLT_MIN_VALUE)
	   return 0.;//(PI/4.);

	const float r = (abs_x - abs_y) / (abs_x + abs_y);
	const float angle = ((x < 0.) ? (0.75*PI) : (0.25*PI))
	                  + (0.211868/*C3*/ * r * r - 0.987305/*C1*/) * ((x < 0.) ? -r : r);
	return (y < 0.) ? -angle : angle;
}
#endif

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

#if 0
//!! this one is untested for special values (see atan2 approx!)
// 4th order hyperbolical approximation
// 7 * 10^-5 radians precision 
// Reference : Efficient approximations for the arctangent function, Rajan, S. Sichun Wang Inkol, R. Joyal, A., May 2006
float atan_approx(const float x)
{
	return x * (-0.1784 * abs(x) - 0.0663 * x*x + 1.0301);
}

float4x4 inverse4x4(const float4x4 m)
{
   float n11 = m[0][0], n12 = m[1][0], n13 = m[2][0], n14 = m[3][0];
   float n21 = m[0][1], n22 = m[1][1], n23 = m[2][1], n24 = m[3][1];
   float n31 = m[0][2], n32 = m[1][2], n33 = m[2][2], n34 = m[3][2];
   float n41 = m[0][3], n42 = m[1][3], n43 = m[2][3], n44 = m[3][3];

   float t11 = n23 * n34 * n42 - n24 * n33 * n42 + n24 * n32 * n43 - n22 * n34 * n43 - n23 * n32 * n44 + n22 * n33 * n44;
   float t12 = n14 * n33 * n42 - n13 * n34 * n42 - n14 * n32 * n43 + n12 * n34 * n43 + n13 * n32 * n44 - n12 * n33 * n44;
   float t13 = n13 * n24 * n42 - n14 * n23 * n42 + n14 * n22 * n43 - n12 * n24 * n43 - n13 * n22 * n44 + n12 * n23 * n44;
   float t14 = n14 * n23 * n32 - n13 * n24 * n32 - n14 * n22 * n33 + n12 * n24 * n33 + n13 * n22 * n34 - n12 * n23 * n34;

   float det = n11 * t11 + n21 * t12 + n31 * t13 + n41 * t14;
   float idet = 1.0 / det;

   float4x4 ret;

   ret[0][0] = t11 * idet;
   ret[0][1] = (n24 * n33 * n41 - n23 * n34 * n41 - n24 * n31 * n43 + n21 * n34 * n43 + n23 * n31 * n44 - n21 * n33 * n44) * idet;
   ret[0][2] = (n22 * n34 * n41 - n24 * n32 * n41 + n24 * n31 * n42 - n21 * n34 * n42 - n22 * n31 * n44 + n21 * n32 * n44) * idet;
   ret[0][3] = (n23 * n32 * n41 - n22 * n33 * n41 - n23 * n31 * n42 + n21 * n33 * n42 + n22 * n31 * n43 - n21 * n32 * n43) * idet;

   ret[1][0] = t12 * idet;
   ret[1][1] = (n13 * n34 * n41 - n14 * n33 * n41 + n14 * n31 * n43 - n11 * n34 * n43 - n13 * n31 * n44 + n11 * n33 * n44) * idet;
   ret[1][2] = (n14 * n32 * n41 - n12 * n34 * n41 - n14 * n31 * n42 + n11 * n34 * n42 + n12 * n31 * n44 - n11 * n32 * n44) * idet;
   ret[1][3] = (n12 * n33 * n41 - n13 * n32 * n41 + n13 * n31 * n42 - n11 * n33 * n42 - n12 * n31 * n43 + n11 * n32 * n43) * idet;

   ret[2][0] = t13 * idet;
   ret[2][1] = (n14 * n23 * n41 - n13 * n24 * n41 - n14 * n21 * n43 + n11 * n24 * n43 + n13 * n21 * n44 - n11 * n23 * n44) * idet;
   ret[2][2] = (n12 * n24 * n41 - n14 * n22 * n41 + n14 * n21 * n42 - n11 * n24 * n42 - n12 * n21 * n44 + n11 * n22 * n44) * idet;
   ret[2][3] = (n13 * n22 * n41 - n12 * n23 * n41 - n13 * n21 * n42 + n11 * n23 * n42 + n12 * n21 * n43 - n11 * n22 * n43) * idet;

   ret[3][0] = t14 * idet;
   ret[3][1] = (n13 * n24 * n31 - n14 * n23 * n31 + n14 * n21 * n33 - n11 * n24 * n33 - n13 * n21 * n34 + n11 * n23 * n34) * idet;
   ret[3][2] = (n14 * n22 * n31 - n12 * n24 * n31 - n14 * n21 * n32 + n11 * n24 * n32 + n12 * n21 * n34 - n11 * n22 * n34) * idet;
   ret[3][3] = (n12 * n23 * n31 - n13 * n22 * n31 + n13 * n21 * n32 - n11 * n23 * n32 - n12 * n21 * n33 + n11 * n22 * n33) * idet;

   return ret;
}
#endif


//
// Gamma & ToneMapping
//

#define BURN_HIGHLIGHTS 0.25

float3 InvReinhardToneMap(const float3 color)
{
    const float inv_2bh = 0.5 / BURN_HIGHLIGHTS;
    const float bh = 4.0 * BURN_HIGHLIGHTS - 2.0;
    return (color - 1.0 + sqrt(color * (color + bh) + 1.0)) * inv_2bh;
}

float InvsRGB(const float color)
{
    //return /*color * (color * (color * 0.305306011 + 0.682171111) + 0.012522878);/*/ pow(color, 2.2); // pow does not matter anymore on current GPUs //!! not completely true for example when tested with FSS tables

    if (color <= 0.04045) // 0.03928 ?
        return color * (1.0/12.92);
    else
        return pow(color * (1.0/1.055) + (0.055/1.055), 2.4);
}

float InvRec709(const float color)
{
    if (color <= 0.081)
        return color * (1.0/4.5);
    else
        return pow(color * (1.0/1.099) + (0.099/1.099), 1.0/0.45);
}

float InvGamma(const float color) //!! use hardware support? D3DSAMP_SRGBTEXTURE
{
    return InvsRGB(color);
}

float3 InvGamma(const float3 color) //!! use hardware support? D3DSAMP_SRGBTEXTURE
{
    return float3(InvGamma(color.x),InvGamma(color.y),InvGamma(color.z));
}

#if 1
float sRGB(const float f)
{
    //return pow(f, 1.0/2.2);
    // pow does not matter anymore on current GPUs (tested also on tablet/intel)
    /*const float t0 = sqrt(f);
    const float t1 = sqrt(t0);
    const float t2 = sqrt(t1);
    return 0.662002687 * t0 + 0.684122060 * t1 - 0.323583601 * t2 - 0.0225411470 * f;*/

    float s;
    //if (!(f > 0.0)) // also covers NaNs
    //    s = 0.0;
    /*else*/ if (f <= 0.0031308)
        s = 12.92 * f;
    else //if (f < 1.0)
        s = 1.055 * pow(f, 1.0/2.4) - 0.055;
    //else
    //    s = 1.0;

    return s;
}

float Rec709(const float f)
{
    float s;
    //if (!(f > 0.0)) // also covers NaNs
    //    s = 0.0;
    /*else*/ if (f <= 0.018)
        s = 4.5 * f;
    else //if (f < 1.0)
        s = 1.099 * pow(f, 0.45) - 0.099;
    //else
    //    s = 1.0;

    return s;
}

float FBGamma(const float color)
{
    return sRGB(color);
}
float2 FBGamma(const float2 color)
{
    return float2(FBGamma(color.x),FBGamma(color.y));
}
float3 FBGamma(const float3 color)
{
    return float3(FBGamma(color.x),FBGamma(color.y),FBGamma(color.z));
}
#else
#define FBGamma // uses hardware support via D3DRS_SRGBWRITEENABLE
#endif

#define Luminance(linearRGB) dot(linearRGB, float3(0.212655,0.715158,0.072187))


//#define FBGamma22(color) pow(color, 1.0/2.2) // apparently most consumer displays nowadays feature a plain 2.2 curve
float3 FBGamma22(const float3 color)
{
    return float3(pow(color.x, 1.0/2.2),pow(color.y, 1.0/2.2),pow(color.z, 1.0/2.2));
}


#if 0
// RGBM/RGBD

float3 DecodeRGBM(const float4 rgbm)
{
    return rgbm.rgb * (rgbm.a * MaxRange);
}

float4 EncodeRGBM(const float3 rgb)
{
    const float maxRGB = max(rgb.r, max(rgb.g, rgb.b));
    const float M = ceil(maxRGB * (255.0 / MaxRange)) * (1.0/255.0);
    return float4(rgb / (M * MaxRange), M); //!! handle rgb ~= 0 0 0
}

float3 DecodeRGBD(const float4 rgbd)
{
    return rgbd.rgb * ((MaxRange / 255.0) / rgbd.a);
}

float4 EncodeRGBD(const float3 rgb)
{
    const float maxRGB = max(rgb.r, max(rgb.g, rgb.b));
    const float D = saturate(floor(max(MaxRange / maxRGB, 1.0)) * (1.0/255.0)); //!! handle rgb ~= 0 0 0
    return float4(rgb * (D * (255.0 / MaxRange)), D);
}
#endif

//
// Blends
//

float4 Additive(const float4 cBase, const float4 cBlend, const float percent)
{
	return cBase + cBlend*percent;
}

float3 Screen (const float3 cBase, const float3 cBlend)
{
	return 1.0 - (1.0 - cBase) * (1.0 - cBlend);
}

float4 Screen (const float4 cBase, const float4 cBlend)
{
	return 1.0 - (1.0 - cBase) * (1.0 - cBlend);
}

float3 ScreenHDR (const float3 cBase, const float3 cBlend)
{
	return max(1.0 - (1.0 - cBase) * (1.0 - cBlend), float3(0.,0.,0.));
}

float4 ScreenHDR (const float4 cBase, const float4 cBlend)
{
	return max(1.0 - (1.0 - cBase) * (1.0 - cBlend), float4(0.,0.,0.,0.));
}

float4 Multiply (const float4 cBase, const float4 cBlend, const float percent)
{
	return cBase * cBlend*percent;
}

float4 Overlay (const float4 cBase, const float4 cBlend)
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
	cNew = lerp(cBase*cBlend*2.0, 1.0-2.0*(1.0-cBase)*(1.0-cBlend), cNew);

	//cNew.a = 1.0;
	return cNew;
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

uniform mat4 orientation;

layout(std140) uniform ballMatrixBlock {
	mat4 matView[N_EYES];
	mat4 matWorldView[N_EYES];
	mat4 matWorldViewInverse[N_EYES];
	mat4 matWorldViewProj[N_EYES];
};

uniform mat4 matProj[N_EYES]; // Separated from matrix block since we only need to set it once per frame (same for all balls)


// Early-Z-test implementation:
#if !defined(SHADER_GL410) && !defined(SHADER_GLES30)
layout(early_fragment_tests) in;
layout(depth_unchanged) out float gl_FragDepth;
#endif

uniform sampler2D tex_ball_color; // base texture
uniform samplerStereo tex_ball_playfield; // playfield
uniform sampler2D tex_ball_decal; // ball decal

uniform sampler2D tex_env; // envmap
uniform sampler2D tex_diffuse_env; // envmap radiance

// license:GPLv3+

//
// Lights
//

// disable warning 'pow(f, e) will not work for negative f, use abs(f) or conditionally handle negative values if you expect them' as it is fairly common and not actionable.
#pragma warning(disable : 3571)

#define NUM_LIGHTS 2

#define iLightPointNum NUM_LIGHTS
#define iLightPointBallsNum (NUM_LIGHTS+NUM_BALL_LIGHTS)

#ifdef GLSL
#if iLightPointBallsNum == iLightPointNum // basic shader
uniform vec4 basicLightPos[iLightPointNum];
uniform vec4 basicLightEmission[iLightPointNum];
#define lightPos basicLightPos
#define lightEmission basicLightEmission
#else // ball shader
uniform vec4 ballLightPos[iLightPointBallsNum];
uniform vec4 ballLightEmission[iLightPointBallsNum];
#define lightPos ballLightPos
#define lightEmission ballLightEmission
#endif

#else // HLSL
struct CLight
{
   float3 vPos;
   float3 vEmission;
};
#if iLightPointBallsNum == iLightPointNum // basic shader
const float4 basicPackedLights[3]; //!! 4x3 = NUM_LIGHTSx6
static const CLight lights[iLightPointBallsNum] = (CLight[iLightPointBallsNum])basicPackedLights;
#define packedLights basicPackedLights
#else // ball shader
const float4 ballPackedLights[15]; //!! 4x15 = (NUM_LIGHTS+NUM_BALL_LIGHTS)x6
static const CLight lights[iLightPointBallsNum] = (CLight[iLightPointBallsNum])ballPackedLights;
#define packedLights ballPackedLights
#endif
#endif

uniform float4 cAmbient_LightRange; //!! remove completely, just rely on envmap/IBL?

uniform float2 fenvEmissionScale_TexWidth;

uniform float2 fDisableLighting_top_below;

//
// Material Params
//

uniform float4 cBase_Alpha; //!! 0.04-0.95 in RGB

uniform float4 Roughness_WrapL_Edge_Thickness; // wrap in [0..1] for rim/wrap lighting

//
// Material Helper Functions
//

// Lower alpha on border of geometry
// - blending: amount of effect (0=no darkening, 1=full darkening)
// - thickness: thickness (0=no darkening, 1=darkening linear with N.V dot product)
float GeometricOpacity(const float NdotV, const float alpha, const float blending, const float thickness)
{
    //old version without thickness
    //return lerp(alpha, 1.0, blending*pow(1.0-abs(NdotV),5)); // fresnel for falloff towards silhouette

    //new version (COD/IW, t = thickness), thickness = 0.05 roughly corresponds to above version
    const float x = abs(NdotV); // flip normal in case of wrong orientation (backside lighting)
    const float g = blending * (1.0 - (x / (x * (1.0 - thickness) + thickness))); // Smith-Schlick G
    return lerp(alpha, 1.0, g); // fake opacity lerp to 'shadowed'
}

float3 FresnelSchlick(const float3 spec, const float LdotH, const float edge)
{
    return spec + (float3(edge,edge,edge) - spec) * pow(1.0 - LdotH, 5.); // UE4: float3(edge,edge,edge) = saturate(50.0*spec.g)
}

//

float3 DoPointLight(const float3 pos, const float3 N, const float3 V, const float3 diffuse, const float3 glossy, const float edge, const float glossyPower, const int i, const bool is_metal, const float eye) 
{ 
   //!! do in vertex shader?! or completely before?!
   //const float3 lightDir = mul_w1(lightPos[i].xyz, matView[int(eye)]) - pos;
   const float3 lightDir = (matView[int(eye)] * float4(lightPos[i].xyz, 1.0)).xyz - pos;
   const float3 L = normalize(lightDir);
   const float NdotL = dot(N, L);
   float3 Out = float3(0.0,0.0,0.0);

   // compute diffuse color (lambert with optional rim/wrap component)
   if (!is_metal && (NdotL + Roughness_WrapL_Edge_Thickness.y > 0.0))
      Out = diffuse * ((NdotL + Roughness_WrapL_Edge_Thickness.y) / sqr(1.0+Roughness_WrapL_Edge_Thickness.y));

   // add glossy component (modified ashikhmin/blinn bastard), not fully energy conserving, but good enough
   BRANCH if (NdotL > 0.0)
   {
     const float3 H = normalize(L + V); // half vector
     const float NdotH = dot(N, H);
     const float LdotH = dot(L, H);
     const float VdotH = dot(V, H);
     if ((NdotH > 0.0) && (LdotH > 0.0) && (VdotH > 0.0))
        Out += FresnelSchlick(glossy, LdotH, edge) * (((glossyPower + 1.0) / (8.0*VdotH)) * pow(NdotH, glossyPower));
   }

   //float fAtten = saturate( 1.0 - dot(lightDir/cAmbient_LightRange.w, lightDir/cAmbient_LightRange.w) );
   //float fAtten = 1.0/dot(lightDir,lightDir); // original/correct falloff

   const float sqrl_lightDir = dot(lightDir,lightDir); // tweaked falloff to have ranged lightsources
   float fAtten = saturate(1.0 - sqrl_lightDir*sqrl_lightDir/(cAmbient_LightRange.w*cAmbient_LightRange.w*cAmbient_LightRange.w*cAmbient_LightRange.w)); //!! pre-mult/invert cAmbient_LightRange.w?
   fAtten = fAtten*fAtten/(sqrl_lightDir + 1.0);

   float3 ambient = glossy;
   if (!is_metal)
       ambient += diffuse;

   const float3 result = Out * lightEmission[i].rgb * fAtten + ambient * cAmbient_LightRange.xyz;
   if (fDisableLighting_top_below.x != 0.0)
       return lerp(result,diffuse,fDisableLighting_top_below.x);
   else
       return result;
}

// does /PI-corrected lookup/final color already
float3 DoEnvmapDiffuse(const float3 N, const float3 diffuse)
{
   const float3 env = texNoLod(tex_diffuse_env, ray_to_equirectangular_uv(N)).xyz;
   return diffuse * env * fenvEmissionScale_TexWidth.x;
}

//!! PI?
// very very crude approximation by abusing miplevels
float3 DoEnvmapGlossy(const float3 N, const float3 V, const float2 Ruv, const float3 glossy, const float glossyPower)
{
   const float mip = min(log2(fenvEmissionScale_TexWidth.y * sqrt(3.0)) - 0.5*log2(glossyPower + 1.0), log2(fenvEmissionScale_TexWidth.y)-1.); //!! do diffuse lookup instead of this limit/min, if too low?? and blend?
   const float3 env = textureLod(tex_env, Ruv, mip).xyz;
   return glossy * env*fenvEmissionScale_TexWidth.x;
}

//!! PI?
float3 DoEnvmap2ndLayer(const float3 color1stLayer, const float3 pos, const float3 N, const float3 V, const float NdotV, const float2 Ruv, const float3 specular)
{
   const float3 w = FresnelSchlick(specular, NdotV, Roughness_WrapL_Edge_Thickness.z); //!! ?
   const float3 env = texNoLod(tex_env, Ruv).xyz;
   return lerp(color1stLayer, env*fenvEmissionScale_TexWidth.x, w); // weight (optional) lower diffuse/glossy layer with clearcoat/specular
}

// ////////////////////////////////////////////////////////////////////////////
// Apply lighting from the environment and the 2 scene lights
// - Lighting is kinda PBR since glossy and diffuse are normalized, and the 2nd layer (specular/clearcoat) is 'blended' via Fresnel
// - Apply the 2 points lights to the diffuse (Lambert with optional rim/wrap) and glossy (Ashikhmin/Blinn) components, clearcoat (a.k.a. specular) is not applied (as point lights).
//   Light energy can be tweaked in order to have ranged lights instead of the physical 1/d� energy
//   This lighting can be 'disabled', in fact replacing it by 2 times the diffuse color (backwards compatibility bug)
// - Apply the environment lighting with diffuse, glossy and a specular/clearcoat layer
//   Diffuse is applied via a precomputed/'filtered' version of the envmap.
//   Glossy is performed with a very crude approximation of the BRDF and the roughness parameter (simple mip-mapping of the envmap).
//   Specular just does a plain lookup in the envmap.
// - Backside (normal pointing away) is lighted as well as front facing (needed since quite a lot of tables feature wrong normals, or for transparents with 2 pass rendering)
float3 lightLoop(const float3 pos, float3 N, const float3 V, float3 diffuse, float3 glossy, const float3 specular, const float edge, const bool is_metal, const float eye) // input vectors (N,V) are normalized for BRDF evals
{
   float3 color = float3(0.0, 0.0, 0.0);

   float NdotV = dot(N,V);
   if (NdotV < 0.0)
   {
       // Flip normal in case for backside lighting.
       // Before 10.8, this was disabled when using normal mapping, but since tables are not all well behaving, this caused artefacts (for example Cirqus Voltaire vs Monster Bash), so this is now always performed.
       N = -N;
       NdotV = -NdotV;
   }
   NdotV = min(NdotV, 1.0); // For some reason I don't get, N (which is normalized) dot V (which is also normalized) may lead to value exceeding 1.0 then causing invalid results (in FresnelSchlick, negative pow)

   // normalize BRDF layer inputs //!! use diffuse = (1-glossy)*diffuse instead?
   const float diffuseMax = max(diffuse.x,max(diffuse.y,diffuse.z));
   const float glossyMax = max(glossy.x,max(glossy.y,glossy.z));
   const float specularMax = max(specular.x,max(specular.y,specular.z)); //!! not needed as 2nd layer only so far
   const float sum = diffuseMax + glossyMax /*+ specularMax*/;
   // energy conservation:
   if (sum > 1.0 && fDisableLighting_top_below.x < 1.0) // but allow overly bright contribution if lighting is disabled
   {
      const float invsum = 1.0/sum;
      diffuse  *= invsum;
      glossy   *= invsum;
      //specular *= invsum;
   }

   // Scene point lights
   BRANCH if ((!is_metal && (diffuseMax > 0.0)) || (glossyMax > 0.0))
   {
      BRANCH if (fDisableLighting_top_below.x == 1.0)
         color += float(iLightPointNum) * diffuse; // Old bug kept for backward compatibility: when lighting is disabled, it results to applying it twice
      else for (int i = 0; i < iLightPointNum; i++)
         color += DoPointLight(pos, N, V, diffuse, glossy, edge, Roughness_WrapL_Edge_Thickness.x, i, is_metal, eye); // no clearcoat needed as only pointlights so far
   }

   // Environment IBL
   BRANCH if (!is_metal && (diffuseMax > 0.0))
      // trafo back to world for lookup into world space envmap // actually: mul(float4(N,0.0), matViewInverseInverseTranspose), but optimized to save one matrix
      // matView is always an orthonormal matrix, so no need to normalize after transform
      color += DoEnvmapDiffuse(/*normalize*/((float4(N,0.0) * matView[int(eye)]).xyz), diffuse); // trafo back to world for lookup into world space envmap // actually: mul(vec4(N,0.0), matViewInverseInverseTranspose), but optimized to save one matrix
   BRANCH if ((glossyMax > 0.0) || (specularMax > 0.0))
   {
       float3 R = (2.0*NdotV)*N - V; // reflect(-V,N);
       // trafo back to world for lookup into world space envmap // actually: mul(float4(R,0.0), matViewInverseInverseTranspose), but optimized to save one matrix
       // matView is always an orthonormal matrix, so no need to normalize after transform
       R = /*normalize*/((float4(R,0.0) * matView[int(eye)]).xyz); // trafo back to world for lookup into world space envmap // actually: mul(vec4(R,0.0), matViewInverseInverseTranspose), but optimized to save one matrix
       const float2 Ruv = ray_to_equirectangular_uv(R);
       if (glossyMax > 0.0)
          color += DoEnvmapGlossy(N, V, Ruv, glossy, Roughness_WrapL_Edge_Thickness.x);
       if (specularMax > 0.0)
          color = DoEnvmap2ndLayer(color, pos, N, V, NdotV, Ruv, specular);
   }

   return /*Gamma(ToneMap(*/color/*))*/;
}

uniform float4  invTableRes_reflection;
uniform float4  w_h_disableLighting;
#define disableLighting (w_h_disableLighting.z != 0.)

out vec4 color;
#ifdef SHADER_GL410
flat in int glLayer_gs;
#endif


float3 ballLightLoop(const float3 pos, const float3 N, const float3 V, float3 diffuse, float3 glossy, const float3 specular, const float edge, const bool is_metal, const float eye)
{
   // N and V must be already normalized by the caller
   // N = normalize(N);
   // V = normalize(V);

   // normalize BRDF layer inputs //!! use diffuse = (1-glossy)*diffuse instead?
   const float diffuseMax = max(diffuse.x,max(diffuse.y,diffuse.z));
   const float glossyMax = max(glossy.x,max(glossy.y,glossy.z));
   const float specularMax = max(specular.x,max(specular.y,specular.z)); //!! not needed as 2nd layer only so far
   const float sum = diffuseMax + glossyMax; //+ specularMax
   if(sum > 1.0)
   {
      const float invsum = 1.0/sum;
      diffuse  *= invsum;
      glossy   *= invsum;
      //specular *= invsum;
   }

   float3 color = float3(0.0, 0.0, 0.0);

   BRANCH if((!is_metal && (diffuseMax > 0.0)) || (glossyMax > 0.0))
      for(int i = 0; i < iLightPointBallsNum; i++)  
         color += DoPointLight(pos, N, V, diffuse, glossy, edge, Roughness_WrapL_Edge_Thickness.x, i, is_metal, eye); // no clearcoat needed as only pointlights so far

   BRANCH if(!is_metal && (diffuseMax > 0.0))
      color += DoEnvmapDiffuse(normalize((matView[int(eye)] * vec4(N,0.0)).xyz), diffuse); // trafo back to world for lookup into world space envmap // actually: mul(vec4(N, 0.0), matViewInverseInverseTranspose)

   if(specularMax > 0.0)
      color += specular; //!! blend? //!! Fresnel with 1st layer?

   return color;
}



//RenderBall:P0:vsBall():gsBall():psBall(true, false)
//psBall(true, false)

in vec4 normal_t0x;
in vec4 worldPos_t0y;
flat in float eye;

void main()
{
    FS_LAYER_TO_GLOBAL;
    const float3 V = normalize(/*camera=0,0,0,1*/-worldPos_t0y.xyz);
    const float3 N = normalize(normal_t0x.xyz);
    const float3 R = reflect(V, N);

    float3 ballImageColor;
    const float edge = dot(V, R);
    // edge falloff to reduce aliasing on edges (picks smaller mipmap -> more blur)
    const float lod = (edge > 0.6) ? edge*(6.0*1.0/0.4)-(6.0*0.6/0.4) : 0.0;
    BRANCH if (true) // equirectangularMap
    { // Equirectangular Map Reflections
      // trafo back to world for lookup into world space envmap
      // matView is always an orthonormal matrix, so no need to normalize after transform
      const float3 rv = /*normalize*/((float4(-R,0.0) * matView[int(eye)]).xyz);
      const float2 uv = ray_to_equirectangular_uv(rv);
      ballImageColor = textureLod(tex_ball_color, uv, lod).rgb;
    }
    else
    { // Spherical Map Reflections
      // calculate the intermediate value for the final texture coords. found here http://www.ozone3d.net/tutorials/glsl_texturing_p04.php
      const float m = (1.0 - R.z > 0.) ? 0.3535533905932737622 * rsqrt(1.0 - R.z) : 0.; // 0.353...=0.5/sqrt(2)
      const float2 uv = float2(0.5 - m * R.x, 0.5 - m * R.y);
      ballImageColor = textureLod(tex_ball_color, uv, lod).rgb;
    }

    const float4 decalColorT = texture(tex_ball_decal, float2(normal_t0x.w, worldPos_t0y.w));
    float3 decalColor = decalColorT.rgb;

    if (! false) // decalMode
    {
       // decal texture is an alpha scratch texture and must be added to the ball texture
       // the strength of the scratches totally rely on the alpha values.
       decalColor *= decalColorT.a;
       ballImageColor += decalColor;
    }
    else
       ballImageColor = ScreenHDR(ballImageColor, decalColor);

    BRANCH if (disableLighting)
    {
       color = float4(ballImageColor,cBase_Alpha.a);
       return;
    }

    if (! false) // decalMode
       ballImageColor *= fenvEmissionScale_TexWidth.x;
    else
       ballImageColor *= 0.5*fenvEmissionScale_TexWidth.x; //!! 0.5=magic

    // No need to normalize here since the matWorldView matrix is normal (world is identity and view is always orthonormal)
    // No need to use a dedicated 'normal' matrix since the matWorldView is orthonormal (world is identity and view is always orthonormal)
    //const float3 playfield_normal = normalize((float4(0.,0.,1.,0.) * matWorldViewInverse[int(eye)]).xyz); //!! normalize necessary? // actually: mul(float4(0.,0.,1.,0.), matWorldViewInverseTranspose[int(eye)]), but optimized to save one matrix
    //const float3 playfield_normal = (matWorldView[int(eye)] * float4(0.,0.,1.,0.)).xyz;
    const float3 playfield_normal = matWorldView[int(eye)][2].xyz;
    const float NdotR = dot(playfield_normal, R);

    //const float3 playfield_p0 = mul_w1(float3(/*playfield_pos=*/0.,0.,0.), matWorldView[int(eye)]);
    const float3 playfield_p0 = matWorldView[int(eye)][3].xyz;
    const float t = dot(playfield_normal, worldPos_t0y.xyz - playfield_p0) / NdotR;
    const float3 playfield_hit = worldPos_t0y.xyz - t * R;

    // New implementation: use previous frame as a reflection probe instead of computing a simplified render (this is faster and more accurate, support playfield mesh, lighting,... but there can be artefacts, with self reflection,...)
    // TODO use previous frame projection instead of the one of the current frame to limit reflection distortion (still this is minimal)
    const float4 proj = matProj[int(eye)] * float4(playfield_hit, 1.0);
    const float2 uvp = float2(0.5, 0.5) + proj.xy * (0.5 / proj.w);
    const float3 playfieldColor = 0.25 * (
          texStereo(tex_ball_playfield, uvp + float2(w_h_disableLighting.x, 0.)).rgb
        + texStereo(tex_ball_playfield, uvp - float2(w_h_disableLighting.x, 0.)).rgb
        + texStereo(tex_ball_playfield, uvp + float2(0., w_h_disableLighting.y)).rgb
        + texStereo(tex_ball_playfield, uvp - float2(0., w_h_disableLighting.y)).rgb
    ); // a bit of supersampling, not strictly needed, but a bit better and not that costly

    // we don't clamp sampling outside the playfield (costly and no real visual impact)
    // const float2 uv = (matWorldViewInverse[int(eye)] * float4(playfield_hit, 1.0)).xy * invTableRes_reflection.xy;
    // && !(uv.x < 0.1 && uv.y < 0.1 && uv.x > 0.9 && uv.y > 0.9)
    BRANCH if (!(uvp.x < 0. || uvp.x > 1. || uvp.y < 0. || uvp.y > 1.) // outside of previous render => discard (we could use sampling techniques to optimize a bit)
            && !(t <= 0.)) // t < 0.0 may happen in some situation where ball intersects the playfield and the reflected point is inside the ball (like in kicker)
    {
        // NdotR allows to fade between playfield (down) and environment (up)
        ballImageColor = lerp(ballImageColor, playfieldColor, smoothstep(0.0, 0.15, NdotR) * invTableRes_reflection.z);
    }

    // We can face infinite reflections (ball->playfield->ball->playfield->...) which would overflow, or very bright dots that would cause lighting artefacts, so we saturate to an arbitrary value
    ballImageColor = min(ballImageColor, float3(15., 15., 15.));

    float3 diffuse = cBase_Alpha.rgb*0.075;
    if(! false) // decalMode
       diffuse *= decalColor; // scratches make the material more rough

    const float3 glossy = max(diffuse*2.0, float3(0.1,0.1,0.1)); //!! meh

    float3 specular = ballImageColor * cBase_Alpha.rgb; //!! meh, too, as only added in ballLightLoop anyhow
    if(! false) // decalMode
       specular *= float3(1.,1.,1.)-decalColor; // see above

    color.rgb = ballLightLoop(worldPos_t0y.xyz, N, V, diffuse, glossy, specular, 1.0, false, eye);
    color.a = cBase_Alpha.a;
}

