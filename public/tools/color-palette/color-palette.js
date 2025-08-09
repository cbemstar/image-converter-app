const CSS_COLOR_NAMES = {
  "aliceblue": "#f0f8ff",
  "antiquewhite": "#faebd7",
  "aqua": "#00ffff",
  "aquamarine": "#7fffd4",
  "azure": "#f0ffff",
  "beige": "#f5f5dc",
  "bisque": "#ffe4c4",
  "black": "#000000",
  "blanchedalmond": "#ffebcd",
  "blue": "#0000ff",
  "blueviolet": "#8a2be2",
  "brown": "#a52a2a",
  "burlywood": "#deb887",
  "cadetblue": "#5f9ea0",
  "chartreuse": "#7fff00",
  "chocolate": "#d2691e",
  "coral": "#ff7f50",
  "cornflowerblue": "#6495ed",
  "cornsilk": "#fff8dc",
  "crimson": "#dc143c",
  "cyan": "#00ffff",
  "darkblue": "#00008b",
  "darkcyan": "#008b8b",
  "darkgoldenrod": "#b8860b",
  "darkgray": "#a9a9a9",
  "darkgreen": "#006400",
  "darkkhaki": "#bdb76b",
  "darkmagenta": "#8b008b",
  "darkolivegreen": "#556b2f",
  "darkorange": "#ff8c00",
  "darkorchid": "#9932cc",
  "darkred": "#8b0000",
  "darksalmon": "#e9967a",
  "darkseagreen": "#8fbc8f",
  "darkslateblue": "#483d8b",
  "darkslategray": "#2f4f4f",
  "darkturquoise": "#00ced1",
  "darkviolet": "#9400d3",
  "deeppink": "#ff1493",
  "deepskyblue": "#00bfff",
  "dimgray": "#696969",
  "dodgerblue": "#1e90ff",
  "firebrick": "#b22222",
  "floralwhite": "#fffaf0",
  "forestgreen": "#228b22",
  "fuchsia": "#ff00ff",
  "gainsboro": "#dcdcdc",
  "ghostwhite": "#f8f8ff",
  "gold": "#ffd700",
  "goldenrod": "#daa520",
  "gray": "#808080",
  "green": "#008000",
  "greenyellow": "#adff2f",
  "honeydew": "#f0fff0",
  "hotpink": "#ff69b4",
  "indianred": "#cd5c5c",
  "indigo": "#4b0082",
  "ivory": "#fffff0",
  "khaki": "#f0e68c",
  "lavender": "#e6e6fa",
  "lavenderblush": "#fff0f5",
  "lawngreen": "#7cfc00",
  "lemonchiffon": "#fffacd",
  "lightblue": "#add8e6",
  "lightcoral": "#f08080",
  "lightcyan": "#e0ffff",
  "lightgoldenrodyellow": "#fafad2",
  "lightgray": "#d3d3d3",
  "lightgreen": "#90ee90",
  "lightpink": "#ffb6c1",
  "lightsalmon": "#ffa07a",
  "lightseagreen": "#20b2aa",
  "lightskyblue": "#87cefa",
  "lightslategray": "#778899",
  "lightsteelblue": "#b0c4de",
  "lightyellow": "#ffffe0",
  "lime": "#00ff00",
  "limegreen": "#32cd32",
  "linen": "#faf0e6",
  "magenta": "#ff00ff",
  "maroon": "#800000",
  "mediumaquamarine": "#66cdaa",
  "mediumblue": "#0000cd",
  "mediumorchid": "#ba55d3",
  "mediumpurple": "#9370db",
  "mediumseagreen": "#3cb371",
  "mediumslateblue": "#7b68ee",
  "mediumspringgreen": "#00fa9a",
  "mediumturquoise": "#48d1cc",
  "mediumvioletred": "#c71585",
  "midnightblue": "#191970",
  "mintcream": "#f5fffa",
  "mistyrose": "#ffe4e1",
  "moccasin": "#ffe4b5",
  "navajowhite": "#ffdead",
  "navy": "#000080",
  "oldlace": "#fdf5e6",
  "olive": "#808000",
  "olivedrab": "#6b8e23",
  "orange": "#ffa500",
  "orangered": "#ff4500",
  "orchid": "#da70d6",
  "palegoldenrod": "#eee8aa",
  "palegreen": "#98fb98",
  "paleturquoise": "#afeeee",
  "palevioletred": "#db7093",
  "papayawhip": "#ffefd5",
  "peachpuff": "#ffdab9",
  "peru": "#cd853f",
  "pink": "#ffc0cb",
  "plum": "#dda0dd",
  "powderblue": "#b0e0e6",
  "purple": "#800080",
  "rebeccapurple": "#663399",
  "red": "#ff0000",
  "rosybrown": "#bc8f8f",
  "royalblue": "#4169e1",
  "saddlebrown": "#8b4513",
  "salmon": "#fa8072",
  "sandybrown": "#f4a460",
  "seagreen": "#2e8b57",
  "seashell": "#fff5ee",
  "sienna": "#a0522d",
  "silver": "#c0c0c0",
  "skyblue": "#87ceeb",
  "slateblue": "#6a5acd",
  "slategray": "#708090",
  "snow": "#fffafa",
  "springgreen": "#00ff7f",
  "steelblue": "#4682b4",
  "tan": "#d2b48c",
  "teal": "#008080",
  "thistle": "#d8bfd8",
  "tomato": "#ff6347",
  "turquoise": "#40e0d0",
  "violet": "#ee82ee",
  "wheat": "#f5deb3",
  "white": "#ffffff",
  "whitesmoke": "#f5f5f5",
  "yellow": "#ffff00",
  "yellowgreen": "#9acd32"
};

