// --- Variabili ---
let address = localStorage.getItem("inj_address")||"";
let displayedPrice=0,targetPrice=0,price24hOpen=0,price24hLow=0,price24hHigh=0;
let stakeInj=0,displayedStake=0,rewardsInj=0,displayedRewards=0,availableInj=0,displayedAvailable=0,apr=0;
let chart, chartData=[], selectedTF='1h';

// --- DOM ---
const addressInput = document.getElementById("addressInput");
const priceEl = document.getElementById("price");
const price24hEl = document.getElementById("price24h");
const priceBarEl = document.getElementById("priceBar");
const priceLineEl = document.getElementById("priceLine");
const priceMinEl = document.getElementById("priceMin");
const priceMaxEl = document.getElementById("priceMax");
const priceOpenEl = document.getElementById("priceOpen");
const availableEl = document.getElementById("available");
const availableUsdEl = document.getElementById("availableUsd");
const stakeEl = document.getElementById("stake");
const stakeUsdEl = document.getElementById("stakeUsd");
const rewardsEl = document.getElementById("rewards");
const rewardsUsdEl = document.getElementById("rewardsUsd");
const rewardBarEl = document.getElementById("rewardBar");
const rewardPercentEl = document.getElementById("rewardPercent");
const aprEl = document.getElementById("apr");
const updatedEl = document.getElementById("updated");
const tfIcon = document.querySelector(".tf-icon");
const tfMenu = document.querySelector(".tf-menu");

// --- Helpers ---
const fetchJSON = async url=>{ try{ const r=await fetch(url); return await r.json(); } catch(e){ console.error(e); return {}; } }
const lerp=(a,b,f)=>a+(b-a)*f;

// --- Address ---
addressInput.value=address;
addressInput.onchange=e=>{ address=e.target.value.trim(); localStorage.setItem("inj_address",address); loadData(); };

// --- Load Injective ---
async function loadData(){
  if(!address) return;
  try{
    const balRes=await fetchJSON(`https://lcd.injective.network/cosmos/bank/v1beta1/balances/${address}`);
    const inj=balRes.balances?.find(b=>b.denom==="inj");
    availableInj=inj?Number(inj.amount)/1e18:0;

    const stakeRes=await fetchJSON(`https://lcd.injective.network/cosmos/staking/v1beta1/delegations/${address}`);
    stakeInj=stakeRes.delegation_responses?.reduce((s,d)=>s+Number(d.balance.amount||0),0)/1e18||0;

    const rewardsRes=await fetchJSON(`https://lcd.injective.network/cosmos/distribution/v1beta1/delegators/${address}/rewards`);
    rewardsInj=rewardsRes.rewards?.reduce((s,r)=>s+Number(r.reward[0]?.amount||0),0)/1e18||0;

    const infl=await fetchJSON(`https://lcd.injective.network/cosmos/mint/v1beta1/inflation`);
    const pool=await fetchJSON(`https://lcd.injective.network/cosmos/staking/v1beta1/pool`);
    const bonded=Number(pool.pool?.bonded_tokens||0);
    const notBonded=Number(pool.pool?.not_bonded_tokens||0);
    apr=(infl.inflation*(bonded+notBonded)/bonded)*100;
  } catch(e){ console.error(e);}
}
loadData();
setInterval(loadData,2000);

// --- Fetch Candles Binance ---
async function fetchCandles(tf){
  const tfMap={ "1h":"1h","12h":"12h","1d":"1d","1w":"1w","1M":"1M" };
  let limit=100;
  if(tf==="12h") limit=90; if(tf==="1d") limit=60; if(tf==="1w") limit=52; if(tf==="1M") limit=12;
  const d=await fetchJSON(`https://api.binance.com/api/v3/klines?symbol=INJUSDT&interval=${tfMap[tf]}&limit=${limit}`);
  chartData=d.map(c=>({ x:new Date(c[0]), o:+c[1], h:+c[2], l:+c[3], c:+c[4] }));
  price24hOpen=chartData[0]?.o||0;
  price24hLow=Math.min(...chartData.map(c=>c.l));
  price24hHigh=Math.max(...chartData.map(c=>c.h));
  targetPrice=chartData.at(-1)?.c||0;
  drawChart();
}

// --- Draw Chart ---
function drawChart(){
  const ctx=document.getElementById("priceChart").getContext("2d");
  if(chart) chart.destroy();
  chart=new Chart(ctx,{
    type:"candlestick",
    data:{ datasets:[{ label:"INJ/USDT", data:chartData, color:{up:"#22c55e", down:"#ef4444", unchanged:"#9ca3af"} }] },
    options:{ responsive:true, maintainAspectRatio:false, plugins:{ legend:{display:false} },
      scales:{ x:{ type:"time", ticks:{ color:"#9ca3af" }, grid:{ color:"#1e293b" } },
               y:{ ticks:{ color:"#9ca3af" }, grid:{ color:"#1e293b" } } } }
  });
}

