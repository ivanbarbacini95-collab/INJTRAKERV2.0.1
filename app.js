// Variabili
let address = localStorage.getItem("inj_address")||"";
let displayedPrice=0,targetPrice=0,price24hOpen=0,price24hLow=0,price24hHigh=0;
let stakeInj=0,displayedStake=0,rewardsInj=0,displayedRewards=0,availableInj=0,displayedAvailable=0,apr=0;
let chart, chartData=[];

// DOM
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

// Helpers
const fetchJSON = async url=>{ try{ const r=await fetch(url); return await r.json(); } catch(e){ console.error(e); return {}; } }
const lerp=(a,b,f)=>a+(b-a)*f;

// Address
addressInput.value=address;
addressInput.onchange=e=>{ address=e.target.value.trim(); localStorage.setItem("inj_address",address); loadData(); };

// Load Injective
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

// Fetch 24h price
async function fetch24h(){
  const res=await fetchJSON("https://api.binance.com/api/v3/klines?symbol=INJUSDT&interval=1h&limit=24");
  chartData=res.map(c=>+c[4]);
  price24hOpen=+res[0][1];
  price24hLow=Math.min(...chartData);
  price24hHigh=Math.max(...chartData);
  targetPrice=chartData.at(-1);
  drawChart();
}
fetch24h();

// Draw line chart
function drawChart(){
  const ctx=document.getElementById("priceChart").getContext("2d");
  if(chart) chart.destroy();
  const gradient=ctx.createLinearGradient(0,0,0,200);
  gradient.addColorStop(0,"rgba(34,197,94,0.3)");
  gradient.addColorStop(1,"rgba(34,197,94,0)");
  const lineColor=targetPrice>=price24hOpen?"#22c55e":"#ef4444";
  chart=new Chart(ctx,{
    type:"line",
    data:{ labels:chartData.map((_,i)=>i), datasets:[{ data:chartData, borderColor:lineColor, backgroundColor:gradient, tension:0.3, fill:true, pointRadius:2, pointHoverRadius:6, pointBackgroundColor:lineColor }]},
    options:{ responsive:true, maintainAspectRatio:false, plugins:{ legend:{display:false}}, scales:{ x:{ display:true, grid:{ color:"#1e293b" }, ticks:{ color:"#9ca3af"}}, y:{ display:true, grid:{ color:"#1e293b"}, ticks:{ color:"#9ca3af"}}}}
  });
}

// WebSocket
function startWS(){
  const ws=new WebSocket("wss://stream.binance.com:9443/ws/injusdt@trade");
  ws.onmessage=e=>{
    const p=+JSON.parse(e.data).p;
    targetPrice=p;
    if(p>price24hHigh) price24hHigh=p;
    if(p<price24hLow) price24hLow=p;
    chartData[chartData.length-1]=p;
    drawChart();
  };
  ws.onclose=()=>setTimeout(startWS,3000);
}
startWS();

// Animate numbers
function animate(){
  const oldPrice=displayedPrice;
  displayedPrice=lerp(displayedPrice,targetPrice,0.1);
  if(Math.abs(displayedPrice-oldPrice)>0.00001){
    priceEl.innerText=displayedPrice.toFixed(4);
    const delta=((displayedPrice-price24hOpen)/price24hOpen)*100;
    price24hEl.innerText=(delta>0?"▲ ":"▼ ")+Math.abs(delta).toFixed(2)+"%";
    price24hEl.className="sub "+(delta>0?"up":delta<0?"down":"");
  }

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

  displayedAvailable=lerp(displayedAvailable,availableInj,0.1);
  availableEl.innerText=displayedAvailable.toFixed(6);
  availableUsdEl.innerText=(displayedAvailable*displayedPrice).toFixed(2);

  displayedStake=lerp(displayedStake,stakeInj,0.1);
  stakeEl.innerHTML=colorDigits(displayedStake.toFixed(4),displayedStake-0.0001);
  stakeUsdEl.innerText=(displayedStake*displayedPrice).toFixed(2);

  displayedRewards=lerp(displayedRewards,rewardsInj,0.05);
  rewardsEl.innerHTML=colorDigits(displayedRewards.toFixed(7),displayedRewards-0.0000001);
  rewardsUsdEl.innerText=(displayedRewards*displayedPrice).toFixed(2);
  const rewardPercent=Math.min(displayedRewards/0.05*100,100);
  rewardBarEl.style.width=rewardPercent+"%";
  rewardPercentEl.innerText=rewardPercent.toFixed(1)+"%";

  aprEl.innerText=apr.toFixed(2)+"%";
  updatedEl.innerText="Last Update: "+new Date().toLocaleTimeString();

  requestAnimationFrame(animate);
}
animate();

// Color digits
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
