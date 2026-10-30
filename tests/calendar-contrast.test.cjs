'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{createRequire}=require('node:module');
const requireLab=createRequire(path.resolve(__dirname,'../lab/workspace/package.json')),{JSDOM}=requireLab('jsdom'),CSSOM=requireLab('rrweb-cssom'),tree=requireLab('css-tree'),{calculate,compare}=requireLab('specificity');
const root=path.resolve(__dirname,'..');
function cascade(t,{palette,theme,width=1280,beforeFix=false}={}){
 const dom=new JSDOM('<!doctype html><html data-theme="'+theme+'" data-palette="'+palette+'"><body data-surface="workspace"><main><button class="calendar-cell"><strong>29</strong><small>11:00 Firma de escritura</small></button><button class="agenda-week-event secondary"><strong>11:00 – 12:30</strong><span>Firma de escritura</span><small>Confirmada</small></button></main></body></html>');t.after(()=>dom.window.close());
 const rules=[];let order=0;
 function walk(list){for(const rule of list){if(rule.type===1){const ast=tree.parse(rule.selectorText,{context:'selectorList'});ast.children.forEach(selector=>{const text=tree.generate(selector);rules.push({selector:text,specificity:calculate(text),style:rule.style,order:order++});});}else if(rule.type===4){const media=rule.conditionText||rule.media.mediaText,max=media.match(/max-width\s*:\s*(\d+)px/),min=media.match(/min-width\s*:\s*(\d+)px/);if((!max||width<=+max[1])&&(!min||width>=+min[1]))walk(rule.cssRules);}}}
 for(const file of ['web/workspace/workspace.css','web/shell/navigation.css','web/theme/theme.css']){let css=fs.readFileSync(path.join(root,file),'utf8');if(beforeFix&&file.endsWith('theme.css'))css=css.split('/* Calendar cells have their own surfaces;')[0];walk(CSSOM.parse(css).cssRules);}
 const doc=dom.window.document;
 function winning(el,properties){let winner;for(const rule of rules){let matches;try{matches=el.matches(rule.selector);}catch{matches=false;}if(!matches)continue;for(const property of properties){const value=rule.style.getPropertyValue(property);if(!value)continue;const candidate={...rule,value,important:rule.style.getPropertyPriority(property)==='important'};if(!winner||candidate.important&&!winner.important||candidate.important===winner.important&&(compare(candidate.specificity,winner.specificity)>0||compare(candidate.specificity,winner.specificity)===0&&candidate.order>=winner.order))winner=candidate;}}return winner?.value||'';}
 function resolve(value,depth=0){if(depth>20)throw Error('VARIABLE_CYCLE');return value.replace(/var\((--[\w-]+)\)/g,(_,name)=>resolve(winning(doc.documentElement,[name]),depth+1)).trim();}
 function color(el){const value=winning(el,['color']);return value&&value!=='inherit'?resolve(value):el.parentElement?color(el.parentElement):'#000000';}
 function background(el){const value=resolve(winning(el,['background','background-color']));return value&&!['transparent','none','initial','inherit'].includes(value)?value:el.parentElement?background(el.parentElement):'#ffffff';}
 return {doc,color,background,property:(el,p)=>resolve(winning(el,[p]))};
}
function luminance(hex){assert.match(hex,/^#[0-9a-f]{6}$/i);const v=hex.slice(1).match(/../g).map(c=>parseInt(c,16)/255).map(c=>c<=.04045?c/12.92:((c+.055)/1.055)**2.4);return v[0]*.2126+v[1]*.7152+v[2]*.0722;}
function ratio(a,b){const [high,low]=[luminance(a),luminance(b)].sort((a,b)=>b-a);return(high+.05)/(low+.05);}
test('reproduces the calendar button specificity collision seen in the screenshot',t=>{
 const css=cascade(t,{palette:'green',theme:'dark',beforeFix:true}),cell=css.doc.querySelector('.calendar-cell'),text=cell.querySelector('small');assert.equal(css.background(cell),'#b9e4c7');assert.ok(ratio(css.color(text),css.background(text))<4.5);
});
test('actual calendar cascade preserves readable labels in both palettes, appearances and viewport sizes',t=>{
 for(const palette of ['green','indigo'])for(const theme of ['light','dark'])for(const width of [1280,390]){
  const css=cascade(t,{palette,theme,width}),cell=css.doc.querySelector('.calendar-cell');
  for(const state of ['normal','outside','today','selected']){cell.className='calendar-cell'+(state==='outside'?' outside':state==='today'?' today':'');cell.setAttribute('aria-pressed',String(state==='selected'));for(const node of [cell,cell.querySelector('strong'),cell.querySelector('small')])assert.ok(ratio(css.color(node),css.background(node))>=4.5,[palette,theme,width,state,node.tagName,css.color(node),css.background(node)].join(' '));assert.equal(css.property(cell,'opacity'),'1');assert.ok(parseFloat(css.property(cell.querySelector('small'),'font-size'))>=11);}
  for(const node of css.doc.querySelectorAll('.agenda-week-event strong,.agenda-week-event span,.agenda-week-event small'))assert.ok(ratio(css.color(node),css.background(node))>=4.5,[palette,theme,width,'week',node.tagName].join(' '));
 }
});
