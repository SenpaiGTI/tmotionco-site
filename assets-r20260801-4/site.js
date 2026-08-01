const nav = document.getElementById('nav');
  const glow = document.getElementById('glow');
  const navlinks = document.getElementById('navlinks');
  const navburger = document.getElementById('navburger');
  let navFrame = 0;
  window.addEventListener('scroll', ()=>{
    if(navFrame) return;
    navFrame = window.requestAnimationFrame(()=>{
      nav.classList.toggle('solid', window.scrollY > 40);
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
    // re-observe reveal elements on the newly active page
    document.querySelectorAll('#page-'+name+' .reveal').forEach(el=>io.observe(el));
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

  window.addEventListener('hashchange', ()=> showPage(location.hash.replace('#','')));

  const io = 'IntersectionObserver' in window
    ? new IntersectionObserver((entries)=>{
        entries.forEach(e=>{ if(e.isIntersecting) e.target.classList.add('in'); });
      }, {threshold:0.12})
    : {observe(el){el.classList.add('in');}};

  document.querySelectorAll('.field').forEach((field, index)=>{
    const label = field.querySelector('label');
    const control = field.querySelector('input, select, textarea');
    if(label && control){
      const id = control.id || 'field-'+index;
      control.id = id;
      label.setAttribute('for', id);
    }
  });

  showPage(location.hash.replace('#','') || 'home');