const NAME_LIST = Object.entries(CSS_COLOR_NAMES).map(([name, hex]) => ({
  name,
  r: parseInt(hex.slice(1,3),16),
  g: parseInt(hex.slice(3,5),16),
  b: parseInt(hex.slice(5,7),16)
}));

function hex(value){
  return '#' + value.map(v=>v.toString(16).padStart(2,'0')).join('');
}

function getColorName(hexCode){
  const r = parseInt(hexCode.slice(1,3),16);
  const g = parseInt(hexCode.slice(3,5),16);
  const b = parseInt(hexCode.slice(5,7),16);
  let best;
  let min = Infinity;
  for(const c of NAME_LIST){
    const d = (c.r - r)**2 + (c.g - g)**2 + (c.b - b)**2;
    if(d < min){ min = d; best = c.name; }
  }
  return best.charAt(0).toUpperCase()+best.slice(1);
}

function luminance(r,g,b){
  const a = [r,g,b].map(v=>{
    v /= 255;
    return v <= 0.03928 ? v/12.92 : Math.pow((v+0.055)/1.055,2.4);
  });
  return a[0]*0.2126 + a[1]*0.7152 + a[2]*0.0722;
}

function contrastRatio(hex1, hex2){
  const r1=parseInt(hex1.slice(1,3),16),g1=parseInt(hex1.slice(3,5),16),b1=parseInt(hex1.slice(5,7),16);
  const r2=parseInt(hex2.slice(1,3),16),g2=parseInt(hex2.slice(3,5),16),b2=parseInt(hex2.slice(5,7),16);
  const L1 = luminance(r1,g1,b1);
  const L2 = luminance(r2,g2,b2);
  const light = Math.max(L1,L2);
  const dark = Math.min(L1,L2);
  return (light+0.05)/(dark+0.05);
}

function renderPalette(palette){
  const container = document.getElementById('palette');
  container.innerHTML='';
  palette.forEach(c=>{
    const div=document.createElement('div');
    div.className='flex items-center gap-4';
    const swatch=document.createElement('div');
    swatch.className='w-8 h-8 rounded';
    swatch.style.background=c.hex;
    const info=document.createElement('div');
    info.innerHTML=`<span class="font-mono">${c.hex}</span> <span>${c.name}</span> <span class="text-xs">CR ⬛ ${c.crBlack.toFixed(2)} ⬜ ${c.crWhite.toFixed(2)}</span>`;
    info.style.color='var(--foreground)';
    div.appendChild(swatch);
    div.appendChild(info);
    container.appendChild(div);
  });
}

