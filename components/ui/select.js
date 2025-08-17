// shadcn/ui Select component adapted for vanilla JS
function createSelect(options = {}) {
  const {
    className = '',
    children = '',
    ...props
  } = options;

  const baseClasses = 'border-input data-[placeholder]:text-muted-foreground [&_svg:not([class*='text-'])]:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:bg-input/30 dark:hover:bg-input/50 flex w-fit items-center justify-between gap-2 rounded-md border bg-transparent px-3 py-2 text-sm whitespace-nowrap shadow-sm transition-[color,box-shadow] outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50 h-9';
  
  const classes = [baseClasses, className].filter(Boolean).join(' ');

  const select = document.createElement('select');
  select.className = classes;
  select.innerHTML = children;
  
  // Add any additional attributes
  Object.entries(props).forEach(([key, value]) => {
    if (key.startsWith('on')) {
      select.addEventListener(key.slice(2).toLowerCase(), value);
    } else {
      select.setAttribute(key, value);
    }
  });

  return select;
}

function createSelectItem(options = {}) {
  const {
    value = '',
    className = '',
    children = '',
    ...props
  } = options;

  const baseClasses = 'focus:bg-accent focus:text-accent-foreground [&_svg:not([class*='text-'])]:text-muted-foreground relative flex w-full cursor-default items-center gap-2 rounded-sm py-1.5 pr-8 pl-2 text-sm outline-hidden select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4';
  
  const classes = [baseClasses, className].filter(Boolean).join(' ');

  const option = document.createElement('option');
  option.className = classes;
  option.value = value;
  option.innerHTML = children;
  
  Object.entries(props).forEach(([key, value]) => {
    option.setAttribute(key, value);
  });

  return option;
}

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { createSelect, createSelectItem };
}
