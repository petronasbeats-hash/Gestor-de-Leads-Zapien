'use strict';
(() => {
  if(window.SynapseTheme)return;
  const key='synapse.theme.v1',paletteKey='synapse.palette.v1',allowed=['system','light','dark'],palettes=['indigo','green'],root=document.documentElement;
  const media=typeof window.matchMedia==='function'?window.matchMedia('(prefers-color-scheme: dark)'):null;
  let preference='system',palette='indigo';
  try{const saved=window.localStorage.getItem(key);if(allowed.includes(saved))preference=saved;}catch{}
  try{const saved=window.localStorage.getItem(paletteKey);if(palettes.includes(saved))palette=saved;}catch{}
  function resolved(){return preference==='system'?(media?.matches?'dark':'light'):preference;}
  function apply(){
    const theme=resolved();root.dataset.theme=theme;root.dataset.themePreference=preference;root.dataset.palette=palette;root.style.colorScheme=theme;
    for(const select of document.querySelectorAll('[data-synapse-theme]'))select.value=preference;
    for(const select of document.querySelectorAll('[data-synapse-palette]'))select.value=palette;
    const meta=document.querySelector('meta[name="theme-color"]');if(meta)meta.content=palette==='green'?(theme==='dark'?'#10191b':'#f6f5ef'):(theme==='dark'?'#111521':'#f5f5fa');
    window.dispatchEvent(new CustomEvent('synapse:themechange',{detail:{preference,theme,palette}}));
  }
  function setPreference(value){if(!allowed.includes(value))return false;preference=value;try{window.localStorage.setItem(key,value);}catch{}apply();return true;}
  function setPalette(value){if(!palettes.includes(value))return false;palette=value;try{window.localStorage.setItem(paletteKey,value);}catch{}apply();return true;}
  window.SynapseTheme=Object.freeze({getPreference:()=>preference,getResolvedTheme:resolved,getPalette:()=>palette,setPreference,setPalette});
  apply();
  const systemChanged=()=>{if(preference==='system')apply();};
  if(media?.addEventListener)media.addEventListener('change',systemChanged);else media?.addListener?.(systemChanged);
  window.addEventListener('storage',event=>{if(![key,paletteKey,null].includes(event.key))return;if(event.key===key||event.key===null)preference=allowed.includes(event.newValue)?event.newValue:'system';if(event.key===paletteKey||event.key===null)palette=palettes.includes(event.newValue)?event.newValue:'indigo';apply();});
  function mount(){
    if(document.querySelector('[data-synapse-theme]'))return;
    const footer=document.querySelector('.synapse-rail-footer'),publicBar=document.querySelector('.public-topbar'),header=document.querySelector('body[data-role="customer"]>header');
    const host=footer||publicBar||header;if(!host)return;
    const label=document.createElement('label');label.className='theme-control';
    const title=document.createElement('span');title.textContent='Apariencia';
    const select=document.createElement('select');select.dataset.synapseTheme='';select.setAttribute('aria-label','Tema Synapse');
    for(const [value,text]of [['system','Sistema'],['light','Claro'],['dark','Oscuro']]){const option=document.createElement('option');option.value=value;option.textContent=text;select.append(option);}
    select.value=preference;select.addEventListener('change',()=>setPreference(select.value));label.append(title,select);
    const colors=document.createElement('label');colors.className='theme-control';const colorsTitle=document.createElement('span');colorsTitle.textContent='Color';
    const colorsSelect=document.createElement('select');colorsSelect.dataset.synapsePalette='';colorsSelect.setAttribute('aria-label','Paleta Synapse');
    for(const [value,text]of [['indigo','Índigo'],['green','Verde']]){const option=document.createElement('option');option.value=value;option.textContent=text;colorsSelect.append(option);}
    colorsSelect.value=palette;colorsSelect.addEventListener('change',()=>setPalette(colorsSelect.value));colors.append(colorsTitle,colorsSelect);
    const group=document.createElement('div');group.className='theme-settings';group.append(label,colors);
    if(footer)footer.prepend(group);else host.append(group);
    apply();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
})();
