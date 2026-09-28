/* Icons: <use> references into /static/icons.svg (pinned, self-hosted, no CDN). */
window.sf = window.sf || {};
sf.icon = (name, { label = '', className = '' } = {}) => {
  const a11y = label ? `role="img" aria-label="${label.replace(/"/g, '&quot;')}"` : 'aria-hidden="true"';
  return `<svg class="sf-icon ${className}" ${a11y} focusable="false"><use href="/static/icons.svg#i-${name}"></use></svg>`;
};
