/* Reconstruct and load the new Topics 1–2 question bank before the existing UI runs. */
(function(){
  'use strict';
  const parts=window.__ECON12_CHUNKS;
  if(!Array.isArray(parts)||parts.length!==17)throw Error('Topics 1–2: missing source segment ('+(parts?.length||0)+'/17)');
  const script=document.createElement('script');
  script.textContent=parts.join('\n');
  document.head.appendChild(script);
  script.remove();
  delete window.__ECON12_CHUNKS;
})();