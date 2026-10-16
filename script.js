"use strict";

/* ============================================================
   CONSTANTS
   ============================================================ */
const MONTHS = ['January','February','March','April','May','June',
                'July','August','September','October','November','December'];

const MM_PER_INCH = 25.4;
const MATERIALS = [
  {value:'metrie-half-4x8', label:'Metrie sanded birch plywood — 1/2 in, 4 × 8 ft', category:'Birch plywood', thicknessMm:12.7, sheetWidthMm:1219.2, sheetLengthMm:2438.4, priceCad:52.98, priceSource:'User-provided Home Depot screenshot, 2026-10-15', url:'https://www.homedepot.ca/search?q=Metrie%201%2F2%20sanded%20birch%20plywood%204%20x%208'},
  {value:'columbia-three-quarter-2x8', label:'Columbia birch plywood — 3/4 in, 2 × 8 ft', category:'Birch plywood', thicknessMm:19.05, sheetWidthMm:609.6, sheetLengthMm:2438.4, priceCad:72.75, priceSource:'User-provided Home Depot screenshot, 2026-10-15', url:'https://www.homedepot.ca/search?q=Columbia%203%2F4%20birch%20plywood%202%20x%208'},
  {value:'metrie-pine-three-quarter-4x8', label:'Metrie Premium Pine Plywood ACX — 3/4 in, 4 × 8 ft', category:'Pine plywood', thicknessMm:19.05, sheetWidthMm:1219.2, sheetLengthMm:2438.4, priceCad:106.00, priceSource:'User-provided listing, 2026-10-15', url:'https://www.homedepot.ca/search?q=Metrie%20Premium%20Pine%20Plywood%20ACX%203%2F4%20inch%204%20ft%20x%208%20ft'}
];

/* default screw spacing (mm) — 50% of the default outer depth
   (default cavityD = 340, ply = 12.7  →  oD = 365.4) */
const SCREW_SPACING_DEFAULT = 182.7;
// SVG page-coordinate offsets for manually positioning the isometric view.
const ISO_VIEW_OFFSET = {x:0, y:0};

const DEFAULTS = {
  cavityW: 330,
  cavityD: 368.3,
  cavityH: 330,
  material: 'metrie-pine-three-quarter-4x8',
  ply:     19.05,
  legD:    40,
  legH:    10,
  screwSpacing: SCREW_SPACING_DEFAULT,
  units:   'mm',
  author:  'Taulant Sulko',
  header:  'MODULAR CABINET',
  subheader: 'STACKABLE VINYL STORAGE',
  titleFront: 'FRONT',
  titleSide:  'RIGHT SIDE',
  titleTop:   'ISOMETRIC VIEW',
  titleBottom:'BOTTOM — LEG & SCREW POSITIONS'
};

/* short URL key  →  state key (numbers — always stored in mm) */
const URL_NUM_KEYS = {
  cw: 'cavityW',
  cd: 'cavityD',
  ch: 'cavityH',
  t:  'ply',
  ld: 'legD',
  lh: 'legH',
  ss: 'screwSpacing'
};

/* short URL key  →  state key (text labels) */
const URL_TXT_KEYS = {
  m:  'material',
  au: 'author',
  h:  'header',
  sh: 'subheader',
  ft: 'titleFront',
  st: 'titleSide',
  tt: 'titleTop',
  bt: 'titleBottom'
};

/* ============================================================
   STATE
   ============================================================ */
const state = Object.assign({}, DEFAULTS);

function materialLabel(){
  const material = MATERIALS.find(function(item){ return item.value === state.material; });
  return material ? material.label : MATERIALS[0].label;
}

function selectedMaterial(){
  return MATERIALS.find(function(item){ return item.value === state.material; }) || MATERIALS[0];
}

function panelAreaMm2(){
  return panelAreaBreakdownMm2().total;
}

function panelAreaBreakdownMm2(){
  const t = state.ply;
  const outerW = state.cavityW + 2*t;
  const outerD = state.cavityD;
  return {
    topBottom: 2*outerW*outerD,
    sides: 2*outerD*state.cavityH,
    total: 2*outerW*outerD + 2*outerD*state.cavityH
  };
}

function makePanelRectangles(){
  const t = state.ply;
  const outerW = state.cavityW + 2*t;
  const outerD = state.cavityD;
  return [
    {width:outerW, height:outerD, part:'TOP'},
    {width:outerW, height:outerD, part:'BOTTOM'},
    {width:outerD, height:state.cavityH, part:'SIDE'},
    {width:outerD, height:state.cavityH, part:'SIDE'}
  ].sort(function(a, b){
    return Math.max(b.width, b.height) - Math.max(a.width, a.height);
  });
}

function packCabinetRows(rows, rectangles, sheetWidth, sheetLength, kerf){
  for (let i=0; i<rectangles.length; i++){
    const piece = rectangles[i];
    const row = rows.length ? rows[rows.length-1] : null;
    const orientations = [
      {width:piece.width+kerf, height:piece.height+kerf},
      {width:piece.height+kerf, height:piece.width+kerf}
    ].sort(function(a, b){ return a.height - b.height; });
    let placed = false;

    if (row){
      for (let j=0; j<orientations.length; j++){
        const choice = orientations[j];
        if (row.usedWidth + choice.width <= sheetWidth + kerf &&
            row.y + Math.max(row.height, choice.height) <= sheetLength + kerf){
          row.panels.push({
            x:row.usedWidth, y:row.y,
            width:choice.width-kerf, height:choice.height-kerf,
            part:piece.part
          });
          row.usedWidth += choice.width;
          row.height = Math.max(row.height, choice.height);
          row.panelCount++;
          placed = true;
          break;
        }
      }
    }

    if (placed) continue;

    const y = row ? row.y + row.height : 0;
    for (let j=0; j<orientations.length; j++){
      const choice = orientations[j];
      if (choice.width <= sheetWidth + kerf && y + choice.height <= sheetLength + kerf){
        rows.push({
          y:y, usedWidth:choice.width, height:choice.height, panelCount:1,
          panels:[{
            x:0, y:y, width:choice.width-kerf, height:choice.height-kerf,
            part:piece.part
          }]
        });
        placed = true;
        break;
      }
    }

    if (!placed) return false;
  }
  return rows;
}

