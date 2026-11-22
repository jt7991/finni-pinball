#version 300 es
#define SHADER_GLES30
#define SHADER_STANDALONE

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

// w_h_height.xy contains inverse size of source texture (1/w, 1/h), i.e. one texel shift to the upper (DX)/lower (OpenGL) left texel. Since OpenGL has upside down textures it leads to a different texel if not sampled on both sides
// . for bloom, w_h_height.z keeps strength
// . for mirror, w_h_height.z keeps inverse strength
// . for AO, w_h_height.zw keeps per-frame offset for temporal variation of the pattern
// . for AA techniques, w_h_height.z keeps source texture width, w_h_height.w is a boolean set to 1 when depth is available
// . for parallax stereo, w_h_height.z keeps source texture height, w_h_height.w keeps the 3D offset
uniform vec4 w_h_height;

uniform vec2 AO_scale_timeblur;

uniform vec4 bloom_dither_colorgrade;
#define do_bloom (bloom_dither_colorgrade.x == 1.)
#define do_dither (bloom_dither_colorgrade.y == 1.)
#define color_grade (bloom_dither_colorgrade.z == 1.)

uniform samplerStereo tex_fb_filtered;   // Framebuffer (filtered)
uniform samplerStereo tex_fb_unfiltered; // Framebuffer (unfiltered)
uniform samplerStereo tex_bloom;         // Bloom
uniform samplerStereo tex_ao;            // AO Result (also used as input from the previous frame when computing AO)
uniform samplerStereo tex_depth;         // Depth
uniform sampler2D tex_color_lut;         // Color grade LUT
uniform sampler2D tex_ao_dither;         // AO dither
uniform samplerStereo tex_normals;       // Normals

// license:GPLv3+

#ifdef GLSL
uniform float4 exposure_wcg; // overall scene exposure

// HDR->HDR spline based remapping // only BGFX
uniform float4 spline1;
uniform float2 spline2;

#else // HLSL

const float4 exposure_wcg; // overall scene exposure

// HDR->HDR spline based remapping // only BGFX
const float4 spline1;
const float2 spline2;

#endif

#define exposure (exposure_wcg.x)

// //////////////////////////////////////////////////////////////////////////////////////////////////
// Tonemapping

#define MAX_BURST 1000.0

float ReinhardToneMap(float l)
{
    l *= exposure;

    // The clamping (to an arbitrary high value) prevents overflow leading to nan/inf in turn rendered as black blobs (at least on NVidia hardware)
    return min(l * ((l * BURN_HIGHLIGHTS + 1.0) / (l + 1.0)), MAX_BURST); // overflow is handled by bloom
}
float2 ReinhardToneMap(float2 color)
{
    color *= exposure;

    // The clamping (to an arbitrary high value) prevents overflow leading to nan/inf in turn rendered as black blobs (at least on NVidia hardware)
    const float l = min(dot(color, float2(0.176204 + 0.0108109 * 0.5, 0.812985 + 0.0108109 * 0.5)), MAX_BURST); // CIE RGB to XYZ, Y row (relative luminance)
    return color * ((l * BURN_HIGHLIGHTS + 1.0) / (l + 1.0)); // overflow is handled by bloom
}
float3 ReinhardToneMap(float3 color)
{
    color *= exposure;

    // The clamping (to an arbitrary high value) prevents overflow leading to nan/inf in turn rendered as black blobs (at least on NVidia hardware)
    const float l = min(dot(color, float3(0.176204, 0.812985, 0.0108109)), MAX_BURST); // CIE RGB to XYZ, Y row (relative luminance)
    return color * ((l * BURN_HIGHLIGHTS + 1.0) / (l + 1.0)); // overflow is handled by bloom
}

