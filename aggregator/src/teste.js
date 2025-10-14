// test-desvio.js
const vals = [1.5, 0.9, 0.8, 1.3];
const mean = vals.reduce((a,b)=>a+b,0)/vals.length;
const variance = vals.reduce((s,v)=>s+(v-mean)**2,0)/vals.length;
console.log('STDEVP =', Math.sqrt(variance));