// --- WebSocket Realtime ---
function startWS(){
  const ws=new WebSocket("wss://stream.binance.com:9443/ws/injusdt@trade");
  ws.onmessage=e=>{
    const p=+JSON.parse(e.data).p;
    if(chartData.length>0){
      const last=chartData[chartData.length-1];
      last.h=Math.max(last.h,p); last.l=Math.min(last.l,p); last.c=p;
      targetPrice=p;
      drawChart();
    }
  };
  ws.onclose=()=>setTimeout(startWS,3000);
}
startWS();

// --- Animate Numbers ---
function animate(){
  // Price
  const oldPrice=displayedPrice;
  displayedPrice=lerp(displayedPrice,targetPrice,0.1);
  if(Math.abs(displayedPrice-oldPrice)>0.00001){
    priceEl.innerText=displayedPrice.toFixed(4);
    const delta=((displayedPrice-price24hOpen)/price24hOpen)*100;
    price24hEl.innerText=(delta>0?"▲ ":"▼ ")+Math.abs(delta).toFixed(2)+"%";
    price24hEl.className="sub "+(delta>0?"up":delta<0?"down":"");
  }

  // Price bar
  const center=50;
  const percent=Math.min(Math.abs(displayedPrice-price24hOpen)/Math.max(price24hHigh-price24hLow,0.0001)*50,50);
  let linePos=displayedPrice>=price24hOpen?center+percent:center-percent;
  priceBarEl.style.left=`${displayedPrice>=price24hOpen?center+"%":linePos+"%"}`;
  priceBarEl.style.width=`${displayedPrice>=price24hOpen?linePos-center:center-linePos}%`;
  priceBarEl.style.background=displayedPrice>=price24hOpen?"linear-gradient(to right,#22c55e,#10b981)":"linear-gradient(to right,#ef4444,#f87171)";
  priceLineEl.style.left=`${linePos}%`;
  priceMinEl.innerText=price24hLow.toFixed(4);
  priceMaxEl.innerText=price24hHigh.toFixed(4);
  priceOpenEl.innerText=price24hOpen.toFixed(4);

  // Available
  displayedAvailable=lerp(displayedAvailable,availableInj,0.1);
  availableEl.innerText=displayedAvailable.toFixed(6);
  availableUsdEl.innerText=(displayedAvailable*displayedPrice).toFixed(2);

  // Stake
  displayedStake=lerp(displayedStake,stakeInj,0.1);
  stakeEl.innerHTML=colorDigits(displayedStake.toFixed(4),displayedStake-0.0001);
  stakeUsdEl.innerText=(displayedStake*displayedPrice).toFixed(2);

  // Rewards
  displayedRewards=lerp(displayedRewards,rewardsInj,0.05);
  rewardsEl.innerHTML=colorDigits(displayedRewards.toFixed(7),displayedRewards-0.0000001);
  rewardsUsdEl.innerText=(displayedRewards*displayedPrice).toFixed(2);
  const rewardPercent=Math.min(displayedRewards/0.05*100,100);
  rewardBarEl.style.width=rewardPercent+"%";
  rewardPercentEl.innerText=rewardPercent.toFixed(1)+"%";

  // APR
  aprEl.innerText=apr.toFixed(2)+"%";
  updatedEl.innerText="Last Update: "+new Date().toLocaleTimeString();

  requestAnimationFrame(animate);
}
animate();

// --- Color digits ---
function colorDigits(newVal,oldVal){
  let res="";
  const newS=newVal.toString(), oldS=(oldVal||0).toFixed(newS.split(".")[1]?.length||4);
  for(let i=0;i<newS.length;i++){
    const c=newS[i], o=oldS[i]||"";
    if(c!==o && /\d/.test(c)){
      res+=`<span style="color:${+newVal>+oldVal?"#22c55e":"#ef4444"}">${c}</span>`;
    } else res+=c;
  }
  return res;
}

// --- Timeframe menu ---
tfIcon.addEventListener("click",()=>{ tfMenu.style.display=tfMenu.style.display==="flex"?"none":"flex"; });
tfMenu.querySelectorAll("div").forEach(el=>{
  el.addEventListener("click",()=>{
    selectedTF=el.dataset.tf;
    tfMenu.querySelectorAll("div").forEach(d=>d.classList.remove("active"));
    el.classList.add("active");
    fetchCandles(selectedTF);
  });
});

fetchCandles(selectedTF);
