// Cloudflare includes the page URL and referrer in its beacon.
// Only count visits whose URLs cannot contain a Fundlark search or pasted text.
(() => {
  const {hostname, pathname, search, hash}=window.location;
  const sections=new Set(['','#top','#opportunities','#dashboard','#use-skill','#sourceHubs','#coverage']);
  if(hostname!=='dryang21.github.io'||!/^\/Fundlark(?:\/(?:index\.html)?)?$/.test(pathname)||
     search||!sections.has(hash)||navigator.globalPrivacyControl===true||navigator.doNotTrack==='1')return;
  if(document.referrer){
    const referrer=new URL(document.referrer);
    if(referrer.search||referrer.hash)return;
  }

  const token=document.currentScript?.dataset.siteToken;
  if(!token)return;
  const beacon=document.createElement('script');
  beacon.type='module';
  beacon.src='https://static.cloudflareinsights.com/beacon.min.js';
  beacon.dataset.cfBeacon=JSON.stringify({token,spa:false});
  document.head.append(beacon);
})();
