#version 300 es
#define SHADER_GLES30
#define SHADER_STANDALONE
#extension GL_ARB_conservative_depth : enable

// license:GPLv3+

#define GLSL

#define USE_GEOMETRY_SHADER 0
#define N_EYES 1

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

//!! have switch to choose if texture is weighted by diffuse/glossy or is just used raw?

#define NUM_BALL_LIGHTS 0 // just to avoid having too much constant mem allocated

layout(std140) uniform basicMatrixBlock {
	mat4 matWorld;
	mat4 matView[N_EYES];
	mat4 matWorldView[N_EYES];
	mat3x4 matWorldViewInverseTranspose[N_EYES];
	vec4 unusedFillerFormatWorldViewInverseTranspose[N_EYES];
	mat4 matWorldViewProj[N_EYES];
};

// #version 400

#define GLSL

#define USE_GEOMETRY_SHADER 0
#define N_EYES 1
// #include "Helpers.fxh"

// Early-Z-test implementation:
// Don't enable early_fragment_tests in basicshader, only enable conservative_depth
// Otherwise shader will cull unintended things like mini-playfield under regular playfield
//#extension GL_ARB_shader_image_load_store : enable
//layout(early_fragment_tests) in;
#if !defined(SHADER_GL410) && !defined(SHADER_GLES30)
layout(depth_unchanged) out float gl_FragDepth;
#endif

uniform sampler2D tex_base_color; // base texture
uniform sampler2D tex_env; // envmap
uniform sampler2D tex_diffuse_env; // envmap radiance
uniform samplerStereo tex_base_transmission; // bulb light buffer
uniform sampler2D tex_base_normalmap; // normal map
uniform samplerStereo tex_reflection; // reflections
uniform samplerStereo tex_refraction; // refractions
uniform samplerStereo tex_probe_depth; // depth probe

uniform bool objectSpaceNormalMap;

uniform bool is_metal;
uniform bool doNormalMapping;
uniform bool doRefractions;

uniform mat4 matProj[N_EYES]; // Separated from matrix block since we only need to set it once per frame

uniform float4 refractionTint_thickness;
#define refractionTint (refractionTint_thickness.rgb)
#define refractionThickness (refractionTint_thickness.w)

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

uniform float4 cClearcoat_EdgeAlpha;
uniform float4 cGlossy_ImageLerp;
//!! No value is under 0.02
//!! Non-metals value are un-intuitively low: 0.02-0.08
//!! Gemstones are 0.05-0.17
//!! Metals have high specular reflectance: 0.5-1.0

uniform float4 staticColor_Alpha;
uniform float alphaTestValue;

uniform float4 w_h_height;

uniform float4 mirrorNormal_factor;
#define mirrorNormal (mirrorNormal_factor.xyz)
#define mirrorFactor (mirrorNormal_factor.w)
#define doReflections (mirrorNormal_factor.w > 0.0)

out vec4 color;
#ifdef SHADER_GL410
flat in int glLayer_gs;
#endif

uniform float4 lightCenter_doShadow;

// license:GPLv3+

// Shared shader file used by bulb lights and basic shaders (OpenGL and DX9)

#define NUM_BALLS 8

#ifdef GLSL
uniform vec4 balls[NUM_BALLS];
#else
const float4 balls[NUM_BALLS];
#endif

// Raytraced ball shadows
float get_light_ball_shadow(const float3 light_pos, const float3 light_dir, const float light_dist)
{
	float result = 1.0;
	for (int i = 0; i < NUM_BALLS; i++)
	{
		const float ball_r = balls[i].w;
		BRANCH if (ball_r == 0.0) // early out as soon as first 'invalid' ball is detected
			return result;
		const float3 ball_pos = balls[i].xyz;
		const float3 light_ball_ray = ball_pos - light_pos;
		const float dot_lbr_lr_divld = dot(light_ball_ray, light_dir) / (light_dist * light_dist);
		// Don't cast shadow behind the light or before occluder
		BRANCH if (dot_lbr_lr_divld > 0.0 && dot_lbr_lr_divld < 1.0)
		{
			const float3 dist = light_ball_ray - dot_lbr_lr_divld * light_dir;
			const float d2 = length(dist);
			const float light_r = 5.0; // light radius in VPX units
			const float smoothness = light_r - light_r * dot_lbr_lr_divld;
			const float light_inside_ball_sqr = saturate((light_ball_ray.x*light_ball_ray.x + light_ball_ray.y*light_ball_ray.y)/(ball_r*ball_r)); // fade to 1 if light inside ball
			result *= 1.0 + light_inside_ball_sqr*(-1.0 + 0.1 + 0.9 * smoothstep(ball_r-smoothness, ball_r+smoothness, d2));
		}
	}
	return result;
}

