
// Shared calculator. Reads /data/tariffs.json. No rate is hardcoded here.
// If a rate is still "VERIFY_RATE", no fake total is shown.
(function(){
  var form = document.getElementById('calc-form');
  if(!form) return;
  var companyId = form.getAttribute('data-company');
  var out = document.getElementById('calc-result');
  var slabBox = document.getElementById('slab-table');
  var dataPath = '/data/tariffs.json';
  var TARIFF = null;
  function esc(s){ return String(s).replace(/[&<>"]/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]; }); }
  function fmt(n){ return 'PKR ' + Number(n).toLocaleString('en-PK'); }
  function isNum(v){ return typeof v === 'number' && isFinite(v); }
  function categoryKey(){
    var cat = document.getElementById('f-category').value;
    var prot = document.getElementById('f-protected');
    if(cat === 'domestic' && prot) return 'domestic_' + prot.value;
    return cat;
  }
  function renderSlabs(){
    if(!TARIFF || !slabBox) return;
    var key = categoryKey();
    var cat = TARIFF.categories[key] || TARIFF.categories.domestic || Object.values(TARIFF.categories)[0];
    if(!cat){ slabBox.innerHTML = '<p class="mut">No slab data for this category yet.</p>'; return; }
    var rows = cat.slabs.map(function(s){
      var to = (s.to === null || s.to === undefined) ? 'Above' : s.to;
      var rate = isNum(s.rate) ? fmt(s.rate) + ' / ' + esc(s.unit || '') : '<strong>VERIFY_RATE</strong>';
      return '<tr><td>' + esc(s.from) + ' – ' + esc(to) + '</td><td>' + rate + '</td></tr>';
    }).join('');
    slabBox.innerHTML = '<h3>Current tariff slabs — ' + esc(cat.label) + '</h3><table><tr><th>Units</th><th>Rate</th></tr>' + rows + '</table>'
      + '<p class="mut">Fixed charge: ' + (isNum(cat.fixed_charge) ? fmt(cat.fixed_charge) : '<strong>VERIFY_RATE</strong>')
      + ' &nbsp;|&nbsp; Last updated: ' + esc(TARIFF.last_updated) + ' &nbsp;|&nbsp; Source: ' + esc(TARIFF.source) + '</p>';
  }
  function calculate(ev){
    if(ev) ev.preventDefault();
    var unitsEl = document.getElementById('f-units');
    var units = parseFloat(unitsEl.value);
    var err = document.getElementById('calc-error');
    err.textContent = '';
    if(isNaN(units) || units < 0){ err.textContent = 'Please enter a valid number of units. Negative units are not allowed.'; return; }
    var max = (TARIFF && TARIFF.type === 'gas') ? 1000 : 100000;
    if(units > max){ err.textContent = 'That number looks too high. Please check it and enter a realistic monthly figure (max ' + max + ').'; return; }
    var custom = parseFloat(document.getElementById('f-custom-rate').value);
    var hasCustom = !isNaN(custom) && custom >= 0;
    if(!TARIFF){ out.innerHTML = '<p>Tariff data could not be loaded. Serve this site over http(s) — not file:// — so /data/tariffs.json can be fetched.</p>'; return; }
    var key = categoryKey();
    var cat = TARIFF.categories[key];
    if(!cat){ out.innerHTML = '<p>No tariff category found for this selection yet. Please update tariffs.json.</p>'; return; }
    var unverified = cat.slabs.some(function(s){ return !isNum(s.rate); }) || !isNum(cat.fixed_charge);
    var rows = [], total = 0, remaining = units;
    if(hasCustom){
      var cost = units * custom;
      rows.push(['Energy (' + units + ' × your rate ' + fmt(custom) + ')', cost]);
      total = cost;
      out.innerHTML = '<div class="notice"><strong>Estimate using YOUR rate, not the official tariff.</strong> You entered a rate from your own bill. This is not an official ' + esc(TARIFF.name) + ' rate.</div>'
        + '<p class="total">Estimated bill: ' + fmt(total) + '</p>'
        + '<table><tr><th>Item</th><th>Amount</th></tr>' + rows.map(function(r){ return '<tr><td>'+esc(r[0])+'</td><td>'+fmt(r[1])+'</td></tr>'; }).join('') + '</table>'
        + '<p class="mut">This is an estimate only. Taxes, fixed charges and adjustments from the official bill are not included in this custom-rate mode.</p>';
      bindActions(total); return;
    }
    if(unverified){
      var srows = cat.slabs.map(function(s){
        var to = (s.to === null || s.to === undefined) ? 'Above' : s.to;
        return '<tr><td>' + esc(s.from) + ' – ' + esc(to) + '</td><td><strong>VERIFY_RATE</strong></td></tr>';
      }).join('');
      out.innerHTML = '<div class="notice"><strong>Tariff not yet verified — no total is shown on purpose.</strong> '
        + 'The official rates for ' + esc(TARIFF.name) + ' in tariffs.json are still marked VERIFY_RATE. '
        + 'Showing a number now would mean inventing a rate. Ask the site owner to fill the official rates, or use the optional “my own rate” field above to estimate from your own bill.</div>'
        + '<h3>Slab structure (rates pending)</h3><table><tr><th>Units</th><th>Rate</th></tr>' + srows + '</table>'
        + '<p class="mut">Estimated bill label: <strong>Pending verification</strong>. The final bill always depends on the company’s official billing.</p>';
      bindActions(null); return;
    }
    // Verified path: slab-wise calculation, then charges line by line.
    // Slab ranges are inclusive-style (0-50, 51-100...), so each slab's width
    // is its upper bound minus the previous slab's upper bound.
    var prevUpper = 0;
    cat.slabs.forEach(function(s){
      if(remaining <= 0) return;
      var upper = (s.to === null || s.to === undefined) ? Infinity : s.to;
      var take = isFinite(upper) ? Math.min(remaining, upper - prevUpper) : remaining;
      if(isFinite(upper)) prevUpper = upper;
      if(take <= 0) return;
      var c = take * s.rate;
      rows.push(['Slab ' + s.from + ' – ' + (isFinite(upper) ? upper : 'above') + ' (' + take + ' units)', c]);
      total += c; remaining -= take;
    });
    // Solar: subtract export credit at the official export rate, if verified.
    var chSolar = TARIFF.charges || {};
    if(TARIFF.type === 'solar'){
      var expEl = document.getElementById('f-exported');
      var expUnits = expEl ? parseFloat(expEl.value) : NaN;
      if(!isNaN(expUnits) && expUnits > 0 && isNum(chSolar.export_credit_rate)){
        var credit = expUnits * chSolar.export_credit_rate;
        rows.push(['Solar export credit (' + expUnits + ' units)', -credit]);
        total -= credit;
      }
    }
    if(isNum(cat.fixed_charge)){ rows.push(['Fixed charge', cat.fixed_charge]); total += cat.fixed_charge; }
    var ch = TARIFF.charges || {};
    if(isNum(ch.fpa_per_unit)){ var f = units * ch.fpa_per_unit; rows.push(['Fuel Price Adjustment (FPA)', f]); total += f; }
    if(isNum(ch.quarterly_adjustment_per_unit)){ var q = units * ch.quarterly_adjustment_per_unit; rows.push(['Quarterly adjustment', q]); total += q; }
    if(isNum(ch.tv_fee)){ rows.push(['TV fee', ch.tv_fee]); total += ch.tv_fee; }
    var beforeTax = total;
    if(isNum(ch.electricity_duty_percent)){ var d = beforeTax * ch.electricity_duty_percent / 100; rows.push(['Electricity duty (' + ch.electricity_duty_percent + '%)', d]); total += d; }
    if(isNum(ch.gst_percent)){ var g = beforeTax * ch.gst_percent / 100; rows.push(['GST (' + ch.gst_percent + '%)', g]); total += g; }
    var chart = rows.filter(function(r){ return r[0].indexOf('Slab') === 0; }).map(function(r){
      var w = total > 0 ? Math.max(4, Math.round(r[1] / total * 100)) : 4;
      return '<div class="bar-row"><span style="min-width:170px">' + esc(r[0]) + '</span><span class="bar" style="width:' + w + '%"></span><span>' + fmt(r[1]) + '</span></div>';
    }).join('');
    out.innerHTML = '<p class="total">Estimated bill: ' + fmt(total) + '</p>'
      + '<table><tr><th>Item</th><th>Amount</th></tr>' + rows.map(function(r){ return '<tr><td>'+esc(r[0])+'</td><td>'+fmt(r[1])+'</td></tr>'; }).join('') + '</table>'
      + '<h3>Where the money goes</h3>' + chart
      + '<p class="mut">Estimated bill only. The final bill depends on the company’s official billing, meter reading, arrears and any adjustments not shown here.</p>';
    bindActions(total);
  }
  function bindActions(total){
    var copy = document.getElementById('btn-copy');
    if(copy) copy.onclick = function(){
      var t = total === null ? 'Bill estimate: pending tariff verification.' : 'Estimated bill: ' + fmt(total) + ' (estimate only, not an official bill).';
      if(navigator.clipboard) navigator.clipboard.writeText(t);
    };
    var share = document.getElementById('btn-share');
    if(share) share.onclick = function(){
      var t = total === null ? 'Bill estimate: pending tariff verification.' : 'Estimated bill: ' + fmt(total);
      if(navigator.share) navigator.share({title: document.title, text: t, url: location.href});
      else if(navigator.clipboard) navigator.clipboard.writeText(location.href);
    };
  }
  document.getElementById('btn-print').onclick = function(){ window.print(); };
  document.getElementById('btn-pdf').onclick = function(){ window.print(); };
  form.addEventListener('submit', calculate);
  var catEl = document.getElementById('f-category'), protEl = document.getElementById('f-protected');
  if(catEl) catEl.addEventListener('change', renderSlabs);
  if(protEl) protEl.addEventListener('change', renderSlabs);
  fetch(dataPath).then(function(r){ return r.json(); }).then(function(j){
    TARIFF = j.companies[companyId];
    if(!TARIFF){ out.innerHTML = '<p>Company not found in tariffs.json: ' + esc(companyId) + '</p>'; return; }
    renderSlabs();
  }).catch(function(){
    out.innerHTML = '<p>Tariff data could not be loaded. Please serve this site over http(s) so /data/tariffs.json can be fetched, or check that the file exists.</p>';
  });
})();
