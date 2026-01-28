let address = localStorage.getItem("inj_address") || "";

// Variabili
let displayedPrice=0, targetPrice=0, price24hOpen=0;
let price24hLow=0, price24hHigh=0;
let stakeInj=0, displayedStake=0;
let rewardsInj=0, displayedRewards=0;
let availableInj=0, displayedAvailable=0;
let apr=0;
let ath=0, atl=Infinity;

// Elementi DOM
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
const rewardsEl=document.getElementById("rewards");
const rewardsUsdEl=document.getElementById("rewardsUsd");
const rewardBarEl=document.getElementById("rewardBar");
const rewardPercentEl=document.getElementById("rewardPercent");
const aprEl=document.getElementById("apr");
const updatedEl=document.getElementById("updated");
let chart, chartData=[];

// ----------------- Helper -----------------
const fetchJSON=async url=>{try{return await (await fetch(url)).json();}catch(e){console.error("Fetch error:",url,e);return {};}};
addressInput.value=address;
addressInput.onchange=e=>{address=e.target.value.trim();localStorage.setItem("inj_address",address);loadData();};

// ----------------- Load Data -----------------
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

  }catch(e){console.error("Errore caricamento dati Injective:",e);}
}
loadData();setInterval(loadData,60000);

// ----------------- Price History -----------------
async function fetchHistory(){
  try{
    const res=await fetch("https://api.binance.com/api/v3/klines?symbol=INJUSDT&interval=15m&limit=96");
    const d=await res.json();
    chartData=d.map(c=>+c[4]);
    price24hOpen=+d[0][1];
    price24hLow=Math.min(...chartData);
    price24hHigh=Math.max(...chartData);
    targetPrice=chartData.at(-1);
    ath=Math.max(...chartData);
    atl=Math.min(...chartData);
    drawChart();
  }catch(e){console.error("Errore price history:",e);}
}
fetchHistory();

// ----------------- Draw Chart -----------------
function drawChart(){
  const ctx=document.getElementById("priceChart");
  if(chart) chart.destroy();
  chart=new Chart(ctx,{
    type:"line",
    data:{labels:chartData.map((_,i)=>i),datasets:[{data:chartData,borderColor:"#22c55e",tension:0.3,fill:true}]},
    options:{plugins:{legend:{display:false}},scales:{x:{display:false}}}
  });
}

// ----------------- Binance WS -----------------
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

// ----------------- Animate -----------------
function animate(){
  // ---- Price ----
  const prevP=displayedPrice;
  displayedPrice+=(targetPrice-displayedPrice)*0.2; // più sensibile
  updateDigits(priceEl,prevP,displayedPrice,4);

  // Delta %
  const delta=((displayedPrice-price24hOpen)/price24hOpen)*100;
  price24hEl.innerText=(delta>0?"▲ ":"▼ ")+Math.abs(delta).toFixed(2)+"%";
  price24hEl.className="sub "+(delta>0?"up":delta<0?"down":"");

  // Min / Open / Max
  updateDigits(priceMinEl,Number(priceMinEl.innerText),price24hLow,4);
  updateDigits(priceMaxEl,Number(priceMaxEl.innerText),price24hHigh,4);
  updateDigits(priceOpenEl,Number(priceOpenEl.innerText),price24hOpen,4);

  // ---- Price Bar ----
  let center=50;
  let percent=Math.min(Math.abs(displayedPrice-price24hOpen)/Math.max(price24hHigh-price24hLow,0.0001)*50,50);
  if(displayedPrice>=price24hOpen){
    priceBarEl.style.left=`${center}%`;
    priceBarEl.style.width=`${percent*2}%`;
    priceBarEl.style.background="#22c55e";
  }else{
    priceBarEl.style.left=`${center-percent}%`;
    priceBarEl.style.width=`${percent*2}%`;
    priceBarEl.style.background="#ef4444";
  }

  // Linea gialla trascina
  let linePos=center+((displayedPrice-price24hOpen)/(price24hHigh-price24hLow||1)*50);
  priceLineEl.style.left=`${linePos}%`;

  // ATH/ATL scintille
  if(displayedPrice>=ath) priceBarEl.classList.add("ath"); else priceBarEl.classList.remove("ath");
  if(displayedPrice<=atl) priceBarEl.classList.add("atl"); else priceBarEl.classList.remove("atl");

  // ---- Available ----
  const prevA=displayedAvailable;
  displayedAvailable+=(availableInj-displayedAvailable)*0.1;
  updateDigits(availableEl,prevA,displayedAvailable,6);
  updateDigits(availableUsdEl,prevA*displayedPrice,displayedAvailable*displayedPrice,2);

  // ---- Stake ----
  const prevS=displayedStake;
  displayedStake+=(stakeInj-displayedStake)*0.1;
  updateDigits(stakeEl,prevS,displayedStake,4);
  updateDigits(stakeUsdEl,prevS*displayedPrice,displayedStake*displayedPrice,2);

  // ---- Rewards ----
  const prevR=displayedRewards;
  displayedRewards+=(rewardsInj-displayedRewards)*0.05;
  updateDigits(rewardsEl,prevR,displayedRewards,6);
  updateDigits(rewardsUsdEl,prevR*displayedPrice,displayedRewards*displayedPrice,2);

  // ---- Reward Bar ----
  let rewardPercent=Math.min(displayedRewards/0.05*100,100);
  rewardBarEl.style.width=rewardPercent+"%";
  rewardPercentEl.innerText=rewardPercent.toFixed(1)+"%";

  // ---- APR ----
  updateDigits(aprEl,parseFloat(aprEl.innerText),apr,2,true);

  // ---- Last Update ----
  updatedEl.innerText="Last Update: "+new Date().toLocaleTimeString();

  requestAnimationFrame(animate);
}
animate();

// ----------------- Update digits -----------------
function updateDigits(el,oldV,newV,fixed,isApr=false){
  oldV=Number(oldV); newV=Number(newV);
  let oldStr=oldV.toFixed(fixed), newStr=newV.toFixed(fixed);
  let html="";
  for(let i=0;i<newStr.length;i++){
    if(oldStr[i]===newStr[i]){
      html+=`<span>${newStr[i]}</span>`;
    }else{
      let cls="";
      if(!isNaN(parseFloat(newStr[i]))){
        cls=newStr[i]>oldStr[i]?"up":"down";
      }
      html+=`<span class="${cls}">${newStr[i]}</span>`;
    }
  }
  el.innerHTML=html;
}

// ----------------- Rewards update -----------------
setInterval(async ()=>{
  if(!address) return;
  try{
    const rewardsRes=await fetchJSON(`https://lcd.injective.network/cosmos/distribution/v1beta1/delegators/${address}/rewards`);
    rewardsInj=rewardsRes.rewards?.reduce((s,r)=>s+Number(r.reward[0]?.amount||0),0)/1e18||0;
  }catch(e){console.error("Errore aggiornamento rewards:",e);}
},3000);
