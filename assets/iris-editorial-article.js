/* C01 progressive figure inspection. Source editorial markup stays authoritative. */
(function () {
  'use strict';
  function mount(options) {
  const root = options.root;
  const figures = root.querySelectorAll(options.selector || 'figure');
  if ((!figures.length && !options.observe) || typeof HTMLDialogElement === 'undefined' ||
      typeof HTMLDialogElement.prototype.showModal !== 'function') return;
  if (root._irisImageInspector) { root._irisImageInspector.refresh(); return root._irisImageInspector; }

  const dialog = document.createElement('dialog');
  dialog.className = 'iris-article-image-dialog';
  dialog.setAttribute('aria-label', 'Imagen ampliada');
  const toolbar = document.createElement('div');
  toolbar.className = 'iris-article-image-toolbar';
  const size = document.createElement('button');
  size.type = 'button';
  size.textContent = 'Tamaño original';
  size.setAttribute('aria-pressed', 'false');
  const close = document.createElement('button');
  close.type = 'button';
  close.textContent = 'Cerrar imagen';
  const viewport = document.createElement('div');
  viewport.className = 'iris-article-image-viewport';
  viewport.tabIndex = 0;
  viewport.setAttribute('role', 'region');
  viewport.setAttribute('aria-label', 'Imagen; use las flechas para desplazarse en tamaño original');
  const enlarged = document.createElement('img');
  enlarged.className = 'iris-article-image-content';
  const caption = document.createElement('p');
  caption.className = 'iris-article-image-caption';
  toolbar.append(size, close);
  viewport.append(enlarged);
  dialog.append(toolbar, viewport, caption);
  document.body.append(dialog);
  let trigger = null;
  let position = null;
  let priorOverflow = '';
  let hostLease = null;

  function natural(enabled) {
    dialog.classList.toggle('iris-article-image-natural', enabled);
    size.setAttribute('aria-pressed', String(enabled));
    size.textContent = enabled ? 'Ajustar imagen' : 'Tamaño original';
    viewport.scrollTop = 0;
    viewport.scrollLeft = 0;
  }
  size.addEventListener('click', function () {
    natural(size.getAttribute('aria-pressed') !== 'true');
  });
  close.addEventListener('click', function () { dialog.close(); });
  dialog.addEventListener('keydown', function (event) {
    if (event.key === 'Escape') event.stopPropagation();
  });
  dialog.addEventListener('cancel', function (event) {
    event.preventDefault();
    dialog.close();
  });
  dialog.addEventListener('close', function () {
    document.documentElement.style.overflow = priorOverflow;
    if (hostLease) { hostLease.release(); hostLease = null; }
    enlarged.removeAttribute('src');
    if (trigger && trigger.isConnected) trigger.focus({ preventScroll: true });
    if (position) window.scrollTo({ left: position.x, top: position.y, behavior: 'instant' });
    trigger = null;
    position = null;
  });

  window.addEventListener('pagehide', function () { if (dialog.open) dialog.close(); });

  function refresh() {
  root.querySelectorAll(options.selector || 'figure').forEach(function (figure) {
    if (figure.querySelector('.iris-article-image-open')) return;
    const original = figure.querySelector('img');
    if (!original) return;
    const source = original.getAttribute('src') || '';
    // Only already embedded images: never fetch an URL or resolve another asset.
    if (!allowed(source, original)) return;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'iris-article-image-open';
    button.textContent = 'Ampliar imagen';
    button.addEventListener('click', function () {
      if (dialog.open || !original.isConnected || !allowed(original.getAttribute('src') || '', original)) return;
      trigger = button;
      position = { x: window.scrollX, y: window.scrollY };
      priorOverflow = document.documentElement.style.overflow;
      enlarged.setAttribute('src', original.getAttribute('src'));
      enlarged.alt = original.getAttribute('alt') || '';
      const originalCaption = figure.querySelector('figcaption');
      caption.textContent = originalCaption ? originalCaption.textContent : enlarged.alt;
      caption.hidden = !caption.textContent;
      natural(false);
      // The host may adopt this same inspector into its visible viewport.
      // Same-origin access is optional; standalone documents keep the local dialog.
      try {
        if (window.parent !== window && window.parent.irisArticleInspectorHost) {
          hostLease = window.parent.irisArticleInspectorHost.mount(window, original, dialog);
        }
      } catch (error) { hostLease = null; }
      dialog.showModal();
      document.documentElement.style.overflow = 'hidden';
      close.focus({ preventScroll: true });
    });
    figure.append(button);
  });
  }
  function allowed(source, original) {
    return /^data:image\//i.test(source) || (typeof options.allowSource === 'function' && options.allowSource(source, original));
  }
  const api = { refresh };
  root._irisImageInspector = api;
  refresh();
  if (options.observe && typeof MutationObserver !== 'undefined') {
    const observer = new MutationObserver(function () {
      if (dialog.open && trigger && !trigger.isConnected) dialog.close();
      refresh();
    });
    // Managed readers may assign src after insertion to bound request concurrency.
    observer.observe(root, { childList: true, subtree: true, attributes: true, attributeFilter: ['src'] });
    window.addEventListener('pagehide', function () { observer.disconnect(); });
  }
  return api;
  }
  window.irisArticleImageInspector = { mount };
  mount({root: document, selector: '.iep-editorial-content figure'});
}());

