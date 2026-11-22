// SPDX-License-Identifier: GPL-3.0-or-later
// ShaderState::SetFloat/SetMatrix/SetUniformBlock, Visual Pinball
// 195f214dd4849b8ef6113fd377258b78d0dec3bf, renderer/Shader.h.
// The native GLES renderer enables m_useLowPrecision and expands tiny nonzero
// values before upload. Do this after CPU matrix products, not during them.
export const NATIVE_SHADER_MIN=0.00006103515625;
export function nativeShaderFloat(value){const f=Math.fround(value);return f>0&&f<NATIVE_SHADER_MIN?NATIVE_SHADER_MIN:f<0&&f>-NATIVE_SHADER_MIN?-NATIVE_SHADER_MIN:f;}
export const nativeShaderArray=values=>Float32Array.from(values,nativeShaderFloat);
