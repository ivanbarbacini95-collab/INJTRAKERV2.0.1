let address = localStorage.getItem("inj_address") || "";

// Variabili principali
let displayedPrice=0,targetPrice=0,price24hOpen=0,price24hLow=0,price24hHigh=0;
let stakeInj=0,displayedStake=0,rewardsInj=0,displayedRewards=0,availableInj=0,displayedAvailable=0;
let apr=0, rewardMax=0.05;

// DOM
const addressInput=document.getElementById("addressInput");
const priceEl=document.getElementById("price");
const price24hEl=document.getElementById("price24h");
const priceBarEl=document.getElementById("priceBar");
const priceLineEl=document.getElementById("priceLine");
const priceMinEl=document.getElementById("priceMin");
const priceMaxEl=document.getElementById("priceMax");
const priceOpenEl=document.getElementById("priceOpen");

const availableEl=document.getElementById("available");
const availableUsdEl=document.getElementById("availableUsd");

const stakeEl=document.getElementById("stake");
const stakeUsdEl=document.getElementById("stakeUsd");
const stakeDailyEl=document.getElementById("stakeDaily");
const stakeBarEl=document.getElementById("stakeBar");
const stakeLineEl=document.getElementById("stakeLine");

const rewardsEl=document.getElementById("rewards");
const rewardsUsdEl=document.getElementById("rewardsUsd");
const rewardsDailyEl=document.getElementById("rewardsDaily");
const rewardsWeeklyEl=document.getElementById("rewardsWeekly");
const rewardsMonthlyEl=document.getElementById("rewardsMonthly");
const rewardBarEl=document.getElementById("rewardBar");
const rewardLineEl=document.getElementById("rewardLine");

const aprEl=document.getElementById("apr");
const updatedEl=document.getElementById("updated");

let chart, chartData=[];

// --- Helper ---
const fetchJSON=async url=>{
  try{return await (await fetch(url)).json();}
  catch(e){console.error("Fetch error",url,e); return {};}
};

function splitDigits(el,newV){
  const oldV=el.innerText.replace(/,/g,'').split('');
  const newS=newV.toFixed(6).split('');
  let html='';
  for(let i=0;i<newS.length;i++){
    let oldC=oldV[i]||'0';
    let newC=newS[i];
    if(oldC<newC) html+='<span class="up">'+newC+'</span>';
    else if(oldC>newC) html+='<span class="down">'+newC+'</span>';
    else html+=newC;
  }
  el.innerHTML=html;
}

// --- Input indirizzo ---
addressInput.value=address;
addressInput.onchange=e=>{
  address=e.target.value.trim();
  localStorage.setItem("inj_address",address);
  loadData();
};

// --- Load dati Injective ---
async function loadData(){
  if(!address) return;
  try{
    const balanceRes=await fetchJSON(`https://lcd.injective.network/cosmos/bank/v1beta1/balances/${address}`);
    const injBalance=balanceRes.balances?.find(b=>b.denom==="inj");
    availableInj=injBalance?Number(injBalance.amount)/1e18:0;

    const stakeRes=await fetchJSON(`https://lcd.injective.network/cosmos/staking/v1beta1/delegations/${address}`);
    stakeInj=stakeRes.delegation_responses?.reduce((sum,d)=>sum+Number(d.balance.amount||0),0)/1e18||0;

    const rewardsRes=await fetchJSON(`https://lcd.injective.network/cosmos/distribution/v1beta1/delegators/${address}/rewards`);
    rewardsInj=rewardsRes.rewards?.reduce((sum,r)=>sum+Number(r.reward[0]?.amount||0),0)/1e18||0;

    const inflationRes=await fetchJSON(`https://lcd.injective.network/cosmos/mint/v1beta1/inflation`);
    const poolRes=await fetchJSON(`https://lcd.injective.network/cosmos/staking/v1beta1/pool`);
    const bonded=Number(poolRes.pool?.bonded_tokens||0);
    const notBonded=Number(poolRes.pool?.not_bonded_tokens||0);
    apr=(inflationRes.inflation*(bonded+notBonded)/bonded)*100;
  }catch(e){console.error("Errore caricamento dati Injective",e);}
}
loadData();
setInterval(loadData,60000);