/* C01 mathematical viewport. Promoted from the Q06 experiment; no book identity. */
(function () {
  'use strict';
  const selector = '.iep-editorial-content .iris-editorial-equation, .publication #document .iris-editorial-equation';
  let sequence = 0;
  function mount(root = document) {
    if (root._irisEquationViewport) { root._irisEquationViewport.refresh(); return root._irisEquationViewport; }
    const entries = new Map();
    const attributes = ['tabindex', 'role', 'aria-label', 'aria-describedby'];
    let active = true;
    function restore(box, entry) {
      attributes.forEach((key, i) => entry.prior[i] === null ? box.removeAttribute(key) : box.setAttribute(key, entry.prior[i]));
    }
    function measure() {
      if (!active) return;
      entries.forEach((entry, box) => {
        const overflow = box.scrollWidth > box.clientWidth + 1;
        entry.hint.hidden = !overflow;
        if (overflow) {
          box.tabIndex = 0;
          box.setAttribute('role', entry.prior[1] || 'region');
          box.setAttribute('aria-label', entry.prior[2] || 'Fórmula desplazable');
          box.setAttribute('aria-describedby', [entry.prior[3], entry.hint.id].filter(Boolean).join(' '));
        } else restore(box, entry);
      });
    }
    const resize = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    function refresh() {
      if (!active) return;
      entries.forEach((entry, box) => {
        if (!root.contains(box)) {
          if (resize) { resize.unobserve(box); entry.children.forEach(child => resize.unobserve(child)); }
          restore(box, entry); entry.hint.remove(); entries.delete(box);
        }
      });
      root.querySelectorAll(selector).forEach(box => {
        if (entries.has(box)) return;
        const hint = document.createElement('p');
        hint.className = 'iris-equation-hint';
        do { hint.id = 'iris-equation-hint-' + (++sequence); } while (document.getElementById(hint.id));
        hint.hidden = true;
        hint.textContent = 'Desliza para ver la fórmula completa. Con teclado, usa las flechas izquierda y derecha.';
        const entry = { hint, prior: attributes.map(key => box.getAttribute(key)), children: [...box.children] };
        entries.set(box, entry); box.before(hint);
        if (resize) { resize.observe(box); entry.children.forEach(child => resize.observe(child)); }
      });
      measure();
    }
    const mutations = typeof MutationObserver === 'undefined' ? null : new MutationObserver(refresh);
    function destroy() {
      active = false;
      if (mutations) mutations.disconnect();
      if (resize) resize.disconnect();
      window.removeEventListener('resize', measure);
      entries.forEach((entry, box) => { restore(box, entry); entry.hint.remove(); });
      entries.clear(); delete root._irisEquationViewport;
    }
    const api = { refresh, destroy };
    root._irisEquationViewport = api;
    refresh();
    if (mutations) mutations.observe(root, { childList: true, subtree: true });
    window.addEventListener('resize', measure);
    if (document.fonts) document.fonts.ready.then(measure);
    return api;
  }
  window.irisEquationViewport = { mount };
  mount();
  window.addEventListener('pagehide', () => { if (document._irisEquationViewport) document._irisEquationViewport.destroy(); });
  window.addEventListener('pageshow', () => mount());
}());
