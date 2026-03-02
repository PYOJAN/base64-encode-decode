import{c as d,r as a,a8 as A,j as c,Y as m,a9 as O,Z as L,V as S,$ as z,ae as T,Q as D}from"./index-DKR6UUtY.js";/**
 * @license lucide-react v0.469.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const K=d("BookOpen",[["path",{d:"M12 7v14",key:"1akyts"}],["path",{d:"M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z",key:"ruj8y"}]]);/**
 * @license lucide-react v0.469.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const G=d("FileDigit",[["path",{d:"M4 22h14a2 2 0 0 0 2-2V7l-5-5H6a2 2 0 0 0-2 2v4",key:"1pf5j1"}],["path",{d:"M14 2v4a2 2 0 0 0 2 2h4",key:"tnqrlb"}],["rect",{width:"4",height:"6",x:"2",y:"12",rx:"2",key:"jm304g"}],["path",{d:"M10 12h2v6",key:"12zw74"}],["path",{d:"M10 18h4",key:"1ulq68"}]]);/**
 * @license lucide-react v0.469.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const H=d("Info",[["circle",{cx:"12",cy:"12",r:"10",key:"1mglay"}],["path",{d:"M12 16v-4",key:"1dtifu"}],["path",{d:"M12 8h.01",key:"e9boi3"}]]);/**
 * @license lucide-react v0.469.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Q=d("Key",[["path",{d:"m15.5 7.5 2.3 2.3a1 1 0 0 0 1.4 0l2.1-2.1a1 1 0 0 0 0-1.4L19 4",key:"g0fldk"}],["path",{d:"m21 2-9.6 9.6",key:"1j0ho8"}],["circle",{cx:"7.5",cy:"15.5",r:"5.5",key:"yqb3hr"}]]);/**
 * @license lucide-react v0.469.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Y=d("Puzzle",[["path",{d:"M15.39 4.39a1 1 0 0 0 1.68-.474 2.5 2.5 0 1 1 3.014 3.015 1 1 0 0 0-.474 1.68l1.683 1.682a2.414 2.414 0 0 1 0 3.414L19.61 15.39a1 1 0 0 1-1.68-.474 2.5 2.5 0 1 0-3.014 3.015 1 1 0 0 1 .474 1.68l-1.683 1.682a2.414 2.414 0 0 1-3.414 0L8.61 19.61a1 1 0 0 0-1.68.474 2.5 2.5 0 1 1-3.014-3.015 1 1 0 0 0 .474-1.68l-1.683-1.682a2.414 2.414 0 0 1 0-3.414L4.39 8.61a1 1 0 0 1 1.68.474 2.5 2.5 0 1 0 3.014-3.015 1 1 0 0 1-.474-1.68l1.683-1.682a2.414 2.414 0 0 1 3.414 0z",key:"w46dr5"}]]);/**
 * @license lucide-react v0.469.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Z=d("ShieldAlert",[["path",{d:"M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z",key:"oel41y"}],["path",{d:"M12 8v4",key:"1got3b"}],["path",{d:"M12 16h.01",key:"1drbdi"}]]);var f="Collapsible",[F]=D(f),[$,g]=F(f),I=a.forwardRef((e,s)=>{const{__scopeCollapsible:l,open:o,defaultOpen:t,disabled:i,onOpenChange:r,...y}=e,[u,p]=A({prop:o,defaultProp:t??!1,onChange:r,caller:f});return c.jsx($,{scope:l,disabled:i,contentId:O(),open:u,onOpenToggle:a.useCallback(()=>p(b=>!b),[p]),children:c.jsx(m.div,{"data-state":x(u),"data-disabled":i?"":void 0,...y,ref:s})})});I.displayName=f;var w="CollapsibleTrigger",E=a.forwardRef((e,s)=>{const{__scopeCollapsible:l,...o}=e,t=g(w,l);return c.jsx(m.button,{type:"button","aria-controls":t.contentId,"aria-expanded":t.open||!1,"data-state":x(t.open),"data-disabled":t.disabled?"":void 0,disabled:t.disabled,...o,ref:s,onClick:L(e.onClick,t.onOpenToggle)})});E.displayName=w;var v="CollapsibleContent",_=a.forwardRef((e,s)=>{const{forceMount:l,...o}=e,t=g(v,e.__scopeCollapsible);return c.jsx(S,{present:l||t.open,children:({present:i})=>c.jsx(B,{...o,ref:s,present:i})})});_.displayName=v;var B=a.forwardRef((e,s)=>{const{__scopeCollapsible:l,present:o,children:t,...i}=e,r=g(v,l),[y,u]=a.useState(o),p=a.useRef(null),b=z(s,p),k=a.useRef(0),R=k.current,M=a.useRef(0),P=M.current,C=r.open||y,N=a.useRef(C),h=a.useRef(void 0);return a.useEffect(()=>{const n=requestAnimationFrame(()=>N.current=!1);return()=>cancelAnimationFrame(n)},[]),T(()=>{const n=p.current;if(n){h.current=h.current||{transitionDuration:n.style.transitionDuration,animationName:n.style.animationName},n.style.transitionDuration="0s",n.style.animationName="none";const j=n.getBoundingClientRect();k.current=j.height,M.current=j.width,N.current||(n.style.transitionDuration=h.current.transitionDuration,n.style.animationName=h.current.animationName),u(o)}},[r.open,o]),c.jsx(m.div,{"data-state":x(r.open),"data-disabled":r.disabled?"":void 0,id:r.contentId,hidden:!C,...i,ref:b,style:{"--radix-collapsible-content-height":R?`${R}px`:void 0,"--radix-collapsible-content-width":P?`${P}px`:void 0,...e.style},children:C&&t})});function x(e){return e?"open":"closed"}var q=I;const J=q,U=E,W=_;export{K as B,J as C,G as F,H as I,Q as K,Y as P,Z as S,U as a,W as b};