float3 RRTAndODTFit(float3 v)
{
    float3 a = v * (v + 0.0245786) - 0.000090537;
    float3 b = v * (0.983729 * v + 0.4329510) + 0.238081;
    return a / b;
}
#ifdef GLSL
// sRGB => XYZ => D65_2_D60 => AP1 => RRT_SAT
const mat3 ACESInputMat = mat3(
    0.59719, 0.35458, 0.04823,
    0.07600, 0.90834, 0.01566,
    0.02840, 0.13383, 0.83777
);
// ODT_SAT => XYZ => D60_2_D65 => sRGB
const mat3 ACESOutputMat = mat3(
     1.60475, -0.53108, -0.07367,
    -0.10208,  1.10813, -0.00605,
    -0.00327, -0.07276,  1.07602
);
vec3 ACESFitted(vec3 color)
{
    color = color * ACESInputMat;
    // Apply RRT and ODT
    color = RRTAndODTFit(color);
    color = color * ACESOutputMat;
    return color;
}
#else
// sRGB => XYZ => D65_2_D60 => AP1 => RRT_SAT
static const float3x3 ACESInputMat =
{
    {0.59719, 0.35458, 0.04823},
    {0.07600, 0.90834, 0.01566},
    {0.02840, 0.13383, 0.83777}
};
// ODT_SAT => XYZ => D60_2_D65 => sRGB
static const float3x3 ACESOutputMat =
{
    { 1.60475, -0.53108, -0.07367},
    {-0.10208,  1.10813, -0.00605},
    {-0.00327, -0.07276,  1.07602}
};
float3 ACESFitted(float3 color)
{
    color = mul(ACESInputMat, color);
    // Apply RRT and ODT
    color = RRTAndODTFit(color);
    color = mul(ACESOutputMat, color);
    return color;
}
#endif

// There are numerous filmic curve fitting implementation shared publicly
// I gathered a few here to be able to test and find the best result (also performance wise)
// Warning: The returned value is already gamma corrected
float3 FilmicToneMap(float3 color)
{
    color *= exposure;

    // The clamping (to an arbitrary high value) prevents overflow leading to nan/inf in turn rendered as black blobs (at least on NVidia hardware)
    color = min(color, float3(MAX_BURST, MAX_BURST, MAX_BURST));

    // Filmic Tonemapping prefitted curve from John Hable, including linear to sRGB (gamma)
    // http://filmicworlds.com/blog/filmic-tonemapping-operators/
    const float3 x = max(float3(0., 0., 0.), color - 0.004); // Filmic Curve
    color = (x * (6.2 * x + .5)) / (x * (6.2 * x + 1.7) + 0.06);

    // Filmic ACES fitted curve by Krzysztof Narkowicz (luminance only causing slightly oversaturate brights). Linear RGB to Linear RGB, with exposure included (1.0 -> 0.8).
    // https://knarkowicz.wordpress.com/2016/01/06/aces-filmic-tone-mapping-curve/
    /*color = 0.6 * color; // remove the included exposure using the value given in the blog post
    const float a = 2.51;
    const float b = 0.03;
    const float c = 2.43;
    const float d = 0.59;
    const float e = 0.14;
    color = (color*(a*color+b))/(color*(c*color+d)+e);
    color = FBGamma(color); */

    // Filmic ACES fitted curve by Stephen Hill. sRGB to sRGB (as stated in the code, still get surprising results, would need more tests)
    // https://github.com/TheRealMJP/BakingLab/blob/master/BakingLab/ACES.hlsl
    /*color = FBGamma(color);
    color = ACESFitted(color);*/

    // Filmic ACES fitted curve by Jim Hejl 
    // https://twitter.com/jimhejl/status/633777619998130176
    /*const float4 vh = float4(color, 11.2); // 11.2 is whitepoint
    const float4 va = 1.425*vh + 0.05;
    const float4 vf = (vh*va + 0.004)/(vh*(va+0.55) + 0.0491) - 0.0821;
    color = vf.rgb/vf.aaa;
    color = FBGamma(color); */

    return color;
}

float3 PBRNeutralToneMapping(float3 color)
{
    const float startCompression = 0.8 - 0.04;
    const float desaturation = 0.15;

    color *= exposure;

    float x = min(color.x, min(color.y, color.z));
    float offset = x < 0.08 ? x - 6.25 * (x * x) : 0.04;
    color -= offset;

    const float peak = max(color.x, max(color.y, color.z));
    if (peak < startCompression) return color;

    const float d = 1. - startCompression;
    const float newPeak = 1. - (d * d) / (peak + (d - startCompression));

    const float inv_g = desaturation * (peak - newPeak) + 1.;
    const float w = newPeak / (inv_g*peak);
    const float n = newPeak - newPeak/inv_g;
    return n + color*w;
}


// AgX derived from the following references:
// - Blog post: https://iolite-engine.com/blog_posts/minimal_agx_implementation
// - Godot: https://github.com/godotengine/godot/pull/87260
// - ThreeJS: https://github.com/mrdoob/three.js/blob/master/src/renderers/shaders/ShaderChunk/tonemapping_pars_fragment.glsl.js
// - Filament: https://github.com/google/filament/blob/main/filament/src/ToneMapper.cpp
// All of these trying to match Blender's implementation and reference OCIO profile.
// TODO Add black/white point definition support when adding HDR output support
// TODO Add 'punchy' look transform (less desaturated)