function generateJSON(palette){
  return new Blob([JSON.stringify(palette.map(c=>({hex:c.hex,name:c.name})),null,2)],{type:'application/json'});
}

function generateGPL(palette){
  let text='GIMP Palette\nName: Palette\nColumns: 0\n#\n';
  palette.forEach(c=>{
    const r=parseInt(c.hex.slice(1,3),16);
    const g=parseInt(c.hex.slice(3,5),16);
    const b=parseInt(c.hex.slice(5,7),16);
    text += `${r} ${g} ${b}\t${c.name}\n`;
  });
  return new Blob([text],{type:'text/plain'});
}

function generateASE(palette){
  const blocks=[];
  for(const c of palette){
    const name=c.name;
    const nameLen=name.length+1;
    const colorBuf=new ArrayBuffer(2+nameLen*2+4+4*3+2);
    const dv=new DataView(colorBuf);
    let o=0;
    dv.setUint16(o,nameLen,false);o+=2;
    for(let i=0;i<name.length;i++){dv.setUint16(o,name.charCodeAt(i),false);o+=2;}
    dv.setUint16(o,0,false);o+=2;
    dv.setUint8(o,82);dv.setUint8(o+1,71);dv.setUint8(o+2,66);dv.setUint8(o+3,32);o+=4; // 'RGB '
    dv.setFloat32(o,parseInt(c.hex.slice(1,3),16)/255,false);o+=4;
    dv.setFloat32(o,parseInt(c.hex.slice(3,5),16)/255,false);o+=4;
    dv.setFloat32(o,parseInt(c.hex.slice(5,7),16)/255,false);o+=4;
    dv.setUint16(o,0,false);
    const block=new ArrayBuffer(2+4+colorBuf.byteLength);
    const bview=new DataView(block);
    bview.setUint16(0,1,false);
    bview.setUint32(2,colorBuf.byteLength,false);
    new Uint8Array(block,6).set(new Uint8Array(colorBuf));
    blocks.push(new Uint8Array(block));
  }
  const size=12+blocks.reduce((s,b)=>s+b.length,0);
  const out=new Uint8Array(size);
  out[0]=0x41;out[1]=0x53;out[2]=0x45;out[3]=0x46; // ASEF
  const head=new DataView(out.buffer);
  head.setUint16(4,1,false);head.setUint16(6,0,false);head.setUint32(8,blocks.length,false);
  let offset=12;
  blocks.forEach(b=>{out.set(b,offset);offset+=b.length;});
  return new Blob([out.buffer],{type:'application/octet-stream'});
}

function updateDownloads(palette){
  const jsonBlob=generateJSON(palette);
  const aseBlob=generateASE(palette);
  const gplBlob=generateGPL(palette);
  const jsonLink=document.getElementById('download-json');
  const aseLink=document.getElementById('download-ase');
  const gplLink=document.getElementById('download-gpl');
  jsonLink.href=URL.createObjectURL(jsonBlob);
  aseLink.href=URL.createObjectURL(aseBlob);
  gplLink.href=URL.createObjectURL(gplBlob);
  jsonLink.style.display=aseLink.style.display=gplLink.style.display='inline-block';
}

document.addEventListener('DOMContentLoaded',()=>{
  const input=document.getElementById('image-input');
  const count=document.getElementById('color-count');
  if(!input||!count) return;
  const img=new Image();
  img.crossOrigin='Anonymous';
  let lastPalette=[];
  function extract(){
    if(!img.complete) return;
    const ct=new ColorThief();
    const num=parseInt(count.value)||5;
    const colors=ct.getPalette(img,num);
    lastPalette=colors.map(c=>{
      const h=hex(c);
      return {hex:h,name:getColorName(h),crWhite:contrastRatio(h,'#ffffff'),crBlack:contrastRatio(h,'#000000')};
    });
    renderPalette(lastPalette);
    updateDownloads(lastPalette);
  }
  input.addEventListener('change',()=>{
    const file=input.files[0];
    if(!file) return;
    const url=URL.createObjectURL(file);
    img.onload=()=>{extract(); URL.revokeObjectURL(url);};
    img.src=url;
  });
  count.addEventListener('change',()=>{ if(img.src) extract(); });
});
