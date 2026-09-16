import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
const sql = `SELECT
 COALESCE((SELECT json_agg(p ORDER BY property_id) FROM (SELECT property_id,property_name FROM public.property) p),'[]'::json) AS properties,
 COALESCE((SELECT json_agg(t ORDER BY room_type_id) FROM (SELECT room_type_id,property_id,room_type_name FROM public.room_type) t),'[]'::json) AS "roomTypes",
 COALESCE((SELECT json_agg(r ORDER BY room_id) FROM (SELECT room_id,property_id,room_type_id,room_number,housekeeping_status,is_out_of_order FROM public.room) r),'[]'::json) AS rooms;`;
const output = execFileSync(process.execPath,[resolve("node_modules/supabase/dist/supabase.js"),"db","query","--linked",sql],{encoding:"utf8",maxBuffer:10*1024*1024,stdio:["ignore","pipe","inherit"]});
const result=JSON.parse(output);
const catalog=result.rows?.[0];
if(!catalog||!Array.isArray(catalog.properties)||!Array.isArray(catalog.roomTypes)||!Array.isArray(catalog.rooms))throw new Error("Invalid Supabase room catalog response");
const snapshot={syncedAt:new Date().toISOString(),...catalog};
mkdirSync("public/data",{recursive:true});
writeFileSync("public/data/room-catalog.json",JSON.stringify(snapshot,null,2)+"\n","utf8");
console.log("Supabase 객실 데이터 동기화: "+catalog.properties.length+"개 호텔 / "+catalog.rooms.length+"실 / "+catalog.roomTypes.length+"개 타입");