// https://iolite-engine.com/blog_posts/minimal_agx_implementation
float3 agxDefaultContrastApprox(float3 x)
{
    #if 1
    // 6th order polynomial approximation (used in three.js and Godot)
    // Mean error^2: 3.6705141e-06
    float3 x2 = x * x;
    float3 x4 = x2 * x2;
    return  + 15.5 * x4 * x2
            - 40.14 * x4 * x
            + 31.96 * x4
            - 6.868 * x2 * x
            + 0.4298 * x2
            + 0.1191 * x
            - 0.00232;
    #else
    // 7th order polynomial approximation (used in Filament)
    float3 x2 = x * x;
    float3 x4 = x2 * x2;
    float3 x6 = x4 * x2;
    return  - 17.86 * x6 * x
            + 78.01 * x6
            - 126.7 * x4 * x
            + 92.06 * x4
            - 28.72 * x2 * x
            + 4.361 * x2
            - 0.1718 * x
            + 0.002857;
    #endif
}

// AgX Tone Mapping implementation
// Input is expected in 'linear sRGB' (direct output of VPX rendering), output is in sRGB (non linear)
float3 AgXToneMapping(float3 color)
{
    #if 0
    // AgX transform constants taken from Blender https://github.com/EaryChow/AgX_LUT_Gen/blob/main/AgXBaseRec2020.py
    // These operates on rec2020 value, therefore they require additional colorspace conversions
    // (for AgXOutsetMatrix, the inverse is precomputed. Note that input and output matrices are not mutual inverses)
    const float3x3 AgXInsetMatrix =
    MAT3_BEGIN
        MAT_ROW3_BEGIN 0.8566271533159830, 0.137318972929847, 0.1118982129999500 MAT_ROW_END,
        MAT_ROW3_BEGIN 0.0951212405381588, 0.761241990602591, 0.0767994186031903 MAT_ROW_END,
        MAT_ROW3_BEGIN 0.0482516061458583, 0.101439036467562, 0.8113023683968590 MAT_ROW_END
    MAT_END;
    const float3x3 AgXOutsetMatrix =
    MAT3_BEGIN
        MAT_ROW3_BEGIN  1.127100581814436800, -0.141329763498438300, -0.14132976349843826 MAT_ROW_END,
        MAT_ROW3_BEGIN -0.110606643096603230,  1.157823702216272000, -0.11060664309660294 MAT_ROW_END,
        MAT_ROW3_BEGIN -0.016493938717834573, -0.016493938717834257,  1.25193640659504050 MAT_ROW_END
    MAT_END;
    // Matrices for rec 2020 <> rec 709 color space conversion
    // matrix provided in row-major order so it has been transposed
    // https://www.itu.int/pub/R-REP-BT.2407-2017
    const float3x3 LINEAR_REC2020_TO_LINEAR_SRGB =
    MAT3_BEGIN
        MAT_ROW3_BEGIN 1.6605, -0.1246, -0.0182 MAT_ROW_END,
        MAT_ROW3_BEGIN -0.5876, 1.1329, -0.1006 MAT_ROW_END,
        MAT_ROW3_BEGIN -0.0728, -0.0083, 1.1187 MAT_ROW_END
    MAT_END;
    const float3x3 LINEAR_SRGB_TO_LINEAR_REC2020 =
    MAT3_BEGIN
        MAT_ROW3_BEGIN 0.6274, 0.0691, 0.0164 MAT_ROW_END,
        MAT_ROW3_BEGIN 0.3293, 0.9195, 0.0880 MAT_ROW_END,
        MAT_ROW3_BEGIN 0.0433, 0.0113, 0.8956 MAT_ROW_END
    MAT_END;

    #else

    // AgX transformation constants taken from https://iolite-engine.com/blog_posts/minimal_agx_implementation (also used in Godot)
    // It is assumed that they are ok for rec709 input values.
    // (note that out transform is the inverse of in transform)
    const float3x3 AgXInsetMatrix =
    MAT3_BEGIN
        MAT_ROW3_BEGIN  0.8424790622530940,  0.0423282422610123,  0.0423756549057051 MAT_ROW_END,
        MAT_ROW3_BEGIN  0.0784335999999992,  0.8784686364697720,  0.0784336000000000 MAT_ROW_END,
        MAT_ROW3_BEGIN  0.0792237451477643,  0.0791661274605434,  0.8791429737931040 MAT_ROW_END
    MAT_END;
    const float3x3 AgXOutsetMatrix =
    MAT3_BEGIN
        MAT_ROW3_BEGIN  1.1968790051201700, -0.0528968517574562, -0.0529716355144438 MAT_ROW_END,
        MAT_ROW3_BEGIN -0.0980208811401368,  1.1519031299041700, -0.0980434501171241 MAT_ROW_END,
        MAT_ROW3_BEGIN -0.0990297440797205, -0.0989611768448433,  1.1510736726411600 MAT_ROW_END
    MAT_END;
    #endif

    // LOG2_MIN      = -10.0
    // LOG2_MAX      =  +6.5
    // MIDDLE_GRAY   =  0.18
    const float AgxMinEv = -12.47393; // log2( pow( 2, LOG2_MIN ) * MIDDLE_GRAY )
    const float AgxMaxEv =  4.026069; // log2( pow( 2, LOG2_MAX ) * MIDDLE_GRAY )

    color *= exposure;

    #if 0
    color = mul(color, LINEAR_SRGB_TO_LINEAR_REC2020); // linear sRGB (rec709) to linear rec2020 expected by Blender/threeejs matrices
    #endif

    color = mul(color, AgXInsetMatrix);

    // Log2 encoding
    color = max(color, FLT_MIN_VALUE); // avoid 0 or negative numbers for log2
    color = log2(color);
    color = (color - AgxMinEv) / (AgxMaxEv - AgxMinEv);

    color = clamp(color, 0.0, 1.0);

    // Apply sigmoid
    color = agxDefaultContrastApprox(color);

    // TODO Apply AgX look
    // v = agxLook(v, look);

    color = mul(color, AgXOutsetMatrix);

    #if 0
    color = pow(max(float3(0.0, 0.0, 0.0), color), float3(2.2, 2.2, 2.2)); // rec2020 to linear rec2020
    color = mul(color, LINEAR_REC2020_TO_LINEAR_SRGB);                     // linear rec2020 to linear rec709 (sRGB)
    color = FBGamma(color);                                                // linear sRGB to sRGB
    #endif

    return color;
}