mat3 TBN_trafo(const float3 N, const float3 V, const float2 uv)
{
   // derivatives: edge vectors for tri-pos and tri-uv
   const float3 dpx = dFdx(V);
   const float3 dpy = dFdy(V);
   const float2 duvx = dFdx(uv);
   const float2 duvy = dFdy(uv);

   // solve linear system
   const float3 dp2perp = cross(N, dpy);
   const float3 dp1perp = cross(dpx, N);
   const float3 T = dp2perp * duvx.x + dp1perp * duvy.x;
   const float3 B = dp2perp * duvx.y + dp1perp * duvy.y;

   // construct scale-invariant transformation
   return mat3(T, B, N * sqrt( max(dot(T,T), dot(B,B)) )); // inverse scale, as will be normalized anyhow later-on (to save some mul's)
}

float3 normal_map(const float3 N, const float3 V, const float2 uv, const float eye)
{
   const float3 tn = texture(tex_base_normalmap, uv).xyz * (255./127.) - (128./127.);
   BRANCH if (objectSpaceNormalMap)
   { // Object space: this matches the object space, +X +Y +Z, export/baking in Blender with our trafo setup
      return normalize((matWorldViewInverseTranspose[int(eye)] * float3(tn.x, tn.y, -tn.z)).xyz);
   }
   else
   { // Tangent space
      return normalize((TBN_trafo(N, V, uv) * tn).xyz);
   }
}

// Compute reflections from reflection probe (screen space coordinates)
// This is a simplified reflection model where reflected light is added instead of being mixed according to the fresnel coefficient (stronger reflection hiding the object's color at grazing angles)
float3 compute_reflection(const float2 screenSpace, const float3 N, const float eye)
{
   // Only apply to faces pointing in the direction of the probe (normal = [0,0,-1])
   // the smoothstep values are *magic* values taken from visual tests
   // dot(mirrorNormal, N) does not really needs to be done per pixel and could be moved to the vertx shader
   // Offset by half a texel to use GPU filtering for some blur
   return smoothstep(0.5, 0.9, dot(mirrorNormal, N)) * mirrorFactor * texStereo(tex_reflection, screenSpace + 0.5 * w_h_height.xy).rgb;
}

// Compute refractions from screen space probe
float3 compute_refraction(const float3 pos, const float2 screenSpace, const float3 N, const float3 V, const float eye)
{
   // Compute refracted visible position then project from world view position to probe UV
   // const float4x4 matProj = mul(inverse4x4(matWorldView[int(eye)]), matWorldViewProj[int(eye)]); // this has been moved to the matrix uniform stack for performance reasons
   const float3 R = refract(V, N, 1.0 / 1.5); // n1 = 1.0 (air), n2 = 1.5 (plastic), eta = n1 / n2
   const float3 refracted_pos = pos + refractionThickness * R; // Shift ray by the thickness of the material
   const float4 proj = matProj[int(eye)] * float4(refracted_pos, 1.0);

   float2 uv = float2(0.5, 0.5) + proj.xy * (0.5 / proj.w);

   // Check if the sample position is behind the object pos. If not take don't perform refraction as it would lead to refract things above us (so reflect)
   const float d = texStereo(tex_probe_depth, uv).x;
   if (d < gl_FragCoord.z)
      uv = screenSpace;

   // The following code gives a smoother transition but depends too much on the POV since it uses homogeneous depth to lerp instead of fragment's world depth
   //const float3 unbiased = float3(1.0, 0.0, 0.0);
   //const float3 biased = float3(0.0, 1.0, 0.0);
   //const float3 unbiased = tex2D(tex_refraction, screenSpace * w_h_height.xy).rgb;
   //const float3 biased = tex2D(tex_refraction, uv).rgb;
   //return lerp(unbiased, biased, saturate((d - gl_FragCoord.z) / gl_FragCoord.w));

   /* // Debug output
   if (length(N) < 0.5) // invalid normal, shown as red for debugging
      return float3(1.0, 0.0, 0.0);
   if (dot(N, V) < 0.0) // Wrong orientation? (looking from the back, shown as blue for debugging)
      return float3(0.0, 0.0, 1.0);
   if (length(R) < 0.5) // invalid refraction state (no refraction, shown as green for debugging)
      return float3(0.0, 1.0, 0.0);*/

   return refractionTint.rgb * texStereo(tex_refraction, uv).rgb;
}

//------------------------------------
//
// Standard Materials
//

//-----------------------------------------------------------------------------
// Vertex shaders
//-----------------------------------------------------------------------------


uniform vec4 lightColor_intensity;
uniform vec4 lightColor2_falloff_power;
uniform vec4 lightCenter_maxRange;

uniform bool lightingOff;

uniform sampler2D tex_light_color; // base texture


//basic_reflection_only:P0:vs_notex_main():gs_notex_main():ps_main_reflection_only()
//ps_main_reflection_only()

in vec2 tex01;
in vec3 worldPos;
in vec3 normal;
flat in float eye;

void main()
{
   FS_LAYER_TO_GLOBAL;
   const float3 N = normalize(normal);
#ifndef SHADER_GLES30
   color.rgb = compute_reflection(gl_FragCoord.xy * w_h_height.xy, N, eye);
#else
   color.rgb = compute_reflection(gl_FragCoord.xy * 0.5 + vec2(0.5), N, eye);
#endif
   color.a = 1.0;
   color *= staticColor_Alpha;
}