function sheetPackingEstimate(){
  const material = selectedMaterial();
  const kerf = 3.2;
  let rows = [];
  let count = 0;
  const pieces = makePanelRectangles();
  while (count < 100){
    const next = packCabinetRows(rows.map(function(row){
      return Object.assign({}, row, {panels:row.panels.map(function(panel){ return Object.assign({}, panel); })});
    }),
      pieces, material.sheetWidthMm, material.sheetLengthMm, kerf);
    if (!next) break;
    rows = next;
    count++;
  }
  return {
    cabinetCount:count,
    rows:rows,
    panels:rows.reduce(function(all, row){ return all.concat(row.panels); }, [])
  };
}

function sheetYield(){
  return sheetPackingEstimate().cabinetCount;
}

function sheetWasteMm2(){
  const material = selectedMaterial();
  const yieldCount = sheetYield();
  if (yieldCount === 0) return null;
  return material.sheetWidthMm * material.sheetLengthMm - yieldCount * panelAreaMm2();
}

function sheetWastePercent(){
  const material = selectedMaterial();
  const sheetArea = material.sheetWidthMm * material.sheetLengthMm;
  const waste = sheetWasteMm2();
  return waste === null ? null : waste / sheetArea * 100;
}

function formatArea(areaMm2){
  const squareMmPerUnit = state.units === 'in' ? MM_PER_INCH * MM_PER_INCH : 1;
  return fmt(areaMm2 / squareMmPerUnit) + (state.units === 'in' ? ' in²' : ' mm²');
}

function materialCostPerUnit(){
  const material = selectedMaterial();
  const yieldCount = sheetYield();
  if (material.priceCad === null || yieldCount === 0 ||
      Math.abs(state.ply - material.thicknessMm) > 0.001) return null;
  return material.priceCad / yieldCount;
}

/* ============================================================
   NUMBER / FRACTION UTILITIES
   ============================================================ */
function gcd(a, b){ return b ? gcd(b, a % b) : a; }

function decimalToFraction(v, denom){
  v = Math.round(v * denom) / denom;
  const whole = Math.floor(v);
  let num = Math.round((v - whole) * denom);
  let den = denom;
  if (num === 0) return String(whole);
  if (num === den) return String(whole + 1);
  const g = gcd(num, den);
  num /= g; den /= g;
  if (whole === 0) return num + '/' + den;
  return whole + ' ' + num + '/' + den;
}

function parseFraction(str){
  str = String(str).trim();
  let m = str.match(/^(\d+)\s+(\d+)\s*\/\s*(\d+)$/);
  if (m) return parseInt(m[1],10) + parseInt(m[2],10)/parseInt(m[3],10);
  m = str.match(/^(\d+)\s*\/\s*(\d+)$/);
  if (m) return parseInt(m[1],10) / parseInt(m[2],10);
  const v = parseFloat(str);
  return isFinite(v) ? v : NaN;
}

const fmt = v => {
  const r = Math.round(v*100)/100;
  if (Number.isInteger(r)) return String(r);
  if (Math.abs(r*10 - Math.round(r*10)) < 1e-9) return r.toFixed(1);
  return r.toFixed(2);
};

function formatValue(v_mm){
  if (state.units === 'in') return decimalToFraction(v_mm / MM_PER_INCH, 16);
  return fmt(v_mm);
}

function disp(v_mm){ return formatValue(v_mm); }
function unitAbbr(){ return state.units === 'in' ? 'IN' : 'MM'; }
function unitLower(){ return state.units === 'in' ? 'in' : 'mm'; }