in float2 tex0;
flat in float eye;

out vec4 color;
#ifdef SHADER_GL410
flat in int glLayer_gs;
#endif

/*const float bayer_dither_pattern[8][8] = float[][] (
    {( 0/64.0-0.5)/255.0, (32/64.0-0.5)/255.0, ( 8/64.0-0.5)/255.0, (40/64.0-0.5)/255.0, ( 2/64.0-0.5)/255.0, (34/64.0-0.5)/255.0, (10/64.0-0.5)/255.0, (42/64.0-0.5)/255.0},   
    {(48/64.0-0.5)/255.0, (16/64.0-0.5)/255.0, (56/64.0-0.5)/255.0, (24/64.0-0.5)/255.0, (50/64.0-0.5)/255.0, (18/64.0-0.5)/255.0, (58/64.0-0.5)/255.0, (26/64.0-0.5)/255.0},   
    {(12/64.0-0.5)/255.0, (44/64.0-0.5)/255.0, ( 4/64.0-0.5)/255.0, (36/64.0-0.5)/255.0, (14/64.0-0.5)/255.0, (46/64.0-0.5)/255.0, ( 6/64.0-0.5)/255.0, (38/64.0-0.5)/255.0},   
    {(60/64.0-0.5)/255.0, (28/64.0-0.5)/255.0, (52/64.0-0.5)/255.0, (20/64.0-0.5)/255.0, (62/64.0-0.5)/255.0, (30/64.0-0.5)/255.0, (54/64.0-0.5)/255.0, (22/64.0-0.5)/255.0},   
    {( 3/64.0-0.5)/255.0, (35/64.0-0.5)/255.0, (11/64.0-0.5)/255.0, (43/64.0-0.5)/255.0, ( 1/64.0-0.5)/255.0, (33/64.0-0.5)/255.0, ( 9/64.0-0.5)/255.0, (41/64.0-0.5)/255.0},   
    {(51/64.0-0.5)/255.0, (19/64.0-0.5)/255.0, (59/64.0-0.5)/255.0, (27/64.0-0.5)/255.0, (49/64.0-0.5)/255.0, (17/64.0-0.5)/255.0, (57/64.0-0.5)/255.0, (25/64.0-0.5)/255.0},
    {(15/64.0-0.5)/255.0, (47/64.0-0.5)/255.0, ( 7/64.0-0.5)/255.0, (39/64.0-0.5)/255.0, (13/64.0-0.5)/255.0, (45/64.0-0.5)/255.0, ( 5/64.0-0.5)/255.0, (37/64.0-0.5)/255.0},
    {(63/64.0-0.5)/255.0, (31/64.0-0.5)/255.0, (55/64.0-0.5)/255.0, (23/64.0-0.5)/255.0, (61/64.0-0.5)/255.0, (29/64.0-0.5)/255.0, (53/64.0-0.5)/255.0, (21/64.0-0.5)/255.0} );
*/

