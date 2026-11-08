/* Opt-in C01 comic layout. Viewports over the approved image, in reading order. */
(() => {
  const figure = document.querySelector('[data-iris-comic-split] figure');
  const original = figure?.querySelector(':scope > img');
  if (!original) return;

  const ns = 'http://www.w3.org/2000/svg';
  const svgElement = (tag, attrs) => {
    const element = document.createElementNS(ns, tag);
    for (const [name, value] of Object.entries(attrs)) element.setAttribute(name, value);
    return element;
  };

  const [x, y, width, height] = figure.parentElement.dataset.irisComicSplit.split(' ').map(Number);

  original.decode().then(() => {
    if (original.naturalWidth !== width || original.naturalHeight !== height) return;

    const bounds = [[0, 0, x, y], [x, 0, width - x, y],
      [0, y, x, height - y], [x, y, width - x, height - y]];
    const panels = document.createElement('div');
    panels.className = 'iris-article-comic-panels';
    panels.setAttribute('role', 'group');
    panels.setAttribute('aria-label', original.alt);

    const sourceId = 'iris-article-comic-source';
    const source = svgElement('image', {
      id: sourceId, href: original.getAttribute('src'), width, height
    });

    bounds.forEach(([x, y, width, height], index) => {
      const panel = svgElement('svg', {
        viewBox: [x, y, width, height].join(' '), width, height,
        role: 'img', 'aria-label': 'Viñeta ' + (index + 1) + ' de 4'
      });
      if (index === 0) {
        const defs = svgElement('defs', {});
        defs.append(source);
        panel.append(defs);
      }
      panel.append(svgElement('use', {href: '#' + sourceId}));
      panels.append(panel);
    });
    original.before(panels);
  }).catch(() => {
    // Keep the standard figure if the approved image cannot be decoded.
  });
})();
