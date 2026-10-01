// A real volume: integrate turbulent flame density through depth, rather than
// rendering an opaque model. Shared offscreen buffer keeps GPU resources bounded.
let buffer;
let unavailable = false;
const vertex = `attribute vec2 position; varying vec2 uv;
void main(){uv=position*.5+.5;gl_Position=vec4(position,0.,1.);}`;
const fragment = `precision highp float;
varying vec2 uv; uniform float time; uniform vec2 wind; uniform float seed;
float hash(vec3 p){p=fract(p*.3183099+vec3(.17,.31,.53));p*=17.;return fract(p.x*p.y*p.z*(p.x+p.y+p.z));}
float noise(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
 return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);}
float fbm(vec3 p){return noise(p)*.57+noise(p*2.03+vec3(3.1))* .28+noise(p*4.11+vec3(7.3))*.15;}
void main(){
 vec2 screen=vec2((uv.x-.5)*2.8,uv.y*3.2-.25);
 vec3 color=vec3(0.);float alpha=0.;
 for(int i=0;i<44;i++){
  float z=-.8+float(i)*.0364;
  float y=screen.y;
  vec3 p=vec3(screen.x-wind.x*max(y,0.)*.47,y,z);
  p.x+=sin(y*3.7-time*2.8+seed)*.07*y;
  p.y*=1.-wind.y*.18;
  float h=clamp(p.y/2.8,0.,1.);
  float radius=.60*(1.-h)+.065;
  vec3 flow=vec3(p.x*3.2,p.y*2.5-time*2.6,p.z*3.2+seed);
  float turbulence=fbm(flow);
  float shape=1.-length(p.xz)/radius;
  float density=max(0.,shape+(turbulence-.5)*1.9-.23);
  density*=smoothstep(-.12,.16,p.y)*(1.-smoothstep(1.7,2.8,p.y));
  // The luminous base feeds ascending, curling pockets of hot gas.
  float heat=clamp(density*1.25+(1.-h)*.16,0.,1.);
  vec3 emission=mix(vec3(1.,.085,.008),vec3(1.,.49,.035),smoothstep(.04,.46,heat));
  emission=mix(emission,vec3(1.,.91,.5),smoothstep(.42,.85,heat));
  emission=mix(emission,vec3(1.,.99,.88),smoothstep(.9,1.,heat));
  float a=1.-exp(-density*.27);
  color+=(1.-alpha)*emission*a;alpha+=(1.-alpha)*a;
 }
 gl_FragColor=vec4(color,alpha);
}`;

function init() {
  const canvas = document.createElement('canvas'); canvas.width = 240; canvas.height = 320;
  const gl = canvas.getContext('webgl', { alpha: true, premultipliedAlpha: true, antialias: false, depth: false, stencil: false });
  if (!gl) return null;
  const shader = (type, source) => {
    const value = gl.createShader(type); gl.shaderSource(value, source); gl.compileShader(value);
    if (!gl.getShaderParameter(value, gl.COMPILE_STATUS)) { gl.deleteShader(value); return null; }
    return value;
  };
  const vs = shader(gl.VERTEX_SHADER, vertex), fs = shader(gl.FRAGMENT_SHADER, fragment);
  if (!vs || !fs) return null;
  const program = gl.createProgram(); gl.attachShader(program, vs); gl.attachShader(program, fs); gl.linkProgram(program);
  gl.deleteShader(vs); gl.deleteShader(fs);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return null;
  gl.useProgram(program);
  const vertices = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, vertices);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
  const position = gl.getAttribLocation(program, 'position'); gl.enableVertexAttribArray(position); gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
  const uniforms = Object.fromEntries(['time', 'wind', 'seed'].map(name => [name, gl.getUniformLocation(program, name)]));
  canvas.addEventListener('webglcontextlost', event => { event.preventDefault(); unavailable = true; });
  canvas.addEventListener('webglcontextrestored', () => { buffer = null; unavailable = false; });
  return { canvas, gl, uniforms };
}

export function renderFireVolume(time, motion, seed) {
  if (unavailable) return null;
  buffer ||= init();
  if (!buffer) { unavailable = true; return null; }
  const { gl, canvas, uniforms } = buffer;
  if (gl.isContextLost()) return null;
  gl.uniform1f(uniforms.time, time); gl.uniform1f(uniforms.seed, seed);
  gl.uniform2f(uniforms.wind, Math.max(-1.3, Math.min(1.3, -motion.x / 850)), Math.max(-.35, Math.min(.45, motion.y / 1200)));
  gl.drawArrays(gl.TRIANGLES, 0, 6);
  return canvas;
}