function parseInput(str){
  str = String(str).trim().replace(/\s*(mm|in|"|')\s*$/i, '').trim();
  if (!str) return NaN;
  if (state.units === 'in'){
    const inches = parseFraction(str);
    return isFinite(inches) ? inches * MM_PER_INCH : NaN;
  }
  return parseFloat(str);
}

const clampNum = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

/* ============================================================
   SCREW SPACING — validation & fallback
   ============================================================ */
/* Geometry constraints for a valid screw spacing:
   each screw must sit at least (ply + 5 mm) inside the front / back
   edge of the side panel, so the screw head never splits the panel. */
function spacingLimits(){
  const t  = state.ply;
  const oD = state.cavityD;
  const margin = t + 5;
  const minSpacing = Math.max(20, 2*margin);
  const maxSpacing = Math.max(minSpacing, oD - 2*margin);
  return {min:minSpacing, max:maxSpacing, oD:oD};
}

function isValidSpacing(v){
  if (!isFinite(v) || v <= 0) return false;
  const lim = spacingLimits();
  return v >= lim.min && v <= lim.max;
}

/* Stored fallback when a user input is out of scope:
   prefer the fixed default, otherwise half the outer depth. */
function fallbackSpacing(){
  if (isValidSpacing(SCREW_SPACING_DEFAULT)) return SCREW_SPACING_DEFAULT;
  const lim = spacingLimits();
  return Math.round(lim.oD * 0.5);
}

/* Effective value used by the drawing */
function resolvedSpacing(){
  const v = state.screwSpacing;
  if (isValidSpacing(v)) return v;
  return fallbackSpacing();
}

/* ============================================================
   URL PARAMETERS
   ============================================================ */
function readURLParams(){
  const params = new URLSearchParams(window.location.search);

  const u = params.get('u');
  if (u === 'in' || u === 'mm') state.units = u;

  for (const short in URL_NUM_KEYS){
    if (!params.has(short)) continue;
    const v = parseFloat(params.get(short));
    if (isFinite(v)) state[URL_NUM_KEYS[short]] = v;
  }

  for (const short in URL_TXT_KEYS){
    const v = params.get(short);
    if (v !== null) state[URL_TXT_KEYS[short]] = v;
  }

  if (!MATERIALS.some(function(material){ return material.value === state.material; })) state.material = DEFAULTS.material;
}

function writeURLParams(){
  const params = new URLSearchParams();
  if (state.units !== DEFAULTS.units) params.set('u', state.units);

  for (const short in URL_NUM_KEYS){
    const key = URL_NUM_KEYS[short];
    if (state[key] !== DEFAULTS[key]) params.set(short, fmt(state[key]));
  }
  for (const short in URL_TXT_KEYS){
    const key = URL_TXT_KEYS[short];
    if (state[key] !== DEFAULTS[key]) params.set(short, state[key]);
  }

  const qs = params.toString();
  const url = window.location.pathname + (qs ? '?' + qs : '') + window.location.hash;
  try { history.replaceState(null, '', url); } catch(e){ /* ignore */ }
}

let urlDebounce;
function scheduleURLWrite(){
  clearTimeout(urlDebounce);
  urlDebounce = setTimeout(function(){
    writeURLParams();
    updateURLLength();
  }, 180);
}

function updateURLLength(){
  const el = document.getElementById('url-length');
  if (!el) return;
  const len = window.location.href.length;
  const num = el.querySelector('.num');
  if (num) num.textContent = len.toLocaleString();
  el.classList.toggle('warn', len > 1800);
}

/* ============================================================
   PANEL TOGGLE
   ============================================================ */
(function initToggle(){
  const app = document.getElementById('app');
  const tab = document.getElementById('tab');

  if (window.matchMedia('(max-width: 760px)').matches){
    app.classList.remove('panel-open');
  }

  function syncTab(){
    const open = app.classList.contains('panel-open');
    tab.innerHTML = open ? '&#8250;' : '&#8249;';
    tab.setAttribute('aria-expanded', String(open));
    tab.setAttribute('aria-label', open ? 'Hide parameters' : 'Show parameters');
    tab.setAttribute('title',      open ? 'Hide parameters' : 'Show parameters');
  }

  tab.addEventListener('click', function(){
    app.classList.toggle('panel-open');
    syncTab();
  });

  window.addEventListener('keydown', function(e){
    if (e.key === '[' && !/input|textarea|select/i.test(document.activeElement.tagName)){
      app.classList.toggle('panel-open');
      syncTab();
    }
  });

  syncTab();
})();

/* ============================================================
   SVG HELPERS
   ============================================================ */
const esc = s => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
const escAttr = s => String(s)
  .replace(/&/g,'&amp;').replace(/"/g,'&quot;')
  .replace(/</g,'&lt;').replace(/>/g,'&gt;');

function E(tag, attrs){
  let a = '';
  for (const k in attrs){
    const v = attrs[k];
    if (v === null || v === undefined) continue;
    a += ' ' + k + '="' + v + '"';
  }
  return '<' + tag + a + '/>';
}
function EL(tag, attrs, inner){
  let a = '';
  for (const k in attrs){
    const v = attrs[k];
    if (v === null || v === undefined) continue;
    a += ' ' + k + '="' + v + '"';
  }
  return '<' + tag + a + '>' + inner + '</' + tag + '>';
}
function T(x, y, str, o){
  o = o || {};
  const a = {
    x: x, y: y,
    'font-family': 'Arial, Helvetica, sans-serif',
    'font-size': o.size || 13,
    'text-anchor': o.anchor || 'start',
    'fill': '#000'
  };
  if (o.weight) a['font-weight'] = o.weight;
  if (o.ls) a['letter-spacing'] = o.ls;
  if (o.rotate) a['transform'] = 'rotate(' + o.rotate + ' ' + x + ' ' + y + ')';
  return EL('text', a, esc(str));
}
function L(x1,y1,x2,y2,w,dash){
  const a = {x1:x1,y1:y1,x2:x2,y2:y2,stroke:'#000','stroke-width':(w===undefined?1:w)};
  if (dash) a['stroke-dasharray'] = dash;
  return E('line', a);
}
function R(x,y,w,h,sw,dash,fill){
  const a = {x:x,y:y,width:w,height:h,fill:fill||'none',stroke:'#000','stroke-width':(sw===undefined?1:sw)};
  if (dash) a['stroke-dasharray'] = dash;
  return E('rect', a);
}
function C(cx,cy,r,sw,dash){
  const a = {cx:cx,cy:cy,r:r,fill:'none',stroke:'#000','stroke-width':(sw===undefined?1:sw)};
  if (dash) a['stroke-dasharray'] = dash;
  return E('circle', a);
}
const EXT = (x1,y1,x2,y2) => L(x1,y1,x2,y2,0.7);

function dimH(x1,x2,y,label,o){
  o = o || {};
  const sz = o.size || 12.5;
  let g = L(x1,y,x2,y,1);
  g += L(x1-5,y+5,x1+5,y-5,1.8);
  g += L(x2-5,y+5,x2+5,y-5,1.8);
  const ty = o.below ? y + sz + 6 : y - 6;
  g += T((x1+x2)/2, ty, label, {size:sz, anchor:'middle'});
  return g;
}
function dimV(y1,y2,x,label,o){
  o = o || {};
  const sz = o.size || 12.5;
  let g = L(x,y1,x,y2,1);
  g += L(x-5,y1+5,x+5,y1-5,1.8);
  g += L(x-5,y2+5,x+5,y2-5,1.8);
  const tx = o.right ? x + 7 : x - 7;
  g += T(tx, (y1+y2)/2 + 4, label, {size:sz, anchor: o.right ? 'start' : 'end'});
  return g;
}
const arrowR = (x,y) => E('path',{d:'M'+x+','+y+' l-9,-4 l0,8 Z', fill:'#000'});
const arrowL = (x,y) => E('path',{d:'M'+x+','+y+' l9,-4 l0,8 Z',  fill:'#000'});

function screwMark(mx,my,r){
  r = r || 5;
  return C(mx,my,r,1.1,'3 2') +
         L(mx-(r+3),my,mx+(r+3),my,0.6) +
         L(mx,my-(r+3),mx,my+(r+3),0.6);
}

function todayFormatted(){
  const d = new Date();
  return d.getDate() + ' ' + MONTHS[d.getMonth()] + ' ' + d.getFullYear();
}

function frontFaceGeometry(width, height, thickness){
  return R(0,0,width,height,2.2) +
         L(0,thickness,width,thickness,1.2) +
         L(0,height-thickness,width,height-thickness,1.2) +
         L(thickness,thickness,thickness,height-thickness,1.2) +
         L(width-thickness,thickness,width-thickness,height-thickness,1.2);
}

function sideFaceGeometry(depth, height, thickness){
  return R(0,0,depth,height,2.2,null,'#fff') +
         L(0,thickness,depth,thickness,1.2) +
         L(0,height-thickness,depth,height-thickness,1.2);
}

/* ============================================================
   RENDER
   ============================================================ */
function render(){

  const t     = state.ply;
  const cw    = state.cavityW;
  const cd    = state.cavityD;
  const ch    = state.cavityH;
  const legD  = state.legD;
  const legH  = Math.max(0, state.legH);

  const oW = cw + 2*t;
  const oD = cd;
  const oH = ch + 2*t;

  /* ---- screw positions — centred on the side panel thickness,
         symmetric about the panel mid-depth, spacing is parametric ---- */
  const spacing = resolvedSpacing();
  const screwX1 = t/2;
  const screwX2 = oW - t/2;
  const screwY1 = (oD - spacing) / 2;
  const screwY2 = (oD + spacing) / 2;

  let legInset = legD/2 + 15;
  const maxInset = (Math.min(oW, oD) - legD)/2 - 2;
  if (legInset > maxInset) legInset = Math.max(legD/2, maxInset);

  const cells = {
    front : {x:20,  y:128, w:600, h:562},
    side  : {x:630, y:128, w:600, h:562},
    top   : {x:20,  y:700, w:600, h:562},
    bottom: {x:630, y:700, w:600, h:562}
  };

  const maxW = Math.max(oW, oD);
  const maxH = Math.max(oH + legH, oD);
  const s = Math.min(430/maxW, 385/maxH);

  const vh1 = oH + legH;
  const ty1 = cells.front.y + (cells.front.h - vh1*s)/2;

  const txF = cells.front.x  + (cells.front.w  - oW*s)/2;
  const txS = cells.side.x   + (cells.side.w   - oD*s)/2;
  const txB = cells.bottom.x + (cells.bottom.w - oW*s)/2;

  const P = [];

  P.push(
    '<defs>' +
      '<pattern id="hatch" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">' +
        '<line x1="0" y1="0" x2="0" y2="8" stroke="#000" stroke-width="0.55" stroke-opacity="0.30"/>' +
      '</pattern>' +
      '<pattern id="cut-top" width="8" height="8" patternUnits="userSpaceOnUse">' +
        '<line x1="0" y1="0" x2="8" y2="8" stroke="#000" stroke-width="0.55"/>' +
      '</pattern>' +
      '<pattern id="cut-bottom" width="8" height="8" patternUnits="userSpaceOnUse">' +
        '<line x1="8" y1="0" x2="0" y2="8" stroke="#000" stroke-width="0.55"/>' +
      '</pattern>' +
      '<pattern id="cut-side" width="7" height="7" patternUnits="userSpaceOnUse">' +
        '<circle cx="3.5" cy="3.5" r="0.7" fill="#000"/>' +
      '</pattern>' +
    '</defs>'
  );

  /* TITLE BLOCK */
  P.push(
    T(40, 48, state.header, {size:22, weight:'bold', ls:'0.8'}),
    T(40, 70, state.subheader + ' · BY ' + state.author.toUpperCase(), {size:12.5, ls:'1'}),
    T(40, 90, 'MATERIAL: ' + selectedMaterial().category.toUpperCase() + ' · THICKNESS: ' + disp(t) + ' ' + unitAbbr() + ' · JOINERY: SCREWS FROM TOP & BOTTOM FACES · OPEN BACK',
      {size:11.5}),
    T(1200, 48, todayFormatted(), {size:12, anchor:'end', weight:'bold'}),
    T(1200, 68, 'UNITS: ' + unitAbbr(), {size:11, anchor:'end'}),
    T(1200, 86, 'SHEET 1 OF 1', {size:11, anchor:'end'}),
    L(40, 100, 1200, 100, 2)
  );

  /* FRONT ELEVATION */
  {
    const X = v => txF + v*s;
    const Y = v => ty1 + v*s;
    let g = '';

    g += '<g transform="translate(' + txF + ' ' + ty1 + ')">' +
         frontFaceGeometry(oW*s,oH*s,t*s) + '</g>';

    if (legH > 0){
      g += R(X(legInset-legD/2), Y(oH), legD*s, legH*s, 1.8);
      g += R(X(oW-legInset-legD/2), Y(oH), legD*s, legH*s, 1.8);
      g += L(X(-52), Y(oH+legH), X(oW+52), Y(oH+legH), 2.2);
    } else {
      g += L(X(-52), Y(oH), X(oW+52), Y(oH), 2.2);
    }

    g += EXT(X(0), Y(0), X(0), Y(0)-40);
    g += EXT(X(oW), Y(0), X(oW), Y(0)-40);
    g += dimH(X(0), X(oW), Y(0)-34, disp(oW));

    g += EXT(X(t), Y(t), X(t), Y(0)-74);
    g += EXT(X(oW-t), Y(t), X(oW-t), Y(0)-74);
    g += dimH(X(t), X(oW-t), Y(0)-68, disp(cw) + ' INT.');

    g += EXT(X(0), Y(0), X(0)-52, Y(0));
    g += EXT(X(0), Y(oH), X(0)-52, Y(oH));
    g += dimV(Y(0), Y(oH), X(0)-46, disp(oH));

    g += L(X(oW*0.55), Y(t/2), X(oW)+26, Y(0)-12, 0.8);
    g += C(X(oW*0.55), Y(t/2), 2, 1);
    g += T(X(oW)+30, Y(0)-8, 'T = ' + disp(t) + ' ' + unitAbbr(), {size:11.5});

    if (legH > 0){
      const lx = X(legInset + legD/2) + 32;
      g += EXT(X(legInset+legD/2), Y(oH), lx+10, Y(oH));
      g += EXT(X(legInset+legD/2), Y(oH+legH), lx+10, Y(oH+legH));
      g += dimV(Y(oH), Y(oH+legH), lx, disp(legH));

      const by = Y(oH+legH) + 32;
      g += EXT(X(legInset-legD/2), Y(oH+legH), X(legInset-legD/2), by+6);
      g += EXT(X(legInset+legD/2), Y(oH+legH), X(legInset+legD/2), by+6);
      g += dimH(X(legInset-legD/2), X(legInset+legD/2), by, 'Ø' + disp(legD));
    }

    P.push(g);
    P.push(T(cells.front.x + cells.front.w/2, Y(0) - 95,
      state.titleFront, {size:14.5, weight:'bold', anchor:'middle', ls:'1.6'}));
  }

  /* SIDE ELEVATION */
  {
    const X = v => txS + v*s;
    const Y = v => ty1 + v*s;
    let g = '';

    g += '<g transform="translate(' + txS + ' ' + ty1 + ')">' +
         sideFaceGeometry(oD*s,oH*s,t*s) + '</g>';

    if (legH > 0){
      g += R(X(legInset-legD/2), Y(oH), legD*s, legH*s, 1.8);
      g += R(X(oD-legInset-legD/2), Y(oH), legD*s, legH*s, 1.8);
      g += L(X(-52), Y(oH+legH), X(oD+52), Y(oH+legH), 2.2);
    } else {
      g += L(X(-52), Y(oH), X(oD+52), Y(oH), 2.2);
    }

    g += L(X(-62), Y(0)-68, X(0)-14, Y(0)-68, 1.2) + arrowR(X(0)-6, Y(0)-68);
    g += T(X(-66), Y(0)-64, 'FRONT', {size:11, anchor:'end'});
    g += L(X(oD)+62, Y(0)-68, X(oD)+14, Y(0)-68, 1.2) + arrowL(X(oD)+6, Y(0)-68);
    g += T(X(oD)+66, Y(0)-64, 'BACK', {size:11});

    g += EXT(X(0), Y(0), X(0), Y(0)-40);
    g += EXT(X(oD), Y(0), X(oD), Y(0)-40);
    g += dimH(X(0), X(oD), Y(0)-34, disp(oD));

    g += EXT(X(0), Y(0), X(0)-52, Y(0));
    g += EXT(X(0), Y(oH), X(0)-52, Y(oH));
    g += dimV(Y(0), Y(oH), X(0)-46, disp(oH));

    if (legH > 0){
      const lx = X(legInset + legD/2) + 32;
      g += EXT(X(legInset+legD/2), Y(oH), lx+10, Y(oH));
      g += EXT(X(legInset+legD/2), Y(oH+legH), lx+10, Y(oH+legH));
      g += dimV(Y(oH), Y(oH+legH), lx, disp(legH));
    }

    P.push(g);
    P.push(T(cells.side.x + cells.side.w/2, Y(0) - 95,
      state.titleSide, {size:14.5, weight:'bold', anchor:'middle', ls:'1.6'}));
  }

  /* ISOMETRIC VIEW */
  {
    const cell = cells.top;
    const angle = Math.PI / 6;
    const cos = Math.cos(angle), sin = Math.sin(angle);
    const projectedWidth = (oW + oD) * cos;
    const projectedHeight = (oW + oD) * sin + oH;
    const plot = {
      x: cell.x + 30,
      y: cell.y + 72,
      w: cell.w - 60,
      h: cell.h - 100
    };
    const isoScale = Math.min(plot.w / projectedWidth, plot.h / projectedHeight);
    const cx = plot.x + plot.w/2 + ISO_VIEW_OFFSET.x;
    const cy = plot.y + plot.h/2 + ISO_VIEW_OFFSET.y;
    const frontTopLeftX = cx + (oD-oW)*cos*isoScale/2;
    const frontTopLeftY = cy - projectedHeight*isoScale/2;
    const frontMatrix = [
      cos*isoScale, sin*isoScale, 0, isoScale,
      frontTopLeftX - cos*oD*isoScale,
      frontTopLeftY + sin*oD*isoScale
    ];
    const sideMatrix = [
      -cos*isoScale, sin*isoScale, 0, isoScale,
      frontTopLeftX + cos*oW*isoScale,
      frontTopLeftY + sin*oW*isoScale
    ];
    const topMatrix = [
      cos*isoScale, sin*isoScale, -cos*isoScale, sin*isoScale,
      frontTopLeftX, frontTopLeftY
    ];
    let g = '';

    g += '<g transform="matrix(' + topMatrix.join(' ') + ')">' +
         R(0,0,oW,oD,2.2,null,'#fff') + '</g>';
    g += '<g transform="matrix(' + sideMatrix.join(' ') + ')">' +
         sideFaceGeometry(oD,oH,t) + '</g>';
    g += '<g transform="matrix(' + frontMatrix.join(' ') + ')">' +
         frontFaceGeometry(oW,oH,t) + '</g>';

    const topPoint = (x,y) => ({
      x: topMatrix[0]*x + topMatrix[2]*y + topMatrix[4],
      y: topMatrix[1]*x + topMatrix[3]*y + topMatrix[5]
    });
    [screwX1,screwX2].forEach(function(x){
      [screwY1,screwY2].forEach(function(y){
        const p = topPoint(x,y);
        g += screwMark(p.x,p.y,1.5);
      });
    });

    P.push(g);
    P.push(T(cell.x + cell.w/2, cell.y + 28,
      state.titleTop, {size:14.5, weight:'bold', anchor:'middle', ls:'1.6'}));
  }

  /* BOTTOM PLAN */
  {
    const bottomScale = Math.min(s, (cells.bottom.h-152)/Math.max(oW,oD));
    const bottomX = cells.bottom.x + (cells.bottom.w - oD*bottomScale)/2;
    const bottomY = cells.bottom.y + 100;
    const X = v => bottomX + v*bottomScale;
    const Y = v => bottomY + v*bottomScale;
    let g = '';

    g += R(X(0), Y(0), oD*s, oW*s, 2.2);
    g += R(X(0), Y(0), oD*s, t*s, 0, null, 'url(#hatch)');
    g += R(X(0), Y(oW-t), oD*s, t*s, 0, null, 'url(#hatch)');
    g += L(X(0), Y(t), X(oD), Y(t), 1, '8 5');
    g += L(X(0), Y(oW-t), X(oD), Y(oW-t), 1, '8 5');

    const legPts = [
      [legInset, legInset],
      [oW-legInset, legInset],
      [legInset, oD-legInset],
      [oW-legInset, oD-legInset]
    ];
    legPts.forEach(function(p){
      const px = X(p[1]), py = Y(p[0]);
      g += C(px, py, (legD/2)*bottomScale, 2);
      g += L(px-18, py, px+18, py, 0.6);
      g += L(px, py-18, px, py+18, 0.6);
    });

    g += screwMark(X(screwY1), Y(screwX1));
    g += screwMark(X(screwY2), Y(screwX1));
    g += screwMark(X(screwY1), Y(screwX2));
    g += screwMark(X(screwY2), Y(screwX2));

    g += T(X((screwY1+screwY2)/2), Y(oW/2), 'S2 ×4',
      {size:11, weight:'bold', anchor:'middle'});

    g += EXT(X(0), Y(0), X(0), Y(0)-40);
    g += EXT(X(oD), Y(0), X(oD), Y(0)-40);
    g += dimH(X(0), X(oD), Y(0)-34, disp(oD));

    g += EXT(X(0), Y(0), X(0)-52, Y(0));
    g += EXT(X(0), Y(oW), X(0)-52, Y(oW));
    g += dimV(Y(0), Y(oW), X(0)-46, disp(oW));

    const legLabelX = X(legInset + legD/2) + 12;
    const legLabelY = Y(0) + 40;
    const legLabel = 'LEG Ø' + disp(legD) + ' × ' + disp(legH);
    const leaderX = legLabelX - 4;
    const leaderY = legLabelY + 3;
    g += L(X(legInset), Y(legInset), leaderX, leaderY, 0.9);
    g += C(X(legInset), Y(legInset), 2, 1);
    g += R(legLabelX-3, legLabelY-11, 116, 15, 0, null, '#fff');
    g += T(legLabelX, legLabelY, legLabel, {size:10.5});

    const screwDimY = Y(oW) + 36;
    const screwPoints = [0, screwY1, screwY2, oD];
    screwPoints.forEach(function(depth){
      g += EXT(X(depth), Y(oW), X(depth), screwDimY+6);
    });
    g += dimH(X(0), X(screwY1), screwDimY, disp(screwY1));
    g += dimH(X(screwY1), X(screwY2), screwDimY, disp(screwY2-screwY1));
    g += dimH(X(screwY2), X(oD), screwDimY, disp(oD-screwY2));

    P.push(g);
    P.push(T(cells.bottom.x + cells.bottom.w/2, cells.bottom.y + 28,
      state.titleBottom, {size:14.5, weight:'bold', anchor:'middle', ls:'1.6'}));
  }

  /* SHEET CUT LAYOUT */
  {
    const bx = 20, by = 1272, bw = 610, bh = 210;
    let g = '';
    g += R(bx, by, bw, bh, 1.5);
    g += L(bx, by+30, bx+bw, by+30, 1.5);
    const material = selectedMaterial();
    const layout = sheetPackingEstimate();
    const diagramX = bx + 18;
    const diagramY = by + 42;
    const scale = Math.min(280/material.sheetLengthMm, 150/material.sheetWidthMm);
    const diagramW = material.sheetLengthMm * scale;
    const diagramH = material.sheetWidthMm * scale;
    g += T(bx+14, by+21, 'SHEET CUT LAYOUT · ' + material.label.toUpperCase(), {size:12.5, weight:'bold'});
    g += R(diagramX, diagramY, diagramW, diagramH, 1.2, null, '#fff');

    layout.panels.forEach(function(panel){
      const x = diagramX + panel.y * scale;
      const y = diagramY + panel.x * scale;
      const w = panel.height * scale;
      const h = panel.width * scale;
      const pattern = panel.part === 'TOP' ? 'cut-top' :
        (panel.part === 'BOTTOM' ? 'cut-bottom' : 'cut-side');
      g += R(x, y, w, h, 0.7, null, 'url(#' + pattern + ')');
      if (w > 24 && h > 12){
        g += T(x+w/2, y+h/2+2, panel.part, {size:7, anchor:'middle'});
      }
    });

    const legendX = bx + 322;
    let legendY = by + 55;
    [
      ['cut-top','TOP PANEL ×1'],
      ['cut-bottom','BOTTOM PANEL ×1'],
      ['cut-side','SIDE PANELS ×2']
    ].forEach(function(item){
      g += R(legendX, legendY-9, 14, 10, 0.7, null, 'url(#' + item[0] + ')');
      g += T(legendX+20, legendY, item[1], {size:10.5});
      legendY += 19;
    });
    g += T(legendX, legendY+1, layout.cabinetCount + ' CABINET SET(S) · ' +
      layout.panels.length + ' PANELS', {size:10.5, weight:'bold'});
    g += T(legendX, legendY+19, 'SHEET ' + formatValue(material.sheetWidthMm) + ' × ' +
      formatValue(material.sheetLengthMm) + ' ' + unitAbbr(), {size:10});
    g += T(legendX, legendY+36, 'Layout includes 3.2 mm saw kerf.', {size:9.5});
    g += T(legendX, legendY+52, 'Screw locations shown in bottom view.', {size:9.5});

    P.push(g);
  }

  /* CUT LIST */
  {
    const bx = 650, by = 1272, bw = 570, bh = 210;
    let g = '';
    g += R(bx, by, bw, bh, 1.5);
    g += L(bx, by+30, bx+bw, by+30, 1.5);
    g += T(bx+14, by+21, 'CUT LIST — ' + selectedMaterial().category.toUpperCase() + ' · ' + disp(t) + ' ' + unitAbbr() + ' THICK', {size:12.5, weight:'bold'});

    const cx = [bx+16, bx+64, bx+318, bx+368];
    const header = ['ITEM','PART','QTY','SIZE (' + unitAbbr() + ')'];

    let yy = by + 52;
    header.forEach(function(h,i){
      g += T(cx[i], yy, h, {size:11, weight:'bold'});
    });
    g += L(bx+10, yy+7, bx+bw-10, yy+7, 0.8);

    const cabinetYield = sheetYield();
    const rows = [
      ['1','TOP PANEL',   String(cabinetYield), disp(oW)+' × '+disp(oD)+' × '+disp(t)],
      ['2','BOTTOM PANEL',String(cabinetYield), disp(oW)+' × '+disp(oD)+' × '+disp(t)],
      ['3','SIDE PANEL',  String(cabinetYield*2), disp(oD)+' × '+disp(ch)+' × '+disp(t)],
      ['4','LEG (DOWEL)', String(cabinetYield*4), 'Ø'+disp(legD)+' × '+disp(legH)]
    ];

    yy += 26;
    rows.forEach(function(r){
      r.forEach(function(c,i){
        g += T(cx[i], yy, c, {size:11});
      });
      yy += 22;
    });

    g += L(bx+10, yy-8, bx+bw-10, yy-8, 0.8);
    const material = selectedMaterial();
    g += T(bx+16, yy+12,
      'ESTIMATED PACKED YIELD: ' + sheetYield() + ' CABINET(S) PER ' +
      formatValue(material.sheetWidthMm) + ' × ' + formatValue(material.sheetLengthMm) + ' ' + unitAbbr() + ' SHEET',
      {size:11, weight:'bold'});
    g += T(bx+16, yy+30,
      'ALL EDGES TO BE SANDED 120 / 220 GRIT. APPLY CLEAR FINISH ×2 COATS.',
      {size:10.5});

    P.push(g);
  }

  document.getElementById('dwg').innerHTML = P.join('');
}

/* ============================================================
   CONTROL PANEL
   ============================================================ */
const CONTROLS = [
  {key:'cavityW', label:'Cavity width (X)',  min:150, max:700, unit:'mm'},
  {key:'cavityD', label:'Cavity depth (Y)',  min:150, max:700, unit:'mm'},
  {key:'cavityH', label:'Cavity height (Z)', min:100, max:700, unit:'mm'},
  {key:'legD',    label:'Leg diameter',      min:15,  max:120, unit:'mm'},
  {key:'legH',    label:'Leg height',        min:0,   max:250, unit:'mm'},
  {key:'screwSpacing', label:'Screw spacing', min:20, max:600, unit:'mm', note:'distance between the two screws, measured along the depth'}
];

const PLY_PRESETS = [
  {v:6.35, l:'1/4 in — 6.35 mm'},
  {v:12.7, l:'1/2 in — 12.7 mm'},
  {v:19.05, l:'3/4 in — 19.05 mm'}
];

const LABEL_FIELDS = [
  {id:'label-author', key:'author', label:'Author'},
  {id:'label-hdr', key:'header',      label:'Header'},
  {id:'label-sub', key:'subheader',   label:'Sub-header'},
  {id:'label-ft',  key:'titleFront',  label:'Front view title'},
  {id:'label-st',  key:'titleSide',   label:'Side view title'},
  {id:'label-tt',  key:'titleTop',    label:'Isometric view title'},
  {id:'label-bt',  key:'titleBottom', label:'Bottom view title'}
];

function buildPanel(){
  const panel = document.getElementById('panel');
  let h = '';

  h += '<h1 class="panel-title">Parameters</h1>';
  h += '<p class="panel-sub">Adjust live — drawing regenerates instantly</p>';

  /* units */
  h += '<div class="unit-row">' +
         '<label for="unit-select">Units</label>' +
         '<select id="unit-select">' +
           '<option value="mm"' + (state.units==='mm'?' selected':'') + '>Millimetres (mm)</option>' +
           '<option value="in"' + (state.units==='in'?' selected':'') + '>Inches (in) — fractions ok</option>' +
         '</select>' +
       '</div>';

  /* material */
  h += '<div class="ctl">' +
         '<div class="ctl-head"><span>Plywood type</span></div>' +
         '<select id="material-select">';
  MATERIALS.forEach(function(material){
    h += '<option value="' + material.value + '"' +
         (state.material === material.value ? ' selected' : '') + '>' +
         material.label + ' — $' + material.priceCad.toFixed(2) + ' CAD</option>';
  });
  h += '</select></div>';

  /* material thickness */
  h += '<div class="ctl">' +
         '<div class="ctl-head"><span>Material thickness</span>' +
         '<span class="val" id="ply-val"></span></div>' +
         '<select id="ply-preset">';
  PLY_PRESETS.forEach(function(p){
    h += '<option value="' + p.v + '"' + (Math.abs(p.v - state.ply) < 0.001 ? ' selected' : '') + '>' +
         p.l + '</option>';
  });
  h += '<option value="custom">Custom…</option></select>' +
       '<div class="ctl-row" style="margin-top:8px">' +
         '<input type="range" id="ply-range" min="6" max="40" step="0.05" value="' + state.ply + '">' +
         '<input class="num-inp" type="text" inputmode="text" id="ply-num" value="">' +
       '</div></div>';

  /* numeric */
  CONTROLS.forEach(function(c){
    h += '<div class="ctl">' +
           '<div class="ctl-head"><span>' + c.label + '</span>' +
           '<span class="val" id="' + c.key + '-val"></span></div>' +
           '<div class="ctl-row">' +
             '<input type="range" id="' + c.key + '-range" min="' + c.min + '" max="' + c.max +
               '" step="1" value="' + state[c.key] + '">' +
             '<input class="num-inp" type="text" inputmode="text" id="' + c.key + '-num" value="">' +
           '</div>' +
           (c.note ? '<div class="field-note" id="' + c.key + '-note">' + c.note + '</div>' : '') +
         '</div>';
  });

  h += '<div class="section">Computed</div>';
  h += '<div class="readout" id="readout"></div>';

  h += '<div class="btn-row">' +
         '<button class="action" id="btn-reset">Reset</button>' +
         '<button class="action" id="btn-print">Print / PDF</button>' +
       '</div>';
  h += '<div class="btn-row">' +
         '<button class="action" id="btn-share">Copy Share Link</button>' +
       '</div>';

  h += '<div class="section">Labels</div>';
  LABEL_FIELDS.forEach(function(f){
    h += '<div class="ctl">' +
           '<div class="ctl-head"><span>' + f.label + '</span></div>' +
           '<input class="txt" type="text" id="' + f.id + '" value="' + escAttr(state[f.key]) + '">' +
         '</div>';
  });

  h += '<div class="hint">' +
         'Parameters are mirrored in the URL. Share the link to restore the exact drawing.' +
         '<br><br>' +
         '<code>?u=</code>mm|in · <code>?cw=</code> <code>?cd=</code> <code>?ch=</code> cavity<br>' +
         '<code>?m=</code> material · <code>?t=</code> thickness · <code>?ld=</code> leg Ø · <code>?lh=</code> leg H<br>' +
         '<code>?ss=</code> screw spacing<br>' +
         '<code>?h=</code> <code>?sh=</code> header · <code>?ft=</code> <code>?st=</code> <code>?tt=</code> <code>?bt=</code> titles' +
       '</div>' +
       '<div class="url-length" id="url-length">' +
         '<span>URL length</span><span class="num">—</span>' +
       '</div>';

  panel.innerHTML = h;
  wirePanel();
}

function wirePanel(){
  /* numeric sliders + inputs (includes screwSpacing) */
  ['cavityW','cavityD','cavityH','legD','legH','screwSpacing'].forEach(function(k){
    const r = document.getElementById(k + '-range');
    const n = document.getElementById(k + '-num');
    if (r) r.addEventListener('input', function(){
      state[k] = parseFloat(r.value);
      sync();
    });
    if (n) n.addEventListener('change', function(){
      const v = parseInput(n.value);
      if (isFinite(v)) state[k] = v;
      sync();
    });
  });

  /* material thickness */
  const pr = document.getElementById('ply-range');
  const pn = document.getElementById('ply-num');
  const ps = document.getElementById('ply-preset');

  function setPly(v){
    state.ply = clampNum(v, 6, 40);
    sync();
  }

  if (pr) pr.addEventListener('input', function(){ setPly(parseFloat(pr.value)); });
  if (pn) pn.addEventListener('change', function(){
    const v = parseInput(pn.value);
    if (isFinite(v)) setPly(v); else sync();
  });
  if (ps) ps.addEventListener('change', function(){
    if (ps.value === 'custom') return;
    setPly(parseFloat(ps.value));
  });

  const ms = document.getElementById('material-select');
  if (ms) ms.addEventListener('change', function(){
    state.material = ms.value;
    state.ply = selectedMaterial().thicknessMm;
    sync();
  });

  /* units */
  const us = document.getElementById('unit-select');
  if (us) us.addEventListener('change', function(){
    state.units = us.value;
    sync();
  });

  /* labels */
  LABEL_FIELDS.forEach(function(f){
    const el = document.getElementById(f.id);
    if (el) el.addEventListener('input', function(){
      state[f.key] = el.value;
      render();
      scheduleURLWrite();
    });
  });

  /* buttons */
  const btnR = document.getElementById('btn-reset');
  if (btnR) btnR.addEventListener('click', function(){
    Object.assign(state, DEFAULTS);
    buildPanel();
    sync();
  });

  const btnP = document.getElementById('btn-print');
  if (btnP) btnP.addEventListener('click', function(){ window.print(); });

  const btnS = document.getElementById('btn-share');
  if (btnS) btnS.addEventListener('click', function(){
    const url = window.location.href;
    const done = function(){
      const old = btnS.textContent;
      btnS.textContent = 'Copied!';
      btnS.disabled = true;
      setTimeout(function(){
        btnS.textContent = old;
        btnS.disabled = false;
      }, 1400);
    };
    if (navigator.clipboard && navigator.clipboard.writeText){
      navigator.clipboard.writeText(url).then(done).catch(function(){ fallbackCopy(url, done); });
    } else {
      fallbackCopy(url, done);
    }
  });
}

function fallbackCopy(text, done){
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.position = 'fixed';
  ta.style.opacity = '0';
  document.body.appendChild(ta);
  ta.select();
  try { document.execCommand('copy'); done(); } catch(e){ /* ignore */ }
  document.body.removeChild(ta);
}

/* ============================================================
   SYNC / READOUT
   ============================================================ */
function sync(){
  /* ---- screw spacing constraint (must run before render) ---- */
  if (!isValidSpacing(state.screwSpacing)){
    state.screwSpacing = fallbackSpacing();
  }

  /* numeric controls */
  ['cavityW','cavityD','cavityH','legD','legH','screwSpacing'].forEach(function(k){
    const r = document.getElementById(k + '-range');
    const n = document.getElementById(k + '-num');
    const l = document.getElementById(k + '-val');
    if (r && document.activeElement !== r) r.value = state[k];
    if (n && document.activeElement !== n) n.value = formatValue(state[k]);
    if (l) l.textContent = formatValue(state[k]) + ' ' + unitLower();
  });

  /* screw spacing helper note — show allowable range */
  const note = document.getElementById('screwSpacing-note');
  if (note){
    const lim = spacingLimits();
    note.textContent = 'distance between the two screws · allowed ' +
                       formatValue(lim.min) + '–' + formatValue(lim.max) + ' ' + unitLower();
    note.classList.remove('warn');
  }

  const pr = document.getElementById('ply-range');
  const pn = document.getElementById('ply-num');
  const pl = document.getElementById('ply-val');
  if (pr && document.activeElement !== pr) pr.value = state.ply;
  if (pn && document.activeElement !== pn) pn.value = formatValue(state.ply);
  if (pl) pl.textContent = formatValue(state.ply) + ' ' + unitLower();

  /* thickness preset select */
  const ps = document.getElementById('ply-preset');
  if (ps){
    const match = PLY_PRESETS.find(function(p){ return Math.abs(p.v - state.ply) < 0.001; });
    ps.value = match ? String(match.v) : 'custom';
  }

  /* unit select */
  const us = document.getElementById('unit-select');
  if (us) us.value = state.units;

  const ms = document.getElementById('material-select');
  if (ms) ms.value = state.material;

  render();
  updateReadout();
  scheduleURLWrite();
}

function updateReadout(){
  const t  = state.ply;
  const cw = state.cavityW, cd = state.cavityD, ch = state.cavityH;
  const oW = cw + 2*t, oD = cd, oH = ch + 2*t;
  const legH = Math.max(0, state.legH);
  const spacing = resolvedSpacing();
  const screwY1 = (oD - spacing) / 2;

  const el = document.getElementById('readout');
  if (!el) return;

  const u = ' ' + unitLower();
  const row = (k, v) => '<div><span class="k">' + k + '</span><span class="v">' + v + '</span></div>';

  el.innerHTML =
    row('Material',           materialLabel()) +
    row('Listing thickness', formatValue(selectedMaterial().thicknessMm) + u) +
    row('Exterior W × D × H', formatValue(oW) + ' × ' + formatValue(oD) + ' × ' + formatValue(oH) + u) +
    row('Interior cavity',    formatValue(cw) + ' × ' + formatValue(cd) + ' × ' + formatValue(ch) + u) +
    row('Overall height + legs', formatValue(oH + legH) + u) +
    row('1 module stack pitch', formatValue(oH + legH) + u) +
    row('4-module stack height', formatValue((oH + legH) * 4) + u) +
    row('Material thickness', formatValue(t) + u) +
    row('Sheet size', formatValue(selectedMaterial().sheetWidthMm) + ' × ' + formatValue(selectedMaterial().sheetLengthMm) + u) +
    row('Sheet price', selectedMaterial().priceCad === null ? 'Not available' : '$' + selectedMaterial().priceCad.toFixed(2) + ' CAD') +
    row('Home Depot', '<a href="' + selectedMaterial().url + '" target="_blank" rel="noopener">Search ' + materialLabel() + '</a>') +
    row('Top / bottom panel area', formatArea(panelAreaBreakdownMm2().topBottom)) +
    row('Side panel area', formatArea(panelAreaBreakdownMm2().sides)) +
    row('Total panel surface area', formatArea(panelAreaMm2())) +
    row('Estimated sheet yield', sheetYield() === 0 ? 'Panels do not fit on one sheet' : sheetYield() + ' cabinet(s), packed layout estimate') +
    row('Panel layout by row', sheetPackingEstimate().rows.map(function(row){ return row.panelCount; }).join(' + ') + ' panels') +
    row('Estimated area left over', sheetWasteMm2() === null ? 'Not applicable' : formatArea(sheetWasteMm2()) + ' (' + fmt(sheetWastePercent()) + '%; includes kerf/offcuts)') +
    row('Estimated material cost / unit', materialCostPerUnit() === null ? 'Unavailable for current thickness' : '$' + materialCostPerUnit().toFixed(2) + ' CAD') +
    row('Leg',                'Ø' + formatValue(state.legD) + ' × ' + formatValue(legH) + u) +
    row('Screw spacing',      formatValue(spacing) + u) +
    row('Screw front offset', formatValue(screwY1) + u) +
    '<div class="field-note">Yield uses a 2D rectangle-packing estimate with 3.2 mm saw kerf and allows panel rotation. Actual cutting layout and offcuts may change usable yield; remaining area is estimated, not a cut plan.</div>';
}

/* ============================================================
   BOOT
   ============================================================ */
readURLParams();
buildPanel();
sync();
writeURLParams();
updateURLLength();