/*float triangularPDF(const float r) // from -1..1, c=0 (with random no r=0..1)
{
   float p = 2.*r;
   const bool b = (p > 1.);
   if (b)
      p = 2.-p;
   p = 1.-sqrt(p);
   return b ? p : -p;
}
float3 triangularPDF(const float3 r) // from -1..1, c=0 (with random no r=0..1)
{
   return float3(triangularPDF(r.x), triangularPDF(r.y), triangularPDF(r.z));
}*/

/*float DitherGradientNoise(const float2 tex0)
{
   // Interleaved Gradient Noise from "NEXT GENERATION POST PROCESSING IN CALL OF DUTY: ADVANCED WARFARE" http://advances.realtimerendering.com/s2014/index.html
   const float3 magic = float3(0.06711056, 0.00583715, 52.9829189);

   return frac(magic.z * frac(dot(tex0, magic.xy)));
}

float Dither64(const float2 tex0, const float time)
{
   const float3 k0 = float3(33., 52., 25.);

   return frac(dot(float3(tex0, time), k0 * (1.0/64.0)));
}*/

float3 blue_gauss_noise(const float2 c1, const float3 rgb)
{
   // https://www.shadertoy.com/view/XljyRR
   //float2 c0 = float2(c1.x - 1., c1.y);
   //float2 c2 = float2(c1.x + 1., c1.y);
   const float3 cx = float3(c1.x - 1., c1.x, c1.x + 1.);
   const float4 f0 = frac(float4(cx * 9.1031, c1.y * 8.1030));
   const float4 f1 = frac(float4(cx * 7.0973, c1.y * 6.0970));
   const float4 t0 = float4(f0.xw,f1.xw); //frac(c0.xyxy * float4(.1031,.1030,.0973,.0970));
   const float4 t1 = float4(f0.yw,f1.yw); //frac(c1.xyxy * float4(.1031,.1030,.0973,.0970));
   const float4 t2 = float4(f0.zw,f1.zw); //frac(c2.xyxy * float4(.1031,.1030,.0973,.0970));
   const float4 p0 = t0 + dot(t0, t0.wzxy + 19.19);
   const float4 p1 = t1 + dot(t1, t1.wzxy + 19.19);
   const float4 p2 = t2 + dot(t2, t2.wzxy + 19.19);
   const float4 n0 = frac(p0.zywx * (p0.xxyz + p0.yzzw));
   const float4 n1 = frac(p1.zywx * (p1.xxyz + p1.yzzw));
   const float4 n2 = frac(p2.zywx * (p2.xxyz + p2.yzzw));
   const float4 r4 = 0.5*n1 - 0.125*(n0 + n2);
   const float  r  = r4.x+r4.y+r4.z+r4.w - 0.5;

   const float quantSteps = 256.0; //!! how to choose/select this for 5/6/5bit??
   return rgb + float3(r,-r,r) * (1.0/(quantSteps - 1.0));
}

#if 0
// seems like everybody uses this, but the amount of flickering patterns generated is very noticeable
float3 DitherVlachos(const float2 tex0, const float3 rgb)
{
   // Vlachos 2016, "Advanced VR Rendering", but using a TPDF
   const float quantSteps = 256.0; //!! how to choose/select this for 5/6/5bit??

   const float noise = dot(float2(171.0, 231.0), tex0);
   const float3 noise3 = frac(noise * (1.0 / float3(103.0, 71.0, 97.0)));

   return rgb + triangularPDF(noise3)/*(noise3*2.0-1.0)*/ * (1.0/(quantSteps - 1.0));
}
#endif

