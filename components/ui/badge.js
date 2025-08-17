// shadcn/ui Badge component adapted for vanilla JS
function createBadge(options = {}) {
  const {
    variant = 'default',
    className = '',
    children = '',
    ...props
  } = options;

  const baseClasses = 'inline-flex items-center justify-center rounded-md border px-2 py-0.5 text-xs font-medium w-fit whitespace-nowrap shrink-0 [&>svg]:size-3 gap-1 [&>svg]:pointer-events-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive transition-[color,box-shadow] overflow-hidden';
  
  const variantClasses = {
    default: 'border-transparent bg-primary text-primary-foreground [a&]:hover:bg-primary/90',
    secondary: 'border-transparent bg-secondary text-secondary-foreground [a&]:hover:bg-secondary/90',
    destructive: 'border-transparent bg-destructive text-white [a&]:hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 dark:bg-destructive/60',
    outline: 'text-foreground [a&]:hover:bg-accent [a&]:hover:text-accent-foreground'
  };
  
  const classes = [
    baseClasses,
    variantClasses[variant] || variantClasses.default,
    className
  ].filter(Boolean).join(' ');

  const badge = document.createElement('span');
  badge.className = classes;
  badge.innerHTML = children;
  
  // Add any additional attributes
  Object.entries(props).forEach(([key, value]) => {
    badge.setAttribute(key, value);
  });

  return badge;
}

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { createBadge };
}
