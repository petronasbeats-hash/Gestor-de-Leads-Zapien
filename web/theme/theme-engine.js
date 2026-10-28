'use strict';
(() => {
  if(window.SynapseTheme)return;
  const key='synapse.theme.v1',allowed=['system','light','dark'],root=document.documentElement;
  const media=typeof window.matchMedia==='function'?window.matchMedia('(prefers-color-scheme: dark)'):null;
  let preference='system';
  try{const saved=window.localStorage.getItem(key);if(allowed.includes(saved))preference=saved;}catch{}
  function resolved(){return preference==='system'?(media?.matches?'dark':'light'):preference;}
  function apply(){
    const theme=resolved();root.dataset.theme=theme;root.dataset.themePreference=preference;root.style.colorScheme=theme;
    for(const select of document.querySelectorAll('[data-synapse-theme]'))select.value=preference;
    const meta=document.querySelector('meta[name="theme-color"]');if(meta)meta.content=theme==='dark'?'#111521':'#f5f5fa';
    window.dispatchEvent(new CustomEvent('synapse:themechange',{detail:{preference,theme}}));
  }
  function setPreference(value){if(!allowed.includes(value))return false;preference=value;try{window.localStorage.setItem(key,value);}catch{}apply();return true;}
  window.SynapseTheme=Object.freeze({getPreference:()=>preference,getResolvedTheme:resolved,setPreference});
  apply();
  const systemChanged=()=>{if(preference==='system')apply();};
  if(media?.addEventListener)media.addEventListener('change',systemChanged);else media?.addListener?.(systemChanged);
  window.addEventListener('storage',event=>{if(event.key!==key&&event.key!==null)return;preference=allowed.includes(event.newValue)?event.newValue:'system';apply();});
  function mount(){
    if(document.querySelector('[data-synapse-theme]'))return;
    const footer=document.querySelector('.synapse-rail-footer'),publicBar=document.querySelector('.public-topbar'),header=document.querySelector('body[data-role="customer"]>header');
    const host=footer||publicBar||header;if(!host)return;
    const label=document.createElement('label');label.className='theme-control';
    const title=document.createElement('span');title.textContent='Apariencia';
    const select=document.createElement('select');select.dataset.synapseTheme='';select.setAttribute('aria-label','Tema Synapse');
    for(const [value,text]of [['system','Sistema'],['light','Claro'],['dark','Oscuro']]){const option=document.createElement('option');option.value=value;option.textContent=text;select.append(option);}
    select.value=preference;select.addEventListener('change',()=>setPreference(select.value));label.append(title,select);
    if(footer)footer.prepend(label);else host.append(label);
    apply();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
})();
