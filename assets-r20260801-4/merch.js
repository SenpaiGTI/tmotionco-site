(function () {
  var grid = document.getElementById('merch-grid');
  var status = document.getElementById('merch-status');
  var loaded = false;

  function money(cents) {
    return '$' + (cents / 100).toFixed(2);
  }

  function showBanner(kind, text) {
    var el = document.getElementById('merch-banner');
    if (!el) return;
    el.className = 'merch-banner show ' + kind;
    el.textContent = text;
  }

  function renderSkeletons(count) {
    grid.innerHTML = '';
    for (var i = 0; i < count; i++) {
      var s = document.createElement('div');
      s.className = 'merch-card merch-skeleton';
      s.innerHTML = '<div class="merch-skel-img"></div><div class="merch-card-body">' +
        '<div class="merch-skel-line" style="width:80%"></div>' +
        '<div class="merch-skel-line" style="width:50%;height:38px;border-radius:10px;"></div>' +
        '<div class="merch-skel-line" style="width:30%"></div>' +
        '<div class="merch-skel-line" style="height:44px;border-radius:60px;"></div>' +
        '</div>';
      grid.appendChild(s);
    }
  }

  function renderProducts(products) {
    if (!products.length) {
      status.textContent = '';
      grid.innerHTML = '<p class="merch-empty">No products available right now — check back soon.</p>';
      return;
    }
    status.textContent = '';
    grid.innerHTML = '';
    products.forEach(function (p, index) {
      var card = document.createElement('div');
      card.className = 'merch-card';
      card.style.animationDelay = (index * 0.06) + 's';

      var imgWrap = document.createElement('div');
      imgWrap.className = 'merch-img-wrap';
      var img = document.createElement('img');
      img.src = p.variantImages[p.variants[0].id] || '';
      img.alt = p.title;
      img.loading = 'lazy';
      imgWrap.appendChild(img);
      card.appendChild(imgWrap);

      var body = document.createElement('div');
      body.className = 'merch-card-body';

      var h3 = document.createElement('h3');
      h3.textContent = p.title;
      body.appendChild(h3);

      var controlsRow = document.createElement('div');
      controlsRow.className = 'merch-controls';

      var select = document.createElement('select');
      select.className = 'merch-select';
      select.setAttribute('aria-label', 'Choose option for ' + p.title);
      p.variants.forEach(function (v) {
        var opt = document.createElement('option');
        opt.value = v.id;
        opt.textContent = v.title;
        select.appendChild(opt);
      });
      controlsRow.appendChild(select);
      body.appendChild(controlsRow);

      var price = document.createElement('div');
      price.className = 'merch-price';
      price.textContent = money(p.variants[0].price);
      body.appendChild(price);

      select.addEventListener('change', function () {
        var v = p.variants.find(function (x) { return String(x.id) === select.value; });
        if (!v) return;
        price.textContent = money(v.price);
        var newSrc = p.variantImages[v.id];
        if (newSrc && newSrc !== img.src) {
          img.classList.add('swap');
          var pre = new Image();
          pre.onload = function () {
            img.src = newSrc;
            requestAnimationFrame(function () { img.classList.remove('swap'); });
          };
          pre.src = newSrc;
        }
      });

      var buyBtn = document.createElement('button');
      buyBtn.className = 'btn-primary merch-buy';
      buyBtn.textContent = 'Buy Now';
      buyBtn.addEventListener('click', function () {
        buyBtn.disabled = true;
        buyBtn.textContent = 'Redirecting…';
        fetch('/api/checkout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ product_id: p.id, variant_id: parseInt(select.value, 10), quantity: 1 }),
        })
          .then(function (r) { return r.json(); })
          .then(function (data) {
            if (data.url) {
              window.location.href = data.url;
            } else {
              showBanner('error', data.error || 'Something went wrong starting checkout.');
              buyBtn.disabled = false;
              buyBtn.textContent = 'Buy Now';
            }
          })
          .catch(function () {
            showBanner('error', 'Network error — please try again.');
            buyBtn.disabled = false;
            buyBtn.textContent = 'Buy Now';
          });
      });
      body.appendChild(buyBtn);

      card.appendChild(body);
      grid.appendChild(card);
    });
  }

  function loadProducts() {
    if (loaded) return;
    loaded = true;
    status.textContent = '';
    renderSkeletons(4);
    fetch('/api/products')
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (data.error) {
          grid.innerHTML = '<p class="merch-empty">Store temporarily unavailable — please check back shortly.</p>';
          return;
        }
        renderProducts(data.products || []);
      })
      .catch(function () {
        grid.innerHTML = '<p class="merch-empty">Store temporarily unavailable — please check back shortly.</p>';
      });
  }

  function checkSuccess() {
    var params = new URLSearchParams(window.location.search);
    if (params.get('session_id')) {
      showBanner('success', "Order placed! You'll get a confirmation email shortly, and we'll email tracking once it ships.");
      var cleanUrl = window.location.pathname + window.location.hash;
      window.history.replaceState({}, '', cleanUrl);
    }
  }

  function initIfMerchActive() {
    if (window.location.hash.replace('#', '') === 'merch') {
      loadProducts();
    }
  }

  window.addEventListener('hashchange', initIfMerchActive);
  document.addEventListener('DOMContentLoaded', function () {
    checkSuccess();
    initIfMerchActive();
  });
})();
