let address = localStorage.getItem("inj_address") || "";

let targetPrice = 0, displayedPrice = 0;
let price24hOpen = 0, price24hLow = 0, price24hHigh = 0;

let availableInj = 0, stakeInj = 0, rewardsInj = 0;
let displayedAvailable = 0, displayedStake = 0, displayedRewards = 0;
let apr = 0;

let chart, chartData = [], ws;

const $ = id => document.getElementById(id);
const lerp = (a,b,f)=>a+(b-a)*f;

// Animazione numeri
function colorNumber(el, n, o, d){
  const ns=n.toFixed(d), os=o.toFixed(d);
  el.innerHTML=[...ns].map((c,i)=>
    c!==os[i]
      ? `<span style="color:${n>o?'#22c55e':'#ef4444'}">${c}</span>`
      : `<span>${c}</span>`
  ).join("");
}

// Fetch JSON sicuro
async function fetchJSON(url){
  try{ return await (await fetch(url)).json(); }
  catch{ return {}; }
}

/* INPUT INDIRIZZO */
$("addressInput").value = address;
$("addressInput").onchange = e=>{
  address=e.target.value.trim();
  localStorage.setItem("inj_address",address);
  loadAccount();
};

/* ACCOUNT DATA */
async function loadAccount(){
  if(!address) return;

  const [b,s,r,i] = await Promise.all([
    fetchJSON(`https://lcd.injective.network/cosmos/bank/v1beta1/balances/${address}`),
    fetchJSON(`https://lcd.injective.network/cosmos/staking/v1beta1/delegations/${address}`),
    fetchJSON(`https://lcd.injective.network/cosmos/distribution/v1beta1/delegators/${address}/rewards`),
    fetchJSON(`https://lcd.injective.network/cosmos/mint/v1beta1/inflation`)
  ]);

  availableInj = (b.balances?.find(x=>x.denom==="inj")?.amount||0)/1e18;
  stakeInj = (s.delegation_responses||[]).reduce((a,d)=>a+Number(d.balance.amount),0)/1e18;
  rewardsInj = (r.rewards||[]).reduce((a,v)=>a+v.reward.reduce((s,x)=>s+Number(x.amount),0),0)/1e18;
  apr = Number(i.inflation||0)*100;
}
loadAccount();
setInterval(loadAccount,60000);

/* HISTORY / CHART INIT */
async function fetchHistory(){
  const d = await fetchJSON("https://api.binance.com/api/v3/klines?symbol=INJUSDT&interval=1h&limit=24");
  chartData = d.map(c=>+c[4]);
  price24hOpen = +d[0][1];
  price24hLow = Math.min(...chartData);
  price24hHigh = Math.max(...chartData);
  targetPrice = chartData.at(-1);
  if(!chart) initChart();
}
fetchHistory();

function initChart(){
  const ctx=$("priceChart").getContext("2d");
  chart=new Chart(ctx,{
    type:"line",
    data:{
      labels:Array(chartData.length).fill(""),
      datasets:[{
        data:chartData,
        borderColor:"#22c55e",
        backgroundColor:"rgba(34,197,94,0.2)",
        fill:true,
        pointRadius:0,
        tension:0.3
      }]
    },
    options:{
      responsive:true,
      maintainAspectRatio:false,
      animation:false,
      plugins:{legend:{display:false}},
      scales:{
        x:{display:false},
        y:{ticks:{color:"#9ca3af"}}
      }
    }
  });
}

// Aggiorna grafico 24h ogni 5 minuti
function updateChart24h(){
  if(!chart) return;
  chartData.shift();
  chartData.push(targetPrice);
  chart.data.datasets[0].data = chartData;
  chart.update("none");
}
setInterval(updateChart24h,5*60*1000);

/* WEBSOCKET */
function startWS(){
  if(ws) ws.close();
  ws=new WebSocket("wss://stream.binance.com:9443/ws/injusdt@trade");
  ws.onmessage=e=>{
    const p=+JSON.parse(e.data).p;
    targetPrice=p;
    price24hHigh=Math.max(price24hHigh,p);
    price24hLow=Math.min(price24hLow,p);
  };
  ws.onclose=()=>setTimeout(startWS,3000);
}
startWS();

/* ANIMATION LOOP */
function animate(){
  // Prezzo animato
  const old=displayedPrice;
  displayedPrice=lerp(displayedPrice,targetPrice,0.1);
  colorNumber($("price"),displayedPrice,old,4);

  // Variazione 24h
  const d=((displayedPrice-price24hOpen)/price24hOpen)*100;
  $("price24h").textContent=`${d>0?"▲":"▼"} ${Math.abs(d).toFixed(2)}%`;
  $("price24h").className="sub "+(d>0?"up":"down");

  // Aggiorna valori estremi
  $("priceMin").textContent=price24hLow.toFixed(3);
  $("priceOpen").textContent=price24hOpen.toFixed(3);
  $("priceMax").textContent=price24hHigh.toFixed(3);

  // BARRA DEL PREZZO CENTRATA CON LINEA GIALLA CHE TRASCINA
  if(price24hHigh > price24hLow){
    const delta = displayedPrice - price24hOpen;
    const maxDelta = Math.max(price24hHigh - price24hOpen, price24hOpen - price24hLow);
    let pct = Math.min(Math.abs(delta)/maxDelta,1)*50;

    // Colore barra
    const color = delta>=0 ? "#22c55e" : "#ef4444";
    $("priceBar").style.background = color;

    // Linea gialla
    const linePct = ((displayedPrice - price24hLow) / (price24hHigh - price24hLow)) * 100;
    $("priceLine").style.left = linePct + "%";

    // Barra verde/rossa segue la linea
    if(linePct >= 50){
      $("priceBar").style.left = "50%";
      $("priceBar").style.width = linePct - 50 + "%";
    } else {
      $("priceBar").style.left = linePct + "%";
      $("priceBar").style.width = 50 - linePct + "%";
    }
  }

  // Account animato
  displayedAvailable=lerp(displayedAvailable,availableInj,0.1);
  colorNumber($("available"),displayedAvailable,availableInj,6);
  $("availableUsd").textContent=`≈ $${(displayedAvailable*displayedPrice).toFixed(2)}`;

  displayedStake=lerp(displayedStake,stakeInj,0.1);
  colorNumber($("stake"),displayedStake,stakeInj,4);
  $("stakeUsd").textContent=`≈ $${(displayedStake*displayedPrice).toFixed(2)}`;

  displayedRewards=lerp(displayedRewards,rewardsInj,0.1);
  colorNumber($("rewards"),displayedRewards,rewardsInj,7);
  $("rewardsUsd").textContent=`≈ $${(displayedRewards*displayedPrice).toFixed(2)}`;

  // Reward bar dinamica (max = 100% dello stake)
  const rewardPct = stakeInj > 0 ? Math.min(displayedRewards/stakeInj*100,100) : 0;
  $("rewardBar").style.width = rewardPct + "%";
  $("rewardPercent").textContent = rewardPct.toFixed(1) + "%";

  // APR
  $("apr").textContent=apr.toFixed(2)+"%";

  // Ultimo aggiornamento
  $("updated").textContent="Last update: "+new Date().toLocaleTimeString();

  requestAnimationFrame(animate);
}
animate();
