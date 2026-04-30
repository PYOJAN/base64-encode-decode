import{r as o}from"./index-B3XDSXQ-.js";function n(e,t=500){const[r,u]=o.useState(e);return o.useEffect(()=>{const s=setTimeout(()=>u(e),t);return()=>clearTimeout(s)},[e,t]),r}export{n as u};
