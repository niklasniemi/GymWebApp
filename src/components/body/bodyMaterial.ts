import { BackSide, Color, FrontSide, ShaderMaterial, Vector3 } from 'three';
import { HEAT_LEGEND } from '../../lib/muscles';

/*
 * "Clinical hologram" body shading:
 *  - translucent cool-grey body with a fresnel rim in the app's accent blue
 *  - trained muscles glow through the warm heat ramp (more heat = more opaque)
 *  - a faint back-face pass gives an x-ray hint of the far side
 * Lighting is fixed in view space, so the light stays put as the body turns.
 */

const vertexShader = /* glsl */ `
  attribute float heat;
  attribute float muscle;
  varying vec3 vNormal;
  varying vec3 vViewPos;
  varying float vHeat;
  varying float vMuscle;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vViewPos = mv.xyz;
    vNormal = normalize(normalMatrix * normal);
    vHeat = heat;
    vMuscle = muscle;
    gl_Position = projectionMatrix * mv;
  }
`;

const fragmentShader = /* glsl */ `
  uniform vec3 uNeutral;
  uniform vec3 uRim;
  uniform vec3 uStop0;
  uniform vec3 uStop1;
  uniform vec3 uStop2;
  uniform vec3 uStop3;
  uniform float uOpacity;
  uniform float uSelected;
  uniform vec3 uLightDir;
  varying vec3 vNormal;
  varying vec3 vViewPos;
  varying float vHeat;
  varying float vMuscle;

  vec3 ramp(float h) {
    if (h < 0.35) return mix(uStop0, uStop1, smoothstep(0.02, 0.35, h));
    if (h < 0.7) return mix(uStop1, uStop2, (h - 0.35) / 0.35);
    return mix(uStop2, uStop3, (h - 0.7) / 0.3);
  }

  void main() {
    vec3 n = normalize(vNormal);
    vec3 v = normalize(-vViewPos);
    #ifdef BACKFACE
      n = -n;
    #endif
    float ndv = clamp(dot(n, v), 0.0, 1.0);
    float fres = pow(1.0 - ndv, 2.2);

    #ifdef BACKFACE
      gl_FragColor = vec4(uRim, 0.05 + fres * 0.08);
    #else
      float h = clamp(vHeat, 0.0, 1.0);
      float heatMask = smoothstep(0.0, 0.08, h);
      float lit = 0.62 + 0.38 * max(dot(n, uLightDir), 0.0);
      vec3 base = mix(uNeutral, ramp(h), heatMask);
      float sel = 1.0 - step(0.5, abs(vMuscle - uSelected));
      vec3 col = base * lit + uRim * fres * (0.85 - heatMask * 0.45) + vec3(0.22) * sel;
      float alpha = uOpacity + heatMask * 0.38 + fres * 0.42 + sel * 0.2;
      gl_FragColor = vec4(col, clamp(alpha, 0.0, 1.0));
    #endif
    #include <colorspace_fragment>
  }
`;

export interface BodyTheme {
  neutral: string;
  rim: string;
  opacity: number;
}

export const BODY_THEME: Record<'light' | 'dark', BodyTheme> = {
  light: { neutral: '#8ea5c3', rim: '#2a78d6', opacity: 0.32 },
  dark: { neutral: '#6d8cba', rim: '#6da7ec', opacity: 0.3 },
};

export function createBodyMaterials() {
  const uniforms = {
    uNeutral: { value: new Color() },
    uRim: { value: new Color() },
    uStop0: { value: new Color(HEAT_LEGEND[0]) },
    uStop1: { value: new Color(HEAT_LEGEND[1]) },
    uStop2: { value: new Color(HEAT_LEGEND[2]) },
    uStop3: { value: new Color(HEAT_LEGEND[3]) },
    uOpacity: { value: 0.4 },
    uSelected: { value: -1 },
    uLightDir: { value: new Vector3(0.45, 0.55, 0.7).normalize() },
  };
  const front = new ShaderMaterial({
    uniforms,
    vertexShader,
    fragmentShader,
    transparent: true,
    depthWrite: true,
    side: FrontSide,
  });
  const back = new ShaderMaterial({
    uniforms,
    vertexShader,
    fragmentShader,
    defines: { BACKFACE: 1 },
    transparent: true,
    depthWrite: false,
    side: BackSide,
  });

  const setTheme = (theme: BodyTheme) => {
    uniforms.uNeutral.value.set(theme.neutral);
    uniforms.uRim.value.set(theme.rim);
    uniforms.uOpacity.value = theme.opacity;
  };
  const setSelected = (muscleId: number) => {
    uniforms.uSelected.value = muscleId;
  };

  return { front, back, setTheme, setSelected, dispose: () => (front.dispose(), back.dispose()) };
}
