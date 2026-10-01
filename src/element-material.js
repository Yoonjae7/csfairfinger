// One shared GPU buffer for both hands. Fire is integrated through a turbulent
// volume; water refracts the actual camera image across a moving liquid surface.
let renderer;
let status = 'uninitialized';
const vertex = `attribute vec2 position; varying vec2 uv;
void main(){uv=position*.5+.5;gl_Position=vec4(position,0.,1.);}`;
const fragment = `precision highp float;
varying vec2 uv;
uniform sampler2D environment;
uniform float time, kind, radius, strength, tilt;
uniform vec2 center, wind;
float hash(vec3 p){p=fract(p*.3183099+vec3(.17,.31,.53));p*=17.;return fract(p.x*p.y*p.z*(p.x+p.y+p.z));}
float noise(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);}
float fbm(vec3 p){return noise(p)*.58+noise(p*2.03+vec3(3.1))*.28+noise(p*4.11+vec3(7.3))*.14;}
vec3 turn(vec3 p){float a=time*.22;float s=sin(a),c=cos(a);p.xz=mat2(c,-s,s,c)*p.xz;float st=sin(tilt),ct=cos(tilt);p.yz=mat2(ct,-st,st,ct)*p.yz;return p;}
vec4 flame(vec2 p){
 vec3 color=vec3(0.);float alpha=0.;
 for(int i=0;i<36;i++){
  vec3 q=vec3(p,-1.2+float(i)*.0686);
  float height=max(q.y,0.);
  q.x-=wind.x*height*height*.2;
  q.x+=sin(q.y*4.-time*2.4)*height*.1;
  vec3 flow=turn(q)*3.8-vec3(0.,time*2.3,0.);
  float turbulence=fbm(flow);
  vec3 shape=q;shape.y*=q.y>0.?.72:1.;
  float envelope=1.-smoothstep(.3,1.19,length(shape)+(turbulence-.5)*.4);
  float density=max(0.,envelope*turbulence*2.35-.52);
  float plume=max(0.,1.-length(q.xz)/max(.08,.62*(1.-max(q.y-.3,0.)/1.55))+(turbulence-.5)*1.2);
  plume*=smoothstep(.25,.6,q.y)*(1.-smoothstep(1.3,1.59,q.y));
  density=max(density,plume*turbulence*.9);
  float heat=clamp(density*1.25,0.,1.);
  vec3 emission=mix(vec3(1.,.065,.005),vec3(1.,.42,.012),smoothstep(.02,.42,heat));
  emission=mix(emission,vec3(1.,.83,.26),smoothstep(.4,.85,heat));
  emission=mix(emission,vec3(1.,.98,.77),smoothstep(.85,1.,heat));
  float a=1.-exp(-density*.25*(.85+strength*.3));
  color+=(1.-alpha)*emission*a;alpha+=(1.-alpha)*a;
 }
 return vec4(color,alpha);
}
vec4 liquid(vec2 p){
 float angle=atan(p.y,p.x),r=length(p);
 float boundary=1.+.024*sin(angle*6.+time*1.7)+.012*sin(angle*11.-time*2.2);
 if(r>boundary+.02)return vec4(0.);
 vec3 n=vec3(p/boundary,sqrt(max(0.,1.-dot(p,p)/(boundary*boundary))));
 vec3 flow=turn(n)*5.+vec3(0.,time*.32,-time*.46);
 float wave=fbm(flow);
 float dx=fbm(flow+vec3(.04,0,0))-wave;
 float dy=fbm(flow+vec3(0,.04,0))-wave;
 n=normalize(n+vec3(dx,dy,0.)*2.2);
 float thickness=sqrt(max(0.,1.-r*r/(boundary*boundary)));
 vec2 sceneUV=vec2((center.x+p.x*radius)/1280.,1.-(center.y-p.y*radius)/800.);
 vec2 refracted=sceneUV-n.xy*vec2(radius/1280.,radius/800.)*thickness*.64;
 vec3 background=texture2D(environment,clamp(refracted,vec2(.001),vec2(.999))).rgb;
 float fresnel=.04+.96*pow(1.-max(n.z,0.),4.);
 vec3 reflected=texture2D(environment,clamp(sceneUV+n.xy*.11,vec2(.001),vec2(.999))).rgb;
 vec3 transmission=background*mix(vec3(.9,.98,1.),vec3(.48,.82,.94),thickness);
 vec3 color=mix(transmission,reflected*.7+vec3(.035,.14,.22),fresnel*.7);
 vec3 light=normalize(vec3(-.5,.7,1.));
 float specular=pow(max(dot(n,normalize(light+vec3(0.,0.,1.))),0.),100.);
 float shimmer=pow(max(0.,1.-abs(wave-.51)*18.),3.);
 color+=vec3(.62,.89,1.)*shimmer*.16*thickness;
 color+=vec3(.92,.99,1.)*specular*.95;
 color+=vec3(.16,.62,.79)*fresnel*.2;
 if(kind>1.5){
  float warm=smoothstep(.45,.74,fbm(flow*.8+vec3(time*.23)));
  color=mix(color,color*.55+vec3(1.,.36,.025),warm*.72*thickness);
 }
 float edge=1.-smoothstep(boundary-.016,boundary+.015,r);
 float alpha=edge*(.76+fresnel*.2);
 return vec4(color*alpha,alpha);
}
void main(){
 vec2 p=(uv-.5)*(kind>.5&&kind<1.5?2.64:3.2);
 if(kind>1.5){vec4 water=liquid(p),hot=flame(p);gl_FragColor=water+hot*.7*(1.-water.a);}
 else gl_FragColor=kind<.5?flame(p):liquid(p);
}`;

