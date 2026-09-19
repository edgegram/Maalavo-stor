/* Legal reader fix is intentionally kept as a small isolated compatibility layer. */
(()=>{
  const clean=()=>{
    const r=document.getElementById('legalReader');
    if(!r)return;
    const head=r.querySelector('.maalavo-legal-head');
    if(head)head.remove();
    const scroll=r.querySelector('.maalavo-legal-scroll');
    if(scroll){scroll.style.paddingTop='calc(env(safe-area-inset-top) + 24px)';scroll.style.paddingBottom='calc(105px + env(safe-area-inset-bottom))';scroll.style.overflowY='auto';}
  };
  new MutationObserver(clean).observe(document.documentElement,{childList:true,subtree:true});
  document.addEventListener('DOMContentLoaded',clean);
})();
