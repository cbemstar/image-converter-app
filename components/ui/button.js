// shadcn/ui Button component adapted for vanilla JS
function createButton(options = {}) {
  const {
    variant = 'default',
    size = 'default',
    className = '',
    children = '',
    ...props
  } = options;

  const baseClasses = 'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2';
  
  const variantClasses = {
    default: 'bg-primary text-primary-foreground hover:bg-primary/90',
    secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
    outline: 'border border-input bg-background hover:bg-accent hover:text-accent-foreground',
    ghost: 'hover:bg-accent hover:text-accent-foreground',
    link: 'text-primary underline-offset-4 hover:underline',
    destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90'
  };
  
  const sizeClasses = {
    default: 'h-9 px-4 py-2',
    sm: 'h-8 rounded-md px-3 py-1.5',
    lg: 'h-10 rounded-md px-6 py-2.5',
    icon: 'h-9 w-9'
  };

  const classes = [
    baseClasses,
    variantClasses[variant] || variantClasses.default,
    sizeClasses[size] || sizeClasses.default,
    className
  ].filter(Boolean).join(' ');

  const button = document.createElement('button');
  button.className = classes;
  button.innerHTML = children;
  
  // Add any additional attributes
  Object.entries(props).forEach(([key, value]) => {
    if (key.startsWith('on')) {
      button.addEventListener(key.slice(2).toLowerCase(), value);
    } else {
      button.setAttribute(key, value);
    }
  });

  return button;
}

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { createButton };
}