function initialize() {
  const canvas = document.createElement('canvas'); canvas.width = 288; canvas.height = 288;
  const gl = canvas.getContext('webgl', { alpha: true, premultipliedAlpha: true, antialias: false, depth: false, stencil: false });
  if (!gl) { status = 'fallback'; return null; }
  const compile = (type, source) => {
    const shader = gl.createShader(type); gl.shaderSource(shader, source); gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) { status = `fallback: ${gl.getShaderInfoLog(shader)}`; gl.deleteShader(shader); return null; }
    return shader;
  };
  const vs = compile(gl.VERTEX_SHADER, vertex), fs = compile(gl.FRAGMENT_SHADER, fragment);
  if (!vs || !fs) return null;
  const program = gl.createProgram(); gl.attachShader(program, vs); gl.attachShader(program, fs); gl.linkProgram(program);
  gl.deleteShader(vs); gl.deleteShader(fs);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) { status = `fallback: ${gl.getProgramInfoLog(program)}`; return null; }
  gl.useProgram(program);
  const vertices = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, vertices);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
  const position = gl.getAttribLocation(program, 'position'); gl.enableVertexAttribArray(position); gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
  const uniforms = Object.fromEntries(['time', 'kind', 'center', 'wind', 'radius', 'strength', 'tilt', 'environment'].map(name => [name, gl.getUniformLocation(program, name)]));
  const texture = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true); gl.uniform1i(uniforms.environment, 0);
  const environment = document.createElement('canvas'); environment.width = 320; environment.height = 200;
  const environmentCtx = environment.getContext('2d', { alpha: false });
  canvas.addEventListener('webglcontextlost', event => { event.preventDefault(); status = 'context lost'; });
  canvas.addEventListener('webglcontextrestored', () => { renderer = null; status = 'uninitialized'; });
  status = 'active';
  return { canvas, gl, uniforms, environment, environmentCtx };
}

export const elementMaterialStatus = () => status;
export function renderElementMaterial(source, geometry, element, strength, time) {
  if (status !== 'uninitialized' && status !== 'active') return null;
  renderer ||= initialize();
  if (!renderer) return null;
  const { gl, canvas, uniforms, environment, environmentCtx } = renderer;
  if (gl.isContextLost()) return null;
  environmentCtx.drawImage(source, 0, 0, environment.width, environment.height);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, environment);
  gl.uniform1f(uniforms.time, time); gl.uniform1f(uniforms.kind, element === 'fire' ? 0 : element === 'water' ? 1 : 2);
  gl.uniform2f(uniforms.center, geometry.center.x, geometry.center.y);
  gl.uniform2f(uniforms.wind, -(geometry.motion?.x || 0) / 850, -(geometry.motion?.y || 0) / 850);
  gl.uniform1f(uniforms.radius, geometry.radius); gl.uniform1f(uniforms.tilt, geometry.tilt);
  gl.uniform1f(uniforms.strength, strength);
  gl.drawArrays(gl.TRIANGLES, 0, 6);
  return canvas;
}
