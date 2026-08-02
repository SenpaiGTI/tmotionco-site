const nav = document.getElementById('nav');
  const glow = document.getElementById('glow');
  const navlinks = document.getElementById('navlinks');
  const navburger = document.getElementById('navburger');
  const mobileCtaBar = document.getElementById('mobileCtaBar');
  let navFrame = 0;
  window.addEventListener('scroll', ()=>{
    if(navFrame) return;
    navFrame = window.requestAnimationFrame(()=>{
      nav.classList.toggle('solid', window.scrollY > 40);
      if(mobileCtaBar) mobileCtaBar.classList.toggle('visible', window.scrollY > window.innerHeight * 0.6);
      navFrame = 0;
    });
  }, {passive:true});
  window.addEventListener('mousemove', (e)=>{
    glow.style.left = e.clientX+'px';
    glow.style.top = e.clientY+'px';
  }, {passive:true});

  navburger.addEventListener('click', ()=>{
    const open = navlinks.classList.toggle('open');
    navburger.setAttribute('aria-expanded', String(open));
    navburger.setAttribute('aria-label', open ? 'Close navigation menu' : 'Open navigation menu');
  });

  const pages = ['home','about','services','clients','contact','privacy','terms'];
  function showPage(name){
    if(!pages.includes(name)) name = 'home';
    pages.forEach(p=>{
      document.getElementById('page-'+p).classList.toggle('active', p===name);
    });
    document.querySelectorAll('.navlinks a[data-link]').forEach(a=>{
      a.classList.toggle('current', a.getAttribute('data-link')===name);
    });
    window.scrollTo({top:0, left:0, behavior:'auto'});
    navlinks.classList.remove('open');
    navburger.setAttribute('aria-expanded', 'false');
    navburger.setAttribute('aria-label', 'Open navigation menu');
    // re-observe reveal elements on the newly active page (double rAF ensures
    // the browser has flushed layout for the just-shown page before we observe,
    // since IntersectionObserver can evaluate stale geometry otherwise)
    requestAnimationFrame(()=>{
      requestAnimationFrame(()=>{
        const revealEls = document.querySelectorAll('#page-'+name+' .reveal');
        revealEls.forEach(el=>io.observe(el));
        // safety net: if an element hasn't revealed itself within 1.5s for any
        // reason (observer edge case, slow device, etc.), force it visible so
        // content can never get permanently stuck invisible.
        setTimeout(()=>{
          revealEls.forEach(el=>el.classList.add('in'));
        }, 1500);
      });
    });
  }

  function go(name){
    if(location.hash.replace('#','') === name){ showPage(name); }
    else { location.hash = name; }
  }

  document.querySelectorAll('[data-link]').forEach(el=>{
    const destination = el.getAttribute('data-link');
    if(el.tagName === 'A'){
      el.setAttribute('href', '#'+destination);
    } else {
      el.setAttribute('role', 'link');
      el.setAttribute('tabindex', '0');
      el.addEventListener('keydown', (e)=>{
        if(e.key === 'Enter' || e.key === ' '){
          e.preventDefault();
          go(destination);
        }
      });
    }
    el.addEventListener('click', (e)=>{ e.preventDefault(); go(el.getAttribute('data-link')); });
  });

  document.addEventListener('keydown', (e)=>{
    if(e.key === 'Escape' && navlinks.classList.contains('open')){
      navlinks.classList.remove('open');
      navburger.setAttribute('aria-expanded', 'false');
      navburger.setAttribute('aria-label', 'Open navigation menu');
      navburger.focus();
    }
  });

  document.querySelectorAll('.proof-strip-item').forEach(el=>{
    el.addEventListener('click', ()=>{
      el.classList.remove('pulse');
      void el.offsetWidth; // restart animation if clicked again quickly
      el.classList.add('pulse');
    });
  });

  window.addEventListener('hashchange', ()=> showPage(location.hash.replace('#','')));

  const io = 'IntersectionObserver' in window
    ? new IntersectionObserver((entries)=>{
        entries.forEach(e=>{ if(e.isIntersecting) e.target.classList.add('in'); });
      }, {threshold:0.12})
    : {observe(el){el.classList.add('in');}};

  showPage(location.hash.replace('#','') || 'home');