float3 FBDither(const float3 color, /*const int2 pos*/const float2 tex0)
{
   BRANCH if (!do_dither)
       return color;

   //return color + bayer_dither_pattern[pos.x%8][pos.y%8];

#ifndef BLUE_NOISE_DITHER
   //return DitherVlachos(floor(tex0*(1.0/w_h_height.xy)+0.5) + w_h_height.z/*w*/, color);       // note that w_h_height.w is the same nowadays
   return blue_gauss_noise(floor(tex0*(1.0/w_h_height.xy)+0.5) + 0.07*w_h_height.z/*w*/, color); // dto.
#else // needs tex_ao_dither
   const float quantSteps = 256.0; //!! how to choose/select this for 5/6/5bit??

   // TPDF:
   const float3 dither = /*float3(GradientNoise(tex0 / w_h_height.xy + w_h_height.zw*3.141),
      GradientNoise(tex0.yx / w_h_height.yx + w_h_height.zw*1.618),
      GradientNoise(tex0 / w_h_height.xy + w_h_height.wz*2.718281828459));*/
   // Dither64(tex0 / w_h_height.xy+w_h_height.zw, 0.);
       texNoLod(tex_ao_dither, tex0 / (64.0*w_h_height.xy) + w_h_height.zw*3.141).xyz;
   return color + triangularPDF(dither) * (1.0/quantSteps); // quantSteps-1. ?

   /*const float3 dither = texNoLod(tex_ao_dither, tex0 / (64.0*w_h_height.xy) + w_h_height.zw*2.718281828459).xyz;
   const float3 dither2 = texNoLod(tex_ao_dither, tex0 / (64.0*w_h_height.xy) + w_h_height.wz*3.14159265358979).xyz;
   return color + (dither - dither2) / quantSteps;*/

   //const float3 dither = texNoLod(tex_ao_dither, tex0 / (64.0*w_h_height.xy) + w_h_height.wz*3.141).xyz*2.0 - 1.0;

   // Lottes (1st one not working, 2nd 'quality', 3rd 'tradeoff'), IMHO too much magic:
   /*const float blackLimit = 0.5 * InvGamma(1.0/(quantSteps - 1.0));
   const float amount = 0.75 * (InvGamma(1.0/(quantSteps - 1.0)) - 1.0);
   return color + dither*min(color + blackLimit, amount);*/

   //const float3 amount = InvGamma(FBGamma(color) + (4. / quantSteps)) - color;
   
   //const float luma = saturate(dot(color,float3(0.212655,0.715158,0.072187)));
   //const float3 amount = lerp(
   //  InvGamma(4. / quantSteps), //!! precalc? would also solve 5/6/5bit issue!
   //  InvGamma((4. / quantSteps)+1.)-1.,
   //  luma);

   //return color + dither*amount;

   // RPDF:
   //return color + dither/quantSteps; // use dither texture instead nowadays // 64 is the hardcoded dither texture size for AOdither.bmp
#endif
}

float2 FBDither(const float2 color, /*const int2 pos*/const float2 tex0)
{
   return color; // on RG-only rendering do not dither anything for performance
}

float FBDither(const float color, /*const int2 pos*/const float2 tex0)
{
   return color; // on R-only rendering do not dither anything for performance
}

//

float3 FBColorGrade(float3 color)
{
   BRANCH if (!color_grade)
       return color;

   color.xy = color.xy*(15.0/16.0) + 1.0/32.0; // assumes 16x16x16 resolution flattened to 256x16 texture
   color.z *= 15.0;

   const float x = (color.x + floor(color.z))/16.0;
   const float3 lut1 = texNoLod(tex_color_lut, float2(x,          color.y)).xyz; // two lookups to blend/lerp between blue 2D regions
   const float3 lut2 = texNoLod(tex_color_lut, float2(x+1.0/16.0, color.y)).xyz;
   return lerp(lut1,lut2, frac(color.z));
}

// license:GPLv3+

//!! add reflection direction occlusion, so that that will be used for blocking reflection/envmap?
//!! opt.?


#if 0
float2 hash(const float2 gridcell)
{
	/*const float3 o = float3(26.0, 161.0, 26.0);
	const float d = 71.0;
	const float lf = 1.0/951.135664;
	float3 P = float3(gridcell.x,gridcell.y,gridcell.x+1.0); // gridcell is assumed to be an integer coordinate (scaled by width&height basically)
	P = P - floor(P * ( 1.0 / d )) * d;
	P += o;
	P *= P;
	return frac( P.xz * P.yy * lf );*/

	return frac(float2(sin(dot(gridcell, float2(12.9898, 78.233) * 2.0)),
	                   sin(dot(gridcell, float2(12.9898, 78.233)      ))) * 43758.5453);
}
#endif

