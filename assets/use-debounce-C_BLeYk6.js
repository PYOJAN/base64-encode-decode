import{s as o}from"./index-BSg9IPmd.js";function n(e,t=500){const[u,r]=o.useState(e);return o.useEffect(()=>{const s=setTimeout(()=>r(e),t);return()=>clearTimeout(s)},[e,t]),u}export{n as u};
