// shadcn/ui Label component adapted for vanilla JS
function createLabel(options = {}) {
  const {
    htmlFor = '',
    className = '',
    children = '',
    ...props
  } = options;

  const baseClasses = 'flex items-center gap-2 text-sm leading-none font-medium select-none group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:opacity-50 peer-disabled:cursor-not-allowed peer-disabled:opacity-50';
  
  const classes = [baseClasses, className].filter(Boolean).join(' ');

  const label = document.createElement('label');
  label.className = classes;
  label.htmlFor = htmlFor;
  label.innerHTML = children;
  
  // Add any additional attributes
  Object.entries(props).forEach(([key, value]) => {
    label.setAttribute(key, value);
  });

  return label;
}

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { createLabel };
}
