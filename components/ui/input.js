// shadcn/ui Input component adapted for vanilla JS
function createInput(options = {}) {
  const {
    type = 'text',
    className = '',
    placeholder = '',
    value = '',
    ...props
  } = options;

  const baseClasses = 'file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground dark:bg-input/30 border-input flex h-9 w-full min-w-0 rounded-md border bg-transparent px-3 py-1 text-base shadow-sm transition-[color,box-shadow] outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive';
  
  const classes = [baseClasses, className].filter(Boolean).join(' ');

  const input = document.createElement('input');
  input.type = type;
  input.className = classes;
  input.placeholder = placeholder;
  input.value = value;
  
  // Add any additional attributes
  Object.entries(props).forEach(([key, value]) => {
    if (key.startsWith('on')) {
      input.addEventListener(key.slice(2).toLowerCase(), value);
    } else {
      input.setAttribute(key, value);
    }
  });

  return input;
}

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { createInput };
}
