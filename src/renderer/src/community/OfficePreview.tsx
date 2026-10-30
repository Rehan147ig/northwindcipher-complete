import {useEffect,useRef} from 'react';
import {drawOffice} from './world';

// The office is drawn in a fixed 960x640 space. Rendering the canvas at its on-screen size (times the device
// pixel ratio) and scaling the context keeps edges and text crisp instead of downscaling a bitmap.
export function OfficePreview(){
 const ref=useRef<HTMLCanvasElement>(null);
 useEffect(()=>{
  const canvas=ref.current;if(!canvas)return;
  const paint=()=>{
   const width=Math.max(320,Math.round(canvas.clientWidth*(window.devicePixelRatio||1)));
   const height=Math.round(width*640/960);
   if(canvas.width===width&&canvas.height===height)return;
   canvas.width=width;canvas.height=height;
   const ctx=canvas.getContext('2d');if(!ctx)return;
   ctx.setTransform(width/960,0,0,height/640,0,0);
   drawOffice(ctx);
  };
  paint();
  const observer=typeof ResizeObserver!=='undefined'?new ResizeObserver(paint):null;
  observer?.observe(canvas);
  return()=>observer?.disconnect();
 },[]);
 return <canvas ref={ref} width={960} height={640} role="img" aria-label="Original pixel art preview of Northwind headquarters: warm wooden desks, green chairs, plants, and project stations"/>;
}
