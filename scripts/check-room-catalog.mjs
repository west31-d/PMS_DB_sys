import { chromium } from "@playwright/test";
import { readFileSync, mkdirSync } from "node:fs";
import assert from "node:assert/strict";
const catalog=JSON.parse(readFileSync("public/data/room-catalog.json","utf8"));
const browser=await chromium.launch({channel:"chrome",headless:true});
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}});
 await page.goto("http://127.0.0.1:5173/#/express/dashboard");
 await page.waitForSelector(".timeline-room");
 assert.equal(await page.locator(".timeline-room").count(),catalog.rooms.length);
 assert.equal(await page.locator(".booking-bar").count(),0);
 for(const room of catalog.rooms){
  const row=page.locator(".timeline-room").filter({has:page.locator(".room-meta strong").getByText(room.room_number,{exact:true})});
  const actual=await page.locator(".timeline-room").evaluateAll(nodes=>nodes.map(n=>({number:n.querySelector(".room-meta strong")?.textContent,type:n.querySelector(".room-meta > span:nth-child(3)")?.textContent})));
  assert.equal(actual.find(r=>r.number===room.room_number)?.type,catalog.roomTypes.find(t=>t.room_type_id===room.room_type_id)?.room_type_name);
 }
 assert.equal(await page.locator(".app").getAttribute("data-mode"),"snapshot");
 mkdirSync("test-results",{recursive:true});
 await page.screenshot({path:"test-results/actual-rooms.png",fullPage:true});
 console.log("Verified all "+catalog.rooms.length+" room/type mappings from Supabase; no sample bookings.");
}finally{await browser.close();}