// --- Price History e WS ---
async function fetchHistory(){
  try{
    const res=await fetch("https://api.binance.com/api/v3/klines?symbol=INJUSDT&interval=15m&limit=96");
    const d=await res.json();
    chartData=d.map(c=>+c[4]);
    price24hOpen=+d[0][1];
    price24hLow=Math.min(...chartData);
    price24hHigh=Math.max(...chartData);
    targetPrice=chartData.at(-1);
    drawChart();
  }catch(e){console.error("Errore price history:",e);}
}
fetchHistory();

function drawChart(){
  const ctx=document.getElementById("priceChart");
  if(chart) chart.destroy();
  chart=new Chart(ctx,{
    type:"line",
    data:{labels:chartData.map((_,i)=>i),datasets:[{data:chartData,borderColor:"#22c55e",tension:0.3,fill:true}]},
    options:{plugins:{legend:{display:false}},scales:{x:{display:false}}}
  });
}

function startWS(){
  const ws=new WebSocket("wss://stream.binance.com:9443/ws/injusdt@trade");
  ws.onmessage=e=>{
    const p=+JSON.parse(e.data).p;
    targetPrice=p;
    if(p>price24hHigh) price24hHigh=p;
    if(p<price24hLow) price24hLow=p;
  };
  ws.onclose=()=>setTimeout(startWS,3000);
}
startWS();

// --- Animate ---
function animate(){
  // Price
  displayedPrice+= (targetPrice-displayedPrice)*0.1;
  splitDigits(priceEl,displayedPrice);
  const delta=(displayedPrice-price24hOpen)/price24hOpen*100;
  price24hEl.innerText=(delta>0?"▲ ":"▼ ")+Math.abs(delta).toFixed(2)+"%";
  price24hEl.className="sub "+(delta>0?"up":delta<0?"down":"");

  // Barra price
  const range=price24hHigh-price24hLow||1;
  const leftPercent=(displayedPrice-price24hOpen)/range*50+50;
  priceBarEl.style.left="50%";
  priceBarEl.style.width=Math.abs(leftPercent-50)+"%";
  priceBarEl.style.background=displayedPrice>=price24hOpen?"#22c55e":"#ef4444";
  priceLineEl.style.left=leftPercent+"%";

  // Min/Max/Open
  splitDigits(priceMinEl,price24hLow);
  splitDigits(priceMaxEl,price24hHigh);
  splitDigits(priceOpenEl,price24hOpen);

  // Available
  displayedAvailable+=(availableInj-displayedAvailable)*0.1;
  splitDigits(availableEl,displayedAvailable);
  availableUsdEl.innerText="≈ $"+(displayedAvailable*displayedPrice).toFixed(2);

  // Stake
  displayedStake+=(stakeInj-displayedStake)*0.1;
  splitDigits(stakeEl,displayedStake);
  stakeUsdEl.innerText="≈ $"+(displayedStake*displayedPrice).toFixed(2);

  // Rewards
  displayedRewards+=(rewardsInj-displayedRewards)*0.05;
  splitDigits(rewardsEl,displayedRewards);
  rewardsUsdEl.innerText="≈ $"+(displayedRewards*displayedPrice).toFixed(2);

  // Stime rewards
  const secondsInDay=86400;
  const rewardsPerSecond=displayedRewards/secondsInDay;
  rewardsDailyEl.innerText="+ "+(rewardsPerSecond*secondsInDay).toFixed(6)+"/day";
  rewardsWeeklyEl.innerText="+ "+(rewardsPerSecond*secondsInDay*7).toFixed(6)+"/week";
  rewardsMonthlyEl.innerText="+ "+(rewardsPerSecond*secondsInDay*30).toFixed(6)+"/month";
  stakeDailyEl.innerText="+ "+(rewardsPerSecond*secondsInDay).toFixed(6)+"/day";

  // Barre gradient
  rewardBarEl.style.width=Math.min(displayedRewards/rewardMax*100,100)+"%";
  rewardBarEl.style.background="linear-gradient(to right,#0ea5e9,#3b82f6)";
  rewardLineEl.style.left=Math.min(displayedRewards/rewardMax*100,100)+"%";

  stakeBarEl.style.width=Math.min(displayedRewards/rewardMax*100,100)+"%";
  stakeBarEl.style.background="linear-gradient(to right,#22c55e,#3b82f6)";
  stakeLineEl.style.left=Math.min(displayedRewards/rewardMax*100,100)+"%";

  // APR
  aprEl.innerText=apr.toFixed(2)+"%";

  // Last update
  updatedEl.innerText="Last Update: "+new Date().toLocaleTimeString();

  requestAnimationFrame(animate);
}
animate();
