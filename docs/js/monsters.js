/* monsters.js — standalone beast SVG generator (Monster Forge engine).
   window.Monsters.svgUriFor(nick) -> data:image/svg+xml URI (300x400)
   Named players use their curated beast; unknown names generate from a name hash. */
(function () {
  const bodies = ['blob','orb','crystal','carapace','boulder','slime','segmented','furry'];
  const heads = ['round','beast','crystal','insect','square','skull','triangle','flat'];
  const eyesL = ['pair','trio','cyclops','swarm','quad','angry','sleepy','wide'];
  const hornsL = ['none','twin','crown','antenna','antennae','fins','ears','mane'];
  const legsL = ['none','stubby','claws','tentacles','bird','hooves','paws','many'];
  const mouthsL = ['none','fangs','grin','beak','tusks','tongue','sharp','frown'];
  const tailsL = ['none','spiked','fin','whip','club','curl','forked','bushy'];

  const rosterList = [
    ['Abrose','radiant','orb','crystal','wide','crown','hooves','grin','curl','s'],
    ['Arek','grove','blob','round','pair','ears','stubby','grin','bushy',''],
    ['Ash','ember','boulder','skull','angry','twin','claws','sharp','spiked','s'],
    ['Ban','mountain','boulder','square','angry','none','claws','frown','club','s'],
    ['Benek','toxic','slime','round','sleepy','antenna','stubby','tongue','none','n'],
    ['Bliczu','sentinel','crystal','triangle','wide','fins','bird','grin','forked','w'],
    ['Busty','cloud','orb','flat','sleepy','ears','paws','grin','bushy','',{body:132}],
    ['Derko','shadow','furry','beast','angry','twin','claws','fangs','whip','s'],
    ['EloŻelo','tide','slime','round','quad','antennae','tentacles','tongue','none','n'],
    ['Emoś','void','blob','skull','sleepy','none','stubby','frown','whip',''],
    ['Ezra','herald','crystal','crystal','cyclops','crown','none','none','fin','w'],
    ['Falafel','radiant','boulder','round','pair','none','paws','grin','bushy','',{body:120}],
    ['Fsmesdek','toxic','segmented','insect','swarm','antennae','many','sharp','forked','s'],
    ['Funfel','grove','blob','round','wide','ears','stubby','grin','curl',''],
    ['Jagoda','ocean','orb','round','pair','antenna','stubby','grin','none',''],
    ['Jumcia','cloud','blob','round','sleepy','ears','paws','grin','bushy',''],
    ['Jusko','frost','orb','round','pair','fins','stubby','grin','fin',''],
    ['Kamila','herald','orb','crystal','wide','crown','hooves','grin','curl',''],
    ['Koharu','grove','blob','round','sleepy','ears','stubby','grin','bushy',''],
    ['Kosior','infernal','carapace','beast','angry','twin','claws','fangs','spiked','s'],
    ['Last Hussar','sentinel','carapace','square','wide','crown','hooves','frown','spiked','ws'],
    ['Limcia','toxic','slime','round','wide','antenna','stubby','grin','none','n'],
    ['Maciej','mountain','boulder','square','pair','none','stubby','grin','none',''],
    ['MOUSE','shadow','furry','round','wide','ears','stubby','none','whip','',{eyes:130,horns:128,body:82}],
    ['NeX','sentinel','crystal','triangle','angry','fins','bird','sharp','forked','w'],
    ['Oliwka','grove','orb','round','pair','antenna','stubby','grin','none',''],
    ['Pajfu','cloud','furry','round','sleepy','ears','paws','grin','bushy',''],
    ['Radio','mountain','carapace','square','pair','antennae','stubby','grin','none',''],
    ['Resek','ember','blob','beast','angry','twin','claws','fangs','spiked','s'],
    ['Salencja','abyss','slime','round','quad','antennae','tentacles','tongue','fin','n'],
    ['Shot','bramble','crystal','triangle','angry','twin','bird','sharp','forked','s'],
    ['Songo','radiant','orb','round','wide','crown','paws','grin','curl',''],
    ['SuperOliwka','grove','orb','round','wide','crown','hooves','grin','curl','w'],
    ['Szerwa','shadow','furry','beast','angry','mane','claws','fangs','bushy','s'],
    ['Talon','infernal','beast','beast','angry','twin','claws','beak','spiked','ws'],
    ['Toffic','ember','slime','round','sleepy','ears','stubby','tongue','curl','n'],
    ['Universal Ruler','herald','orb','crystal','cyclops','crown','hooves','none','curl','w',{head:120,horns:122}],
    ['Wernisarz','cloud','crystal','crystal','wide','fins','none','grin','fin','w'],
    ['Wotuchati','toxic','segmented','insect','swarm','antennae','many','sharp','forked','s'],
    ['Wyjeba','infernal','boulder','skull','angry','twin','claws','sharp','club','s'],
    ['Zubson','mountain','boulder','beast','angry','twin','claws','tusks','club','s',{mouth:130}]
  ];
  const FEMME = ['Jagoda','Jumcia','Kamila','Koharu','Limcia','Oliwka','Salencja','SuperOliwka','Bliczu'];

  const THEMES = {
    void:{n:'Void',a:'#1a0a2e',b:'#05030d',glow:'#7c3aed',body:'#1e1035',dk:'#16082a',stroke:'#7c3aed',ac:'#6d28d9',eye:'#a855f7',core:'#e9d5ff',horn:'#581c87'},
    infernal:{n:'Infernal',a:'#2d0a00',b:'#080200',glow:'#f97316',body:'#450a0a',dk:'#3b0a0a',stroke:'#ef4444',ac:'#dc2626',eye:'#f97316',core:'#fef3c7',horn:'#7f1d1d'},
    mountain:{n:'Mountain',a:'#1c1a0a',b:'#070601',glow:'#a8a29e',body:'#292524',dk:'#1c1917',stroke:'#a8a29e',ac:'#57534e',eye:'#d97706',core:'#fef3c7',horn:'#57534e'},
    ocean:{n:'Ocean',a:'#0a1e2d',b:'#020709',glow:'#0ea5e9',body:'#0c2744',dk:'#082030',stroke:'#38bdf8',ac:'#0ea5e9',eye:'#0ea5e9',core:'#e0f2fe',horn:'#0c4a6e'},
    cloud:{n:'Cloud',a:'#1e1b2e',b:'#07060f',glow:'#a78bfa',body:'#1e1b4b',dk:'#16134a',stroke:'#a78bfa',ac:'#818cf8',eye:'#a78bfa',core:'#ede9fe',horn:'#4338ca'},
    herald:{n:'Herald',a:'#1a0a2e',b:'#060210',glow:'#d946ef',body:'#1e1035',dk:'#12082a',stroke:'#c026d3',ac:'#a21caf',eye:'#d946ef',core:'#fce7f3',horn:'#581c87'},
    tide:{n:'Tide',a:'#052e3d',b:'#010a10',glow:'#22d3ee',body:'#164e63',dk:'#0c4a6e',stroke:'#22d3ee',ac:'#0369a1',eye:'#38bdf8',core:'#e0f2fe',horn:'#0369a1'},
    grove:{n:'Grove',a:'#0a1f0a',b:'#020702',glow:'#4ade80',body:'#14532d',dk:'#0f3d20',stroke:'#22c55e',ac:'#15803d',eye:'#16a34a',core:'#86efac',horn:'#166534'},
    sentinel:{n:'Sentinel',a:'#0f1a3d',b:'#03070f',glow:'#3b82f6',body:'#1e3a8a',dk:'#0c1d5e',stroke:'#60a5fa',ac:'#1d4ed8',eye:'#3b82f6',core:'#bfdbfe',horn:'#1d4ed8'},
    bramble:{n:'Bramble',a:'#2a0a05',b:'#080201',glow:'#ef4444',body:'#450a0a',dk:'#2d0808',stroke:'#f87171',ac:'#b91c1c',eye:'#dc2626',core:'#fee2e2',horn:'#7f1d1d'},
    shadow:{n:'Shadow',a:'#111827',b:'#030508',glow:'#9ca3af',body:'#1f2937',dk:'#111827',stroke:'#9ca3af',ac:'#374151',eye:'#f59e0b',core:'#fef3c7',horn:'#374151'},
    ember:{n:'Ember',a:'#1a1008',b:'#060401',glow:'#f59e0b',body:'#292524',dk:'#1c1917',stroke:'#d97706',ac:'#a16207',eye:'#d97706',core:'#fef3c7',horn:'#57534e'},
    toxic:{n:'Toxic',a:'#0f1a05',b:'#030601',glow:'#a3e635',body:'#1a2e05',dk:'#14210a',stroke:'#a3e635',ac:'#4d7c0f',eye:'#bef264',core:'#ecfccb',horn:'#3f6212'},
    frost:{n:'Frost',a:'#0a1a24',b:'#020609',glow:'#7dd3fc',body:'#0c3049',dk:'#082436',stroke:'#bae6fd',ac:'#38bdf8',eye:'#e0f2fe',core:'#ffffff',horn:'#0369a1'},
    abyss:{n:'Abyss',a:'#04140f',b:'#010604',glow:'#2dd4bf',body:'#0f3a30',dk:'#0a2a22',stroke:'#2dd4bf',ac:'#0d9488',eye:'#5eead4',core:'#ccfbf1',horn:'#115e59'},
    radiant:{n:'Radiant',a:'#241a04',b:'#0a0701',glow:'#fbbf24',body:'#3d2c05',dk:'#2a1e04',stroke:'#fbbf24',ac:'#d97706',eye:'#fde047',core:'#fef9c3',horn:'#92400e'},
    blossom:{n:'Blossom',a:'#2d0a1e',b:'#0d0207',glow:'#f472b6',body:'#500724',dk:'#3d0518',stroke:'#f9a8d4',ac:'#db2777',eye:'#f472b6',core:'#fce7f3',horn:'#9d174d'},
    lava:{n:'Lava',a:'#2a0f00',b:'#0a0300',glow:'#fb923c',body:'#431407',dk:'#2e0d04',stroke:'#fb923c',ac:'#ea580c',eye:'#facc15',core:'#fef3c7',horn:'#7c2d12'},
    amethyst:{n:'Amethyst',a:'#1e0a33',b:'#08020f',glow:'#c084fc',body:'#3b0764',dk:'#2a0548',stroke:'#d8b4fe',ac:'#9333ea',eye:'#c084fc',core:'#f3e8ff',horn:'#6b21a8'},
    jade:{n:'Jade',a:'#04211a',b:'#010806',glow:'#34d399',body:'#064e3b',dk:'#043a2c',stroke:'#6ee7b7',ac:'#059669',eye:'#34d399',core:'#d1fae5',horn:'#065f46'},
    magma:{n:'Magma',a:'#210505',b:'#080101',glow:'#f87171',body:'#3f0a0a',dk:'#2a0606',stroke:'#fca5a5',ac:'#dc2626',eye:'#fb923c',core:'#fee2e2',horn:'#7f1d1d'},
    storm:{n:'Storm',a:'#141a24',b:'#04060a',glow:'#818cf8',body:'#1e293b',dk:'#131c2e',stroke:'#a5b4fc',ac:'#4f46e5',eye:'#818cf8',core:'#e0e7ff',horn:'#3730a3'},
    sunset:{n:'Sunset',a:'#2a1005',b:'#0a0401',glow:'#fb7185',body:'#500724',dk:'#3a1810',stroke:'#fda4af',ac:'#f43f5e',eye:'#fbbf24',core:'#ffe4e6',horn:'#9f1239'},
    mint:{n:'Mint',a:'#04211f',b:'#010807',glow:'#5eead4',body:'#0f3d3a',dk:'#0a2e2b',stroke:'#99f6e4',ac:'#14b8a6',eye:'#5eead4',core:'#f0fdfa',horn:'#0f766e'},
    ash:{n:'Ash',a:'#18181b',b:'#050506',glow:'#d4d4d8',body:'#27272a',dk:'#18181b',stroke:'#d4d4d8',ac:'#52525b',eye:'#e4e4e7',core:'#fafafa',horn:'#3f3f46'},
    rose:{n:'Rose',a:'#2a0512',b:'#0a0106',glow:'#fb7185',body:'#4c0519',dk:'#360311',stroke:'#fda4af',ac:'#e11d48',eye:'#fb7185',core:'#ffe4e6',horn:'#881337'},
    citrus:{n:'Citrus',a:'#1f1a02',b:'#080601',glow:'#a3e635',body:'#365314',dk:'#243a0d',stroke:'#bef264',ac:'#65a30d',eye:'#d9f99d',core:'#f7fee7',horn:'#3f6212'},
    grid:{n:'Grid',a:'#02141c',b:'#00060a',glow:'#22d3ee',body:'#04222e',dk:'#02161e',stroke:'#22d3ee',ac:'#06b6d4',eye:'#67e8f9',core:'#ecfeff',horn:'#0e7490'},
    orange:{n:'Program',a:'#1c0f00',b:'#0a0500',glow:'#ff9d00',body:'#2e1a00',dk:'#1e1100',stroke:'#ffb84d',ac:'#ff7a00',eye:'#ffd28a',core:'#fff4e0',horn:'#b35c00'}
  };

  function rng(seed){ let t=seed>>>0; return ()=>{ t=(t+0x6D2B79F5)>>>0; let r=Math.imul(t^(t>>>15),1|t); r=(r+Math.imul(r^(r>>>7),61|r))^r; return ((r^(r>>>14))>>>0)/4294967296; }; }
  function hashStr(str){ let h=2166136261>>>0; str=String(str||''); for(let i=0;i<str.length;i++){ h^=str.charCodeAt(i); h=Math.imul(h,16777619); } return h>>>0; }

  function randomParams(rand,name){
    const p=a=>a[Math.floor(rand()*a.length)];
    return {
      name, theme:p(Object.keys(THEMES)), body:p(bodies), head:p(heads),
      eyes:p(eyesL), horns:p(hornsL), legs:p(legsL), mouth:p(mouthsL), tail:p(tailsL),
      wings:rand()<0.34, spikes:rand()<0.42, neck:rand()<0.82,
      lashes:rand()<0.3, blush:rand()<0.35, bow:rand()<0.25, flowers:rand()<0.22, hearts:rand()<0.2,
      sun:rand()<0.3, grid:rand()<0.35, scan:rand()<0.3, backdrop:['none','none','anime','lol','cyber'][Math.floor(rand()*5)],
      anims:{idle:rand()<0.85,blink:rand()<0.8,mouth:rand()<0.7,leap:rand()<0.5,wings:rand()<0.8,tail:rand()<0.8,belly:rand()<0.55,particles:rand()<0.85},
      sizes:{body:Math.floor(85+rand()*35),head:Math.floor(80+rand()*45),horns:Math.floor(80+rand()*50),eyes:Math.floor(80+rand()*45),mouth:100,legs:Math.floor(85+rand()*30),tail:Math.floor(85+rand()*35),wings:Math.floor(85+rand()*30),spikes:100},
      particleCount:Math.floor(rand()*11)+2, seed:Math.floor(rand()*1e9)
    };
  }

  // ---- part builders ----
  function wingsSVG(p){ return `<path d="M150 210 L34 104 L84 208 Z" fill="${p.horn}" opacity="0.8"/><path d="M150 210 L266 104 L216 208 Z" fill="${p.horn}" opacity="0.8"/><path d="M150 210 L34 104 L84 208 Z" fill="none" stroke="${p.stroke}" stroke-width="1.5" opacity="0.5"/><path d="M150 210 L266 104 L216 208 Z" fill="none" stroke="${p.stroke}" stroke-width="1.5" opacity="0.5"/><path d="M150 210 L52 118 M150 210 L66 152 M150 210 L248 118 M150 210 L234 152" stroke="${p.ac}" stroke-width="1" opacity="0.4" fill="none"/>`; }
  function spikesSVG(p){ const S=[[96,208,-1],[86,244,-1],[92,282,-1],[204,208,1],[214,244,1],[208,282,1]]; return S.map(([x,y,d])=>`<polygon points="${x},${y-14} ${x+d*28},${y} ${x},${y+14}" fill="${p.horn}"/><polygon points="${x},${y-14} ${x+d*28},${y} ${x},${y+14}" fill="none" stroke="${p.stroke}" stroke-width="1" opacity="0.5"/>`).join(''); }
  function legsSVG(k,p){
    if(k==='stubby') return `<ellipse cx="106" cy="345" rx="27" ry="17" fill="${p.dk}" stroke="${p.stroke}" stroke-width="1.5"/><ellipse cx="194" cy="345" rx="27" ry="17" fill="${p.dk}" stroke="${p.stroke}" stroke-width="1.5"/><ellipse cx="120" cy="359" rx="16" ry="9" fill="${p.ac}"/><ellipse cx="180" cy="359" rx="16" ry="9" fill="${p.ac}"/>`;
    if(k==='claws') return `<path d="M96 244 L50 218 M92 272 L46 266 M94 300 L52 324" stroke="${p.horn}" stroke-width="6" fill="none" stroke-linecap="round"/><path d="M204 244 L250 218 M208 272 L254 266 M206 300 L248 324" stroke="${p.horn}" stroke-width="6" fill="none" stroke-linecap="round"/><circle cx="50" cy="218" r="4" fill="${p.eye}"/><circle cx="46" cy="266" r="4" fill="${p.eye}"/><circle cx="52" cy="324" r="4" fill="${p.eye}"/><circle cx="250" cy="218" r="4" fill="${p.eye}"/><circle cx="254" cy="266" r="4" fill="${p.eye}"/><circle cx="248" cy="324" r="4" fill="${p.eye}"/>`;
    if(k==='tentacles') return `<path d="M112 348 Q86 384 62 368 Q50 356 60 340" stroke="${p.body}" stroke-width="11" fill="none" stroke-linecap="round"/><path d="M134 356 Q124 388 100 384" stroke="${p.dk}" stroke-width="9" fill="none" stroke-linecap="round"/><path d="M188 348 Q214 384 238 368 Q250 356 240 340" stroke="${p.body}" stroke-width="11" fill="none" stroke-linecap="round"/><path d="M166 356 Q176 388 200 384" stroke="${p.dk}" stroke-width="9" fill="none" stroke-linecap="round"/>`;
    if(k==='hooves') return `<rect x="98" y="328" width="18" height="36" rx="4" fill="${p.dk}" stroke="${p.stroke}" stroke-width="1.5"/><rect x="184" y="328" width="18" height="36" rx="4" fill="${p.dk}" stroke="${p.stroke}" stroke-width="1.5"/><rect x="95" y="360" width="24" height="11" rx="3" fill="${p.horn}"/><rect x="181" y="360" width="24" height="11" rx="3" fill="${p.horn}"/>`;
    if(k==='paws') return `<ellipse cx="108" cy="352" rx="24" ry="16" fill="${p.dk}" stroke="${p.stroke}" stroke-width="1.5"/><ellipse cx="192" cy="352" rx="24" ry="16" fill="${p.dk}" stroke="${p.stroke}" stroke-width="1.5"/>`+[92,108,124,176,192,208].map(x=>`<circle cx="${x}" cy="362" r="4" fill="${p.horn}"/>`).join('');
    if(k==='many'){ let s2=''; for(let i=0;i<5;i++){const y=252+i*22; s2+=`<path d="M94 ${y} L64 ${y+13}" stroke="${p.dk}" stroke-width="4" stroke-linecap="round"/><path d="M206 ${y} L236 ${y+13}" stroke="${p.dk}" stroke-width="4" stroke-linecap="round"/>`;} return s2; }
    if(k==='bird') return `<path d="M128 330 L124 368" stroke="${p.horn}" stroke-width="5" stroke-linecap="round"/><path d="M124 368 L112 378 M124 368 L124 380 M124 368 L136 377" stroke="${p.horn}" stroke-width="4" fill="none" stroke-linecap="round"/><path d="M172 330 L176 368" stroke="${p.horn}" stroke-width="5" stroke-linecap="round"/><path d="M176 368 L164 377 M176 368 L176 380 M176 368 L188 378" stroke="${p.horn}" stroke-width="4" fill="none" stroke-linecap="round"/>`;
    return '';
  }
  function tailSVG(k,p){
    if(k==='spiked') return `<path d="M196 328 Q248 336 264 298 Q272 272 258 256" stroke="${p.body}" stroke-width="14" fill="none" stroke-linecap="round"/><path d="M196 328 Q248 336 264 298 Q272 272 258 256" stroke="${p.stroke}" stroke-width="1.5" fill="none" opacity="0.6"/><polygon points="252,262 268,246 264,268" fill="${p.horn}"/><polygon points="262,290 282,286 266,302" fill="${p.horn}"/><polygon points="238,330 250,350 226,338" fill="${p.horn}"/>`;
    if(k==='fin') return `<path d="M198 332 Q244 342 262 312 Q250 320 264 292 Q246 306 258 278 Q232 300 210 320Z" fill="${p.body}" stroke="${p.stroke}" stroke-width="1.5"/><path d="M214 320 Q240 306 252 284" stroke="${p.ac}" stroke-width="1.5" fill="none" opacity="0.5"/>`;
    if(k==='whip') return `<path d="M198 332 Q256 344 270 302 Q277 280 260 274 Q249 270 254 286 Q257 296 268 292" stroke="${p.dk}" stroke-width="5" fill="none" stroke-linecap="round"/><path d="M198 332 Q256 344 270 302" stroke="${p.stroke}" stroke-width="1" fill="none" opacity="0.5"/>`;
    if(k==='curl') return `<path d="M198 330 Q252 328 256 288 Q258 262 236 262 Q220 262 224 282 Q226 296 242 292" stroke="${p.body}" stroke-width="10" fill="none" stroke-linecap="round"/><path d="M198 330 Q252 328 256 288" stroke="${p.stroke}" stroke-width="1" fill="none" opacity="0.5"/>`;
    if(k==='forked') return `<path d="M198 330 Q246 336 260 302" stroke="${p.body}" stroke-width="11" fill="none" stroke-linecap="round"/><path d="M260 302 L280 286 M260 302 L278 320" stroke="${p.body}" stroke-width="7" fill="none" stroke-linecap="round"/><polygon points="280,286 294,280 282,296" fill="${p.horn}"/><polygon points="278,320 292,324 280,306" fill="${p.horn}"/>`;
    if(k==='bushy') return `<path d="M198 330 Q244 348 262 316 Q272 296 262 276 Q258 300 240 312 Q254 288 240 272 Q234 296 220 314 Q234 300 210 322Z" fill="${p.body}" stroke="${p.stroke}" stroke-width="1.5"/><path d="M216 318 Q238 306 250 288" stroke="${p.ac}" stroke-width="1.2" fill="none" opacity="0.5"/>`;
    if(k==='club') return `<path d="M198 332 Q244 350 256 316" stroke="${p.body}" stroke-width="12" fill="none" stroke-linecap="round"/><circle cx="262" cy="306" r="16" fill="${p.dk}" stroke="${p.stroke}" stroke-width="2"/><polygon points="262,286 256,272 270,274" fill="${p.horn}"/><polygon points="280,304 294,300 278,314" fill="${p.horn}"/><polygon points="256,324 250,340 268,330" fill="${p.horn}"/>`;
    return '';
  }
  function maneSVG(p){ const c=[150,126];const B=[[104,120],[108,98],[124,84],[150,76],[176,84],[192,98],[196,120],[114,142],[186,142]]; return B.map(([x,y])=>{const dx=x-c[0],dy=y-c[1],m=Math.hypot(dx,dy)||1,ax=x+dx/m*16,ay=y+dy/m*16,px=-dy/m*6,py=dx/m*6;return `<polygon points="${(x+px).toFixed(1)},${(y+py).toFixed(1)} ${ax.toFixed(1)},${ay.toFixed(1)} ${(x-px).toFixed(1)},${(y-py).toFixed(1)}" fill="${p.horn}"/>`;}).join(''); }
  function bodySVG(k,p){
    if(k==='segmented'){ const segs=[[150,212,50,32],[150,255,60,40],[150,302,55,40],[150,346,42,30]]; let s2=''; segs.forEach(([x,y,rx,ry])=>{s2+=`<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="${p.body}"/><ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="none" stroke="${p.stroke}" stroke-width="2"/><path d="M${x-rx*0.6} ${y} Q${x} ${y-6} ${x+rx*0.6} ${y}" stroke="${p.ac}" stroke-width="1.2" fill="none" opacity="0.4"/>`;}); return s2; }
    if(k==='furry'){ const d="M100 200 Q150 168 200 200 Q230 245 210 305 Q185 356 150 366 Q115 356 90 305 Q70 245 100 200Z"; const F=[[92,220],[86,258],[92,298],[108,336],[150,362],[192,336],[208,298],[214,258],[208,220],[150,188]]; let fur=''; F.forEach(([x,y])=>{const dx=x-150,dy=y-270,m=Math.hypot(dx,dy)||1,ax=(x+dx/m*17).toFixed(1),ay=(y+dy/m*17).toFixed(1),px=(-dy/m*5).toFixed(1),py=(dx/m*5).toFixed(1);fur+=`<polygon points="${(+x+ +px)},${(+y+ +py)} ${ax},${ay} ${(+x- +px)},${(+y- +py)}" fill="${p.body}" stroke="${p.stroke}" stroke-width="0.8"/>`;}); return `<path d="${d}" fill="${p.body}"/>`+fur+`<path d="${d}" fill="none" stroke="${p.stroke}" stroke-width="2"/><path d="M112 252 Q150 242 188 252" stroke="${p.ac}" stroke-width="1.5" fill="none" opacity="0.5"/><path d="M116 296 Q150 288 184 296" stroke="${p.ac}" stroke-width="1.5" fill="none" opacity="0.4"/>`; }
    if(k==='slime'){ const d="M100 200 Q150 172 200 200 Q228 244 214 296 Q206 322 190 322 Q184 350 170 324 Q160 352 146 326 Q136 354 122 324 Q108 322 94 296 Q76 250 100 200Z"; return `<path d="${d}" fill="${p.body}"/><path d="${d}" fill="none" stroke="${p.stroke}" stroke-width="2"/><ellipse cx="120" cy="352" rx="6" ry="11" fill="${p.body}"/><ellipse cx="150" cy="360" rx="7" ry="13" fill="${p.body}"/><ellipse cx="182" cy="350" rx="5" ry="10" fill="${p.body}"/><ellipse cx="128" cy="238" rx="22" ry="30" fill="${p.core}" opacity="0.12"/><path d="M112 268 Q150 258 190 268" stroke="${p.ac}" stroke-width="1.5" fill="none" opacity="0.5"/>`; }
    if(k==='orb') return `<ellipse cx="150" cy="258" rx="92" ry="86" fill="${p.body}"/><ellipse cx="150" cy="258" rx="92" ry="86" fill="none" stroke="${p.stroke}" stroke-width="2"/><ellipse cx="150" cy="250" rx="60" ry="55" fill="none" stroke="${p.ac}" stroke-width="1.2" opacity="0.4"/><circle cx="116" cy="234" r="8" fill="${p.dk}"/><circle cx="184" cy="246" r="10" fill="${p.dk}"/><circle cx="136" cy="292" r="7" fill="${p.dk}"/><circle cx="178" cy="286" r="6" fill="${p.dk}"/><circle cx="150" cy="228" r="4" fill="${p.ac}" opacity="0.6"/>`;
    if(k==='crystal'){ const pts="150,166 230,216 230,302 150,360 70,302 70,216"; return `<polygon points="${pts}" fill="${p.body}"/><polygon points="${pts}" fill="none" stroke="${p.stroke}" stroke-width="2"/><path d="M150 263 L150 166 M150 263 L230 216 M150 263 L230 302 M150 263 L150 360 M150 263 L70 302 M150 263 L70 216" stroke="${p.ac}" stroke-width="1" opacity="0.35"/><polygon points="150,214 196,240 196,286 150,312 104,286 104,240" fill="none" stroke="${p.ac}" stroke-width="1" opacity="0.4"/>`; }
    if(k==='carapace') return `<ellipse cx="150" cy="252" rx="94" ry="76" fill="${p.body}"/><ellipse cx="150" cy="252" rx="94" ry="76" fill="none" stroke="${p.stroke}" stroke-width="2"/><line x1="150" y1="182" x2="150" y2="324" stroke="${p.stroke}" stroke-width="1.5" opacity="0.55"/><path d="M150 200 Q100 210 96 258 Q98 300 150 314" stroke="${p.ac}" stroke-width="1.2" fill="none" opacity="0.45"/><path d="M150 200 Q200 210 204 258 Q202 300 150 314" stroke="${p.ac}" stroke-width="1.2" fill="none" opacity="0.45"/><circle cx="120" cy="234" r="4" fill="${p.dk}"/><circle cx="180" cy="234" r="4" fill="${p.dk}"/><circle cx="118" cy="280" r="4" fill="${p.dk}"/><circle cx="182" cy="280" r="4" fill="${p.dk}"/>`;
    if(k==='boulder'){ const d="M92 205 Q150 178 208 205 Q236 246 216 306 Q190 356 150 364 Q110 356 84 306 Q64 246 92 205Z"; return `<path d="${d}" fill="${p.body}"/><path d="${d}" fill="none" stroke="${p.stroke}" stroke-width="2.5"/><polygon points="112,226 148,214 176,228 158,250 126,251" fill="${p.dk}"/><polygon points="108,264 146,252 182,264 166,288 128,289" fill="${p.dk}"/><polygon points="116,302 150,290 180,302 162,322 132,321" fill="${p.dk}"/><polygon points="112,226 148,214 176,228 158,250 126,251" fill="none" stroke="${p.ac}" stroke-width="1" opacity="0.4"/>`; }
    const d="M100 200 Q150 168 200 200 Q230 245 210 305 Q185 356 150 366 Q115 356 90 305 Q70 245 100 200Z";
    return `<path d="${d}" fill="${p.body}"/><path d="${d}" fill="none" stroke="${p.stroke}" stroke-width="2"/><path d="M112 236 Q150 226 188 236" stroke="${p.ac}" stroke-width="1.5" fill="none" opacity="0.55"/><path d="M108 270 Q150 258 192 270" stroke="${p.ac}" stroke-width="1.5" fill="none" opacity="0.55"/><path d="M114 302 Q150 292 186 302" stroke="${p.ac}" stroke-width="1.5" fill="none" opacity="0.55"/>`;
  }
  function hornsSVG(k,p){
    if(k==='twin') return `<path d="M126 108 L110 72 L124 110Z" fill="${p.horn}"/><path d="M174 108 L190 72 L176 110Z" fill="${p.horn}"/>`;
    if(k==='crown'){ const S=[[116,-30],[133,-40],[150,-48],[167,-40],[184,-30]]; return S.map(([x,dy])=>`<polygon points="${x-8},110 ${x},${110+dy} ${x+8},110" fill="${p.horn}"/>`).join(''); }
    if(k==='antenna') return `<line x1="150" y1="98" x2="150" y2="56" stroke="${p.ac}" stroke-width="3"/><circle cx="150" cy="53" r="7" fill="${p.eye}"/><circle cx="150" cy="53" r="3" fill="${p.core}"/>`;
    if(k==='antennae') return `<line x1="134" y1="100" x2="120" y2="64" stroke="${p.ac}" stroke-width="3"/><circle cx="120" cy="62" r="6" fill="${p.eye}"/><line x1="166" y1="100" x2="180" y2="64" stroke="${p.ac}" stroke-width="3"/><circle cx="180" cy="62" r="6" fill="${p.eye}"/>`;
    if(k==='fins') return `<path d="M130 102 Q124 74 140 106Z" fill="${p.ac}" opacity="0.85"/><path d="M150 98 Q146 66 156 100Z" fill="${p.stroke}" opacity="0.85"/><path d="M170 102 Q176 74 160 106Z" fill="${p.ac}" opacity="0.85"/>`;
    if(k==='ears') return `<path d="M120 112 L104 76 L130 108Z" fill="${p.body}" stroke="${p.stroke}" stroke-width="1.5"/><path d="M180 112 L196 76 L170 108Z" fill="${p.body}" stroke="${p.stroke}" stroke-width="1.5"/><path d="M122 108 L112 84 L128 106Z" fill="${p.ac}" opacity="0.6"/><path d="M178 108 L188 84 L172 106Z" fill="${p.ac}" opacity="0.6"/>`;
    if(k==='mane') return maneSVG(p);
    return '';
  }
  function headSVG(k,p){
    if(k==='skull') return `<path d="M110 102 Q150 82 190 102 Q200 130 186 152 L168 152 L168 168 L132 168 L132 152 L114 152 Q100 130 110 102Z" fill="${p.dk}"/><path d="M110 102 Q150 82 190 102 Q200 130 186 152 L168 152 L168 168 L132 168 L132 152 L114 152 Q100 130 110 102Z" fill="none" stroke="${p.stroke}" stroke-width="2"/><line x1="150" y1="150" x2="150" y2="166" stroke="${p.stroke}" stroke-width="1.5" opacity="0.5"/>`;
    if(k==='triangle') return `<polygon points="150,90 198,160 102,160" fill="${p.dk}"/><polygon points="150,90 198,160 102,160" fill="none" stroke="${p.stroke}" stroke-width="2"/>`;
    if(k==='flat') return `<rect x="96" y="108" width="108" height="46" rx="22" fill="${p.dk}"/><rect x="96" y="108" width="108" height="46" rx="22" fill="none" stroke="${p.stroke}" stroke-width="2"/><path d="M110 118 L190 118" stroke="${p.ac}" stroke-width="1.5" opacity="0.4"/>`;
    if(k==='square') return `<rect x="106" y="94" width="88" height="72" rx="10" fill="${p.dk}"/><rect x="106" y="94" width="88" height="72" rx="10" fill="none" stroke="${p.stroke}" stroke-width="2"/><path d="M118 108 L182 108" stroke="${p.ac}" stroke-width="1.5" opacity="0.4"/>`;
    if(k==='crystal') return `<polygon points="150,90 192,128 150,170 108,128" fill="${p.dk}"/><polygon points="150,90 192,128 150,170 108,128" fill="none" stroke="${p.stroke}" stroke-width="2"/>`;
    if(k==='insect') return `<ellipse cx="150" cy="126" rx="48" ry="33" fill="${p.dk}"/><ellipse cx="150" cy="126" rx="48" ry="33" fill="none" stroke="${p.stroke}" stroke-width="2"/><path d="M132 152 L124 168 M168 152 L176 168" stroke="${p.horn}" stroke-width="3" stroke-linecap="round"/>`;
    if(k==='beast') return `<ellipse cx="150" cy="128" rx="46" ry="37" fill="${p.dk}"/><ellipse cx="150" cy="128" rx="46" ry="37" fill="none" stroke="${p.stroke}" stroke-width="2"/><path d="M112 116 Q150 106 188 116" stroke="${p.ac}" stroke-width="2" fill="none" opacity="0.5"/>`;
    return `<ellipse cx="150" cy="128" rx="46" ry="37" fill="${p.dk}"/><ellipse cx="150" cy="128" rx="46" ry="37" fill="none" stroke="${p.stroke}" stroke-width="2"/>`;
  }
  function mouthSVG(k,p){
    if(k==='fangs') return `<path d="M132 146 Q150 156 168 146 Q150 151 132 146Z" fill="${p.b}"/><polygon points="138,147 141,160 145,147" fill="${p.core}"/><polygon points="155,147 159,160 162,147" fill="${p.core}"/>`;
    if(k==='grin') return `<path d="M130 146 L138 153 L146 146 L154 153 L162 146 L170 153" stroke="${p.core}" stroke-width="2" fill="none"/>`;
    if(k==='beak') return `<polygon points="140,143 160,143 150,163" fill="${p.horn}" stroke="${p.stroke}" stroke-width="1"/>`;
    if(k==='tusks') return `<ellipse cx="150" cy="147" rx="15" ry="7" fill="${p.b}"/><path d="M137 148 Q132 168 126 179" stroke="${p.core}" stroke-width="5" fill="none" stroke-linecap="round"/><path d="M163 148 Q168 168 174 179" stroke="${p.core}" stroke-width="5" fill="none" stroke-linecap="round"/>`;
    if(k==='tongue') return `<path d="M134 145 Q150 155 166 145 Q150 152 134 145Z" fill="${p.b}"/><path d="M145 150 Q142 170 150 172 Q158 170 155 150Z" fill="${p.stroke}" opacity="0.9"/>`;
    if(k==='sharp') return `<path d="M128 144 L134 156 L140 144 L146 156 L152 144 L158 156 L164 144 L170 156 L172 144" stroke="${p.core}" stroke-width="2" fill="none" stroke-linejoin="round"/>`;
    if(k==='frown') return `<path d="M132 157 Q150 143 168 157" stroke="${p.core}" stroke-width="2.5" fill="none" stroke-linecap="round"/>`;
    return '';
  }
  // ---- glam overlays ----
  function lashesSVG(p){ const l=(x,dir)=>`<path d="M${x} 116 q${dir*10} -8 ${dir*15} -2 M${x+dir*3} 114 q${dir*9} -9 ${dir*14} -4 M${x+dir*6} 113 q${dir*8} -9 ${dir*12} -5" stroke="${p.core}" stroke-width="2" fill="none" stroke-linecap="round"/>`; return l(126,-1)+l(174,1); }
  function blushSVG(p){ return `<ellipse cx="120" cy="138" rx="11" ry="6" fill="${p.eye}" opacity="0.4"/><ellipse cx="180" cy="138" rx="11" ry="6" fill="${p.eye}" opacity="0.4"/>`; }
  function bowSVG(p){ return `<g transform="translate(180 92)"><path d="M0 0 L-22 -12 L-22 12 Z" fill="${p.eye}" stroke="${p.core}" stroke-width="1.5"/><path d="M0 0 L22 -12 L22 12 Z" fill="${p.eye}" stroke="${p.core}" stroke-width="1.5"/><circle cx="0" cy="0" r="6" fill="${p.core}"/></g>`; }
  function flowersSVG(p){ const cols=[p.eye,p.core,p.glow]; const petal=(cx,cy,c)=>{let f='';for(let i=0;i<5;i++){const a=(i/5)*Math.PI*2;f+=`<circle cx="${(cx+Math.cos(a)*5).toFixed(1)}" cy="${(cy+Math.sin(a)*5).toFixed(1)}" r="4" fill="${c}"/>`;}return f+`<circle cx="${cx}" cy="${cy}" r="3" fill="${p.horn}"/>`;}; const spots=[[112,100],[132,90],[150,86],[168,90],[188,100]]; return `<path d="M108 104 Q150 82 192 104" stroke="${p.horn}" stroke-width="2.5" fill="none" opacity="0.5"/>`+spots.map((s,i)=>petal(s[0],s[1],cols[i%3])).join(''); }
  function heartsSVG(p,rnd,anim){ const cols=[p.eye,p.glow,p.core]; let s=''; const n=6; for(let i=0;i<n;i++){ const x=+(40+rnd()*220).toFixed(1),y=+(70+rnd()*250).toFixed(1),sc=+(0.5+rnd()*0.7).toFixed(2),c=cols[i%3],o=+(0.4+rnd()*0.4).toFixed(2),dur=+(3.5+rnd()*3).toFixed(2),beg=+(-rnd()*dur).toFixed(2),rise=+(16+rnd()*20).toFixed(1); const a=anim?`<animateTransform attributeName="transform" type="translate" additive="sum" values="0 0;0 -${rise};0 0" dur="${dur}s" begin="${beg}s" repeatCount="indefinite" calcMode="spline" keySplines="0.4 0 0.6 1;0.4 0 0.6 1" keyTimes="0;0.5;1"/><animate attributeName="opacity" values="${o};${(o*0.3).toFixed(2)};${o}" dur="${dur}s" begin="${beg}s" repeatCount="indefinite"/>`:''; s+=`<g transform="translate(${x} ${y}) scale(${sc})" opacity="${o}">${a}<path d="M0 3 C0 -3 -8 -3 -8 3 C-8 8 0 12 0 12 C0 12 8 8 8 3 C8 -3 0 -3 0 3 Z" fill="${c}"/></g>`; } return s; }
  function backdropSVG(k,p){
    if(k==='anime'){ let rays=''; for(let i=0;i<24;i++){const a=(i/24)*Math.PI*2,x1=(150+Math.cos(a)*70).toFixed(1),y1=(190+Math.sin(a)*70).toFixed(1),x2=(150+Math.cos(a)*300).toFixed(1),y2=(190+Math.sin(a)*300).toFixed(1);rays+=`<polygon points="${x1},${y1} ${x2},${y2} ${(150+Math.cos(a+0.06)*300).toFixed(1)},${(190+Math.sin(a+0.06)*300).toFixed(1)}" fill="${p.core}" opacity="${i%2?0.05:0.09}"/>`;}
      let bok=''; const pts=[[60,90,16],[240,70,22],[210,150,12],[70,230,18],[250,260,14],[110,300,10]]; pts.forEach(([x,y,r])=>{bok+=`<circle cx="${x}" cy="${y}" r="${r}" fill="${p.glow}" opacity="0.14"/><circle cx="${x}" cy="${y}" r="${(r*0.5).toFixed(0)}" fill="${p.core}" opacity="0.1"/>`;});
      return `<rect width="300" height="400" fill="${p.b}" opacity="0.15"/>`+rays+bok; }
    if(k==='lol'){ return `<defs><radialGradient id="__lolg" cx="50%" cy="40%" r="60%"><stop offset="0%" stop-color="${p.glow}" stop-opacity="0.28"/><stop offset="100%" stop-color="${p.glow}" stop-opacity="0"/></radialGradient></defs><rect width="300" height="400" fill="url(#__lolg)"/><path d="M40 360 L40 150 Q40 60 150 40 Q260 60 260 150 L260 360" fill="none" stroke="${p.horn}" stroke-width="3" opacity="0.6"/><path d="M56 360 L56 156 Q56 74 150 56 Q244 74 244 156 L244 360" fill="none" stroke="${p.stroke}" stroke-width="1.2" opacity="0.4"/><circle cx="150" cy="44" r="7" fill="none" stroke="${p.horn}" stroke-width="2" opacity="0.7"/><path d="M150 40 L150 24 M138 30 L162 30" stroke="${p.horn}" stroke-width="2" opacity="0.6"/><path d="M40 150 q-16 -8 -8 -26 M260 150 q16 -8 8 -26" stroke="${p.horn}" stroke-width="2" fill="none" opacity="0.5"/><circle cx="80" cy="110" r="3" fill="${p.glow}" opacity="0.6"/><circle cx="220" cy="110" r="3" fill="${p.glow}" opacity="0.6"/>`; }
    if(k==='cyber'){ let bld=''; const B=[[10,240,40,160],[54,200,34,200],[92,270,30,130],[126,180,26,220],[158,250,34,150],[196,210,30,190],[230,265,32,135],[266,225,28,175]];
      B.forEach(([x,y,w,h],i)=>{bld+=`<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${p.dk}" opacity="0.9"/><rect x="${x}" y="${y}" width="${w}" height="${h}" fill="none" stroke="${p.glow}" stroke-width="0.8" opacity="0.5"/>`; for(let r=0;r<4;r++)for(let c=0;c<2;c++){if((i+r+c)%2)continue;bld+=`<rect x="${x+5+c*(w/2)}" y="${y+8+r*16}" width="4" height="6" fill="${p.eye}" opacity="0.7"/>`;}});
      let rain=''; for(let i=0;i<26;i++){const x=(i*13+7)%300;rain+=`<line x1="${x}" y1="${(i*29)%300}" x2="${x-6}" y2="${(i*29)%300+26}" stroke="${p.stroke}" stroke-width="1" opacity="0.18"/>`;}
      return `<rect width="300" height="400" fill="${p.b}" opacity="0.35"/>`+bld+`<rect x="30" y="70" width="120" height="10" rx="2" fill="${p.eye}" opacity="0.5"/><rect x="180" y="100" width="70" height="8" rx="2" fill="${p.glow}" opacity="0.5"/>`+rain; }
    return '';
  }
  function synthBG(s,p,uid){
    let g='';
    if(s.sun){ const SU='__sun'+uid, SC='__sunclip'+uid; g+=`<defs><linearGradient id="${SU}" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="${p.core}"/><stop offset="55%" stop-color="${p.glow}"/><stop offset="100%" stop-color="${p.ac}"/></linearGradient><clipPath id="${SC}"><circle cx="150" cy="150" r="82"/></clipPath></defs>`;
      g+=`<g clip-path="url(#${SC})"><circle cx="150" cy="150" r="82" fill="url(#${SU})"/>`;
      for(let i=0;i<6;i++){const y=150+i*8+i*i*1.6; g+=`<rect x="60" y="${y.toFixed(1)}" width="180" height="${(3+i*1.3).toFixed(1)}" fill="${p.b}" opacity="0.85"/>`;}
      g+=`</g>`;
    }
    if(s.grid){ const hy=286; let gr=`<line x1="150" y1="${hy}" x2="150" y2="400" stroke="${p.glow}" stroke-width="1.2" opacity="0.55"/>`;
      for(let i=1;i<=6;i++){const x=i*46; gr+=`<line x1="150" y1="${hy}" x2="${150+x}" y2="400" stroke="${p.glow}" stroke-width="1.2" opacity="0.5"/><line x1="150" y1="${hy}" x2="${150-x}" y2="400" stroke="${p.glow}" stroke-width="1.2" opacity="0.5"/>`;}
      for(let i=1;i<=7;i++){const y=hy+Math.pow(i/7,2)*114; gr+=`<line x1="0" y1="${y.toFixed(1)}" x2="300" y2="${y.toFixed(1)}" stroke="${p.glow}" stroke-width="1.2" opacity="${(0.6-i*0.05).toFixed(2)}"/>`;}
      g+=`<rect x="0" y="${hy}" width="300" height="${400-hy}" fill="${p.b}" opacity="0.4"/>`+gr;
    }
    return g;
  }
  function scanSVG(on){ let sc=''; for(let y=0;y<400;y+=4){sc+=`<rect x="0" y="${y}" width="300" height="2" fill="#000" opacity="0.14"/>`;} return `<g>${sc}${on('idle')?`<animateTransform attributeName="transform" type="translate" values="0 0;0 4;0 0" dur="0.5s" repeatCount="indefinite"/>`:''}</g>`; }
  function eyesSVG(k,p){
    const eye=(x,y,r)=>`<ellipse cx="${x}" cy="${y}" rx="${r}" ry="${+(r*0.86).toFixed(1)}" fill="${p.b}"/><ellipse cx="${x}" cy="${y}" rx="${+(r*0.78).toFixed(1)}" ry="${+(r*0.66).toFixed(1)}" fill="${p.eye}"/><circle cx="${x}" cy="${y}" r="${+(r*0.34).toFixed(1)}" fill="${p.core}"/>`;
    if(k==='cyclops') return `<ellipse cx="150" cy="124" rx="27" ry="23" fill="${p.glow}" opacity="0.28"/>`+eye(150,124,19);
    if(k==='swarm') return eye(130,113,7)+eye(150,109,7)+eye(170,113,7)+eye(139,131,6)+eye(161,131,6);
    if(k==='quad') return eye(132,114,8)+eye(168,114,8)+eye(133,134,7)+eye(167,134,7);
    if(k==='angry') return `<path d="M120 110 L143 119 M180 110 L157 119" stroke="${p.horn}" stroke-width="3.5" stroke-linecap="round"/>`+eye(133,125,10)+eye(167,125,10);
    if(k==='sleepy') return `<path d="M120 121 Q132 129 144 121" stroke="${p.core}" stroke-width="2.5" fill="none" stroke-linecap="round"/><path d="M156 121 Q168 129 180 121" stroke="${p.core}" stroke-width="2.5" fill="none" stroke-linecap="round"/><ellipse cx="132" cy="124" rx="4" ry="3" fill="${p.eye}"/><ellipse cx="168" cy="124" rx="4" ry="3" fill="${p.eye}"/>`;
    if(k==='wide') return eye(128,122,15)+eye(172,122,15);
    if(k==='pair') return eye(132,122,11)+eye(168,122,11);
    return eye(130,120,9)+eye(150,111,9)+eye(170,120,9);
  }
  function particlesSVG(n,p,rnd,anim){ const cols=[p.glow,p.ac,p.core,p.eye]; let s=''; for(let i=0;i<n;i++){ const x=+(24+rnd()*252).toFixed(1),y=+(46+rnd()*320).toFixed(1),r=+(1.4+rnd()*2.4).toFixed(1),c=cols[Math.floor(rnd()*cols.length)],o=+(0.35+rnd()*0.4).toFixed(2); const dur=+(3+rnd()*4).toFixed(2),rise=+(10+rnd()*16).toFixed(1),beg=+(-rnd()*dur).toFixed(2); const a=anim?`<animateTransform attributeName="transform" type="translate" values="0 0;0 -${rise};0 0" dur="${dur}s" begin="${beg}s" repeatCount="indefinite" calcMode="spline" keySplines="0.4 0 0.6 1;0.4 0 0.6 1" keyTimes="0;0.5;1"/><animate attributeName="opacity" values="${o};${+(o*0.25).toFixed(2)};${o}" dur="${dur}s" begin="${beg}s" repeatCount="indefinite"/>`:''; s+=`<circle cx="${x}" cy="${y}" r="${r}" fill="${c}" opacity="${o}">${a}</circle>`; } return s; }

  function buildSVG(s){
    const p=THEMES[s.theme]||THEMES.void;
    const rnd=rng(((s.seed>>>0)*2654435761)>>>0);
    const uid=(s.seed>>>0).toString(36)+(s.theme||'');
    const BG='__bg'+uid, GL='__gl'+uid;
    const tim={}; const mk=(k,base)=>{const d=+(base*(0.7+rnd()*0.7)).toFixed(2);const b=+(-rnd()*d).toFixed(2);tim[k]={dur:`dur="${d}s"`,beg:`begin="${b}s"`};};
    ['idle','blink','mouth','wings','tail','belly','leap'].forEach((k,i)=>mk(k,[3.6,4,4,4,1.4,2.8,8][i]));
    const T=(k)=>`${tim[k].dur} ${tim[k].beg}`;
    let g='';
    g+=`<defs><radialGradient id="${BG}" cx="50%" cy="62%" r="72%"><stop offset="0%" stop-color="${p.a}"/><stop offset="100%" stop-color="${p.b}"/></radialGradient>`;
    g+=`<radialGradient id="${GL}" cx="50%" cy="50%" r="55%"><stop offset="0%" stop-color="${p.glow}" stop-opacity="0.45"/><stop offset="100%" stop-color="${p.glow}" stop-opacity="0"/></radialGradient></defs>`;
    g+=`<rect width="300" height="400" fill="url(#${BG})"/>`;
    if(s.backdrop && s.backdrop!=='none') g+=backdropSVG(s.backdrop,p);
    g+=synthBG(s,p,uid);
    const A=s.anims||{}; const on=(k)=>A[k]!==false;
    g+=`<ellipse cx="150" cy="255" rx="128" ry="98" fill="url(#${GL})">${on('idle')?`<animate attributeName="rx" values="128;136;128" ${T('idle')} repeatCount="indefinite"/><animate attributeName="opacity" values="0.85;1;0.85" ${T('idle')} repeatCount="indefinite"/>`:''}</ellipse>`;
    let c='';
    const S=s.sizes||{};
    const bz=(S.body||100)/100; const BCX=150, BCY=258;
    const fx=(ax)=>(bz-1)*(ax-BCX), fy=(ay)=>(bz-1)*(ay-BCY);
    const wrap=(str,cx,cy,key)=>{ const z=(S[key]||100)/100; if(!str||z===1) return str||''; return `<g transform="translate(${cx} ${cy}) scale(${z.toFixed(3)}) translate(${-cx} ${-cy})">${str}</g>`; };
    const stick=(str)=> (!str||bz===1)? (str||'') : `<g transform="translate(${BCX} ${BCY}) scale(${bz.toFixed(3)}) translate(${-BCX} ${-BCY})">${str}</g>`;
    const follow=(str,ax,ay)=>{ if(!str) return ''; const dx=fx(ax),dy=fy(ay); return (Math.abs(dx)>0.01||Math.abs(dy)>0.01)? `<g transform="translate(${dx.toFixed(1)} ${dy.toFixed(1)})">${str}</g>`:str; };
    const piv=(content,px,py,smil)=> `<g transform="translate(${px} ${py})">${smil}<g transform="translate(${-px} ${-py})">${content}</g></g>`;
    if(s.wings){ let w=wrap(wingsSVG(p),150,158,'wings'); if(on('wings')) w=piv(w,150,196,`<animateTransform attributeName="transform" type="scale" additive="sum" values="0.15 1;1 1;1 1;0.55 1;1 1" keyTimes="0;0.14;0.6;0.8;1" ${T('wings')} repeatCount="indefinite" calcMode="spline" keySplines="0.3 0 0.3 1;0 0 1 1;0.4 0 0.6 1;0.4 0 0.6 1"/>`); c+=stick(w); }
    if(s.spikes) c+=stick(wrap(spikesSVG(p),150,245,'spikes'));
    let tail=wrap(tailSVG(s.tail,p),232,300,'tail');
    if(on('tail') && s.tail!=='none') tail=piv(tail,196,326,`<animateTransform attributeName="transform" type="rotate" additive="sum" values="0;12;-6;12;0" keyTimes="0;0.25;0.5;0.75;1" ${T('tail')} repeatCount="indefinite" calcMode="spline" keySplines="0.4 0 0.6 1;0.4 0 0.6 1;0.4 0 0.6 1;0.4 0 0.6 1"/>`);
    c+=follow(tail,214,318);
    c+=follow(wrap(legsSVG(s.legs,p),150,352,'legs'),150,362);
    let bodyStr=wrap(bodySVG(s.body,p),150,258,'body');
    if(on('belly')) bodyStr=piv(bodyStr,150,300,`<animateTransform attributeName="transform" type="scale" additive="sum" values="1 1;1.09 1.06;1 1;1 1" keyTimes="0;0.4;0.72;1" ${T('belly')} repeatCount="indefinite" calcMode="spline" keySplines="0.35 0 0.3 1;0.4 0 0.5 1;0 0 1 1"/>`);
    c+=bodyStr;
    const hd=s.neck===false?50:0;
    const headY=hd+fy(205);
    let head='';
    head+=wrap(hornsSVG(s.horns,p),150,96,'horns');
    head+=wrap(headSVG(s.head,p),150,128,'head');
    let mouth=wrap(mouthSVG(s.mouth,p),150,150,'mouth');
    if(on('mouth') && s.mouth!=='none') mouth=piv(mouth,150,148,`<animateTransform attributeName="transform" type="scale" additive="sum" values="1 1;1 1;1 2.3;1 1;1 1" keyTimes="0;0.34;0.42;0.5;1" ${T('mouth')} repeatCount="indefinite" calcMode="spline" keySplines="0.4 0 0.6 1;0.5 0 0.5 1;0.5 0 0.5 1;0.4 0 0.6 1"/>`);
    head+=mouth;
    let eyes=wrap(eyesSVG(s.eyes,p),150,122,'eyes');
    if(on('blink') && s.eyes!=='sleepy') eyes=piv(eyes,150,122,`<animateTransform attributeName="transform" type="scale" additive="sum" values="1 1;1 1;1 0.08;1 1;1 1;1 1;1 0.08;1 1;1 1" keyTimes="0;0.24;0.27;0.3;0.62;0.66;0.69;0.72;1" ${T('blink')} repeatCount="indefinite"/>`);
    head+=eyes;
    if(s.lashes) head+=lashesSVG(p);
    if(s.blush) head+=blushSVG(p);
    if(s.bow) head+=bowSVG(p);
    if(s.flowers) head+=flowersSVG(p);
    if(on('leap') && s.neck!==false) head=piv(head,150,128,`<animateTransform attributeName="transform" type="translate" additive="sum" values="0 0;0 0;0 -46;0 -52;0 -12;0 0;0 0" keyTimes="0;0.58;0.68;0.76;0.9;0.96;1" ${T('leap')} repeatCount="indefinite" calcMode="spline" keySplines="0.4 0 0.6 1;0.2 0 0.2 1;0.4 0 0.6 1;0.5 0 0.5 1;0.6 0 0.4 1;0 0 1 1"/><animateTransform attributeName="transform" type="rotate" additive="sum" values="0;0;0;360;360;360" keyTimes="0;0.6;0.66;0.84;0.9;1" ${T('leap')} repeatCount="indefinite" calcMode="spline" keySplines="0 0 1 1;0 0 1 1;0.3 0 0.3 1;0 0 1 1;0 0 1 1"/>`);
    let neck='';
    if(s.neck!==false){ const nstr=`<path d="M126 205 Q131 162 150 140 Q169 162 174 205" fill="${p.dk}"/>`; neck=on('leap')?piv(nstr,150,205,`<animateTransform attributeName="transform" type="scale" additive="sum" values="1 1;1 1;1 1.7;1 1.9;1 1.2;1 1;1 1" keyTimes="0;0.58;0.68;0.76;0.9;0.96;1" ${T('leap')} repeatCount="indefinite" calcMode="spline" keySplines="0.4 0 0.6 1;0.2 0 0.2 1;0.4 0 0.6 1;0.5 0 0.5 1;0.6 0 0.4 1;0 0 1 1"/>`):nstr; }
    c+=Math.abs(headY)>0.01?`<g transform="translate(0 ${headY.toFixed(1)})">${neck}${head}</g>`:(neck+head);
    if(on('idle')) c=`<g><animateTransform attributeName="transform" type="translate" values="0 0;0 -5;0 0" ${T('idle')} repeatCount="indefinite" calcMode="spline" keySplines="0.4 0 0.6 1;0.4 0 0.6 1" keyTimes="0;0.5;1"/><g transform="translate(0 366)"><g transform="translate(0 -366)"><animateTransform attributeName="transform" type="scale" additive="sum" values="1 1;1.03 0.97;1 1" ${T('idle')} repeatCount="indefinite" calcMode="spline" keySplines="0.4 0 0.6 1;0.4 0 0.6 1" keyTimes="0;0.5;1"/>${c}</g></g></g>`;
    g+=c;
    g+=particlesSVG(s.particleCount,p,rnd,on('particles'));
    if(s.hearts) g+=heartsSVG(p,rnd,on('particles'));
    if(s.scan) g+=scanSVG(on);
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 400" width="300" height="400">${g}</svg>`;
  }

  const norm = (s) => String(s||'').toLowerCase().replace(/[^a-z0-9]/g,'');
  const byNick = {};
  rosterList.forEach((r,i)=>{
    const [name,theme,body,head,eyes,horns,legs,mouth,tail,flags='',ov]=r;
    const sizes=Object.assign({body:100,head:100,horns:100,eyes:100,mouth:100,legs:100,tail:100,wings:100,spikes:100},ov||{});
    const rand=rng((100003+i*7919)>>>0);
    const anims={idle:rand()<0.9,blink:rand()<0.85,mouth:rand()<0.7,leap:rand()<0.5,wings:rand()<0.85,tail:rand()<0.85,belly:rand()<0.55,particles:rand()<0.85};
    const fem=FEMME.includes(name);
    const glam=fem?{lashes:true,blush:rand()<0.85,bow:rand()<0.55,flowers:rand()<0.55,hearts:rand()<0.6}:{lashes:false,blush:false,bow:false,flowers:false,hearts:false};
    byNick[norm(name)]=Object.assign({name,theme,body,head,eyes,horns,legs,mouth,tail,wings:flags.includes('w'),spikes:flags.includes('s'),neck:!flags.includes('n'),anims,sizes,particleCount:4+(i%7),seed:100003+i*7919},glam);
  });

  const cache = {};
  const OV_KEY = "monsterOverrides_v1";
  function loadOverrides(){ try{ return JSON.parse(localStorage.getItem(OV_KEY)||"{}")||{}; }catch(e){ return {}; } }
  let overrides = loadOverrides();
  function getOverride(nick){ return overrides[norm(nick)] || null; }
  function setOverride(nick, params){ overrides[norm(nick)] = params; try{ localStorage.setItem(OV_KEY, JSON.stringify(overrides)); }catch(e){} delete cache[norm(nick)]; }
  function clearOverride(nick){ delete overrides[norm(nick)]; try{ localStorage.setItem(OV_KEY, JSON.stringify(overrides)); }catch(e){} delete cache[norm(nick)]; }
  function paramsFor(nick){
    const k = norm(nick);
    if (overrides[k]) return overrides[k];
    if (byNick[k]) return byNick[k];
    return randomParams(rng(hashStr(k)+1), nick);
  }
  function svgFor(nick){ return buildSVG(paramsFor(nick)); }
  function svgUriFor(nick){
    const k = norm(nick);
    if (cache[k]) return cache[k];
    const uri = 'data:image/svg+xml,' + encodeURIComponent(svgFor(nick));
    cache[k] = uri;
    return uri;
  }
  function uriOfParams(s){ return 'data:image/svg+xml,' + encodeURIComponent(buildSVG(s)); }
  function randomFor(nick){ return randomParams(Math.random, nick); }

  window.Monsters = { svgFor, svgUriFor, uriOfParams, paramsFor, getOverride, setOverride, clearOverride, randomFor, buildSVG, THEMES,
    OPTIONS: { bodies, heads, eyesL, hornsL, legsL, mouthsL, tailsL, backdrops:['none','anime','lol','cyber'] } };
})();