float3 get_nonunit_normal(const float depth0, const float2 u, const float eye) // use neighboring pixels // quite some tex access by this
{
	const float depth1 = texStereoNoLod(tex_depth, float2(u.x, u.y - w_h_height.y)).x;
	const float depth2 = texStereoNoLod(tex_depth, float2(u.x + w_h_height.x, u.y)).x;
	return float3(w_h_height.y * (depth2 - depth0), (depth1 - depth0) * w_h_height.x, w_h_height.y * w_h_height.x); //!!

	// better quality, maybe worth it for SSR path
	/*const float depth1a = texStereoNoLod(tex_depth, float2(u.x, u.y+w_h_height.y)).x;
	const float depth2a = texStereoNoLod(tex_depth, float2(u.x+w_h_height.x, u.y)).x;
	const float depth1b = texStereoNoLod(tex_depth, float2(u.x, u.y-w_h_height.y)).x;
	const float depth2b = texStereoNoLod(tex_depth, float2(u.x-w_h_height.x, u.y)).x;
	const float x1a = depth1a - depth0;
	const float x1b = depth0 - depth1b;
	const float x2a = depth2a - depth0;
	const float x2b = depth0 - depth2b;
	return float3(w_h_height.y * (abs(x2a) < abs(x2b) ? x2a : x2b), (abs(x1a) < abs(x1b) ? x1a : x1b) * w_h_height.x, w_h_height.y * w_h_height.x);*/
}

//float3 sphere_sample(const float2 t)
//{
//const float phi = t.y * (2.0*3.1415926535897932384626433832795);
//const float z = 1.0 - t.x*2.0;
//const float r = sqrt(1.0 - z*z);
//float sp,cp;
//sincos(phi,sp,cp);
//return float3(cp*r, z, sp*r);
//}

float3 cos_hemisphere_sample(const float2 t) // u,v in [0..1), returns y-up
{
	const float phi = t.y * (2.0*3.1415926535897932384626433832795);
	const float cosTheta = sqrt(1.0 - t.x);
	const float sinTheta = sqrt(t.x);
	float sp,cp;
	sincos(phi,sp,cp);
	return float3(cp * sinTheta, cosTheta, sp * sinTheta);
}

float3 rotate_to_vector_upper(const float3 vec, const float3 normal)
{
	if(normal.y > -0.99999)
	{
		const float h = 1.0/(1.0+normal.y);
		const float hz = h*normal.z;
		const float hzx = hz*normal.x;
		return float3(
			vec.x * (normal.y+hz*normal.z) + vec.y * normal.x - vec.z * hzx,
			vec.y * normal.y - vec.x * normal.x - vec.z * normal.z,
			vec.y * normal.z - vec.x * hzx + vec.z * (normal.y+h*normal.x*normal.x));
	}
	else return -vec;
}

/*float3 cos_hemisphere_sample(const float3 normal, float2 uv)
{
	const float theta = (2.0*3.1415926535897932384626433832795) * uv.x;
	uv.y = 2.0 * uv.y - 1.0;
	float st,ct;
	sincos(theta,st,ct);
	const float3 spherePoint = float3(sqrt(1.0 - uv.y * uv.y) * float2(ct, st), uv.y);
	return normalize(normal + spherePoint);
}*/

/*float3 cos_hemisphere_nonunit_sample(const float3 normal, float2 uv)
{
	const float theta = (2.0*3.1415926535897932384626433832795) * uv.x;
	uv.y = 2.0 * uv.y - 1.0;
	float st,ct;
	sincos(theta,st,ct);
	const float3 spherePoint = float3(sqrt(1.0 - uv.y * uv.y) * float2(ct, st), uv.y);
	return normal + spherePoint;
}*/

/*float4 ps_main_normals(const in VS_OUTPUT_2D IN) : COLOR // separate pass to generate normals (should actually reduce bandwidth needed in AO pass, but overall close to no performance difference or even much worse perf, depending on gfxboard)
{
	const float2 u = IN.tex0;

	const float depth0 = texStereoNoLod(tex_depth, u).x;
	BRANCH if((depth0 == 1.0) || (depth0 == 0.0)) //!! early out if depth too large (=BG) or too small (=DMD,etc -> retweak render options (depth write on), otherwise also screwup with stereo)
		return float4(0.0, 0.,0.,0.);

	const float3 normal = normalize(get_nonunit_normal(depth0, u, eye)) *0.5+0.5;
	return float4(normal,0.);
}*/

#if 0
float2 UnitVectorToOctahedron( float3 N )
{
	N.xy /= dot( 1., abs(N) );
	if( N.z <= 0. )
		N.xy = ( 1. - abs(N.yx) ) * ( N.xy >= 0. ? float2(1.,1.) : float2(-1.,-1.) );
	return N.xy;
}

float3 OctahedronToUnitVector( const float2 Oct )
{
	float3 N = float3( Oct, 1. - dot( 1., abs(Oct) ) );
	if( N.z < 0. )
		N.xy = ( 1. - abs(N.yx) ) * ( N.xy >= 0. ? float2(1.,1.) : float2(-1.,-1.) );
	return normalize(N);
}

/*
// Pack into hemisphere octahedron
// Assume normalized input on +Z hemisphere. Output [-1, 1].
void EncodeHemiOctaNormal( const float3 v, inout float2 encV )
{
	// Project the hemisphere onto the hemi-octahedron, and then into the xy plane
	const float rcp_denom = 1.0 / ( abs( v[0] ) + abs( v[1] ) + v[2] );
	const float tx = v[0] * rcp_denom;
	const float ty = v[1] * rcp_denom;
	encV[0] = tx + ty;
	encV[1] = tx - ty;
} 

void DecodeHemiOctaNormal( const float2 encV, inout float3 v ) 
{
	//	Rotate and scale the unit square back to the center diamond
	v[0] = ( encV[0] + encV[1] ) * 0.5;
	v[1] = ( encV[0] - encV[1] ) * 0.5;
	v[2] = 1.0 - abs( v[0] ) - abs( v[1] );
}
*/

float3 Pack1212To888( const float2 x )
{
	// Pack 12:12 to 8:8:8
	const float2 x1212 = floor( x * 4095. );
	const float2 High = floor( x1212 / 256. );	// x1212 >> 8
	const float2 Low = x1212 - High * 256.;	// x1212 & 255
	const float3 x888 = float3( Low, High.x + High.y * 16. );
	return saturate( x888 / 255. );
}

float2 Pack888To1212( const float3 x )
{
	// Pack 8:8:8 to 12:12
	const float3 x888 = floor( x * 255. );
	const float High = floor( x888.z / 16. );	// x888.z >> 4
	const float Low = x888.z - High * 16.;		// x888.z & 15
	const float2 x1212 = x888.xy + float2( Low, High ) * 256.;
	return saturate( x1212 / 4095. );
}

float3 EncodeNormal( const float3 N )
{
	return Pack1212To888( UnitVectorToOctahedron( N ) * 0.5 + 0.5 );
}

float3 DecodeNormal( const float3 N )
{
	return OctahedronToUnitVector( Pack888To1212( N ) * 2. - 1. );
}
float2 compress_normal(const float3 n)
{
    const float p = sqrt(n.z*8.+8.);
    return n.xy/p + 0.5;
}

float3 decompress_normal(const float2 c)
{
    const float2 fc = c*4.-2.;
    const float f = dot(fc,fc);
    return float3(fc*sqrt(1.-f*0.25), 1.-f*0.5);
}
#endif


float3 sampleOffset(const float2 u, const float2 pixelOffset, const float eye)
{
   return texStereoNoLod(tex_fb_filtered, u + pixelOffset * w_h_height.xy).xyz;
}

float4 sampleOffseta(const float2 u, const float2 pixelOffset, const float eye)
{
   return texStereoNoLod(tex_fb_filtered, u + pixelOffset * w_h_height.xy);
}

float avg(const float3 l)
{
   //return dot(l, float3(0.25,0.5,0.25)); // experimental, red and blue should not suffer too much
   return (l.x+l.y+l.z) * (1.0 / 3.0);
}


// FXAA

float luma(const float3 l)
{
    return dot(l, float3(0.25,0.5,0.25)); // experimental, red and blue should not suffer too much
    //return 0.299*l.x + 0.587*l.y + 0.114*l.z;
    //return 0.2126*l.x + 0.7152*l.y + 0.0722*l.z; // photometric
    //return sqrt(0.299 * l.x*l.x + 0.587 * l.y*l.y + 0.114 * l.z*l.z); // hsp
}


// license:GPLv3+



//-----------------------------------------------------------------------------
// Vertex shaders
//-----------------------------------------------------------------------------


//fb_rhtonemap_AO_no_filter:P0:vs_main_no_trafo():gs_main():ps_main_fb_rhtonemap_AO_no_filter()
//ps_main_fb_rhtonemap_AO_no_filter()

void main()
{
   FS_LAYER_TO_GLOBAL;
   float3 result = texStereoNoLod(tex_fb_unfiltered, tex0).rgb;
   // moving AO before tonemap does not really change the look
   result *= texStereoNoLod(tex_ao, tex0 - 0.5*w_h_height.xy).x; // shift half a texel to blurs over 2x2 window
   BRANCH if (do_bloom)
      result += texStereoNoLod(tex_bloom, tex0).rgb; //!! offset?
   const float depth0 = texStereoNoLod(tex_depth, tex0).x;
   BRANCH if ((depth0 != 1.0) && (depth0 != 0.0)) //!! early out if depth too large (=BG) or too small (=DMD)
      result = ReinhardToneMap(result);
   color = float4(FBColorGrade(FBGamma(saturate(FBDither(result, tex0)))), 1.0);
}

