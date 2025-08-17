// shadcn/ui Card component adapted for vanilla JS
function createCard(options = {}) {
  const {
    className = '',
    children = '',
    ...props
  } = options;

  const baseClasses = 'bg-card text-card-foreground flex flex-col gap-6 rounded-xl border py-6 shadow-sm';
  const classes = [baseClasses, className].filter(Boolean).join(' ');

  const card = document.createElement('div');
  card.className = classes;
  card.innerHTML = children;
  
  // Add any additional attributes
  Object.entries(props).forEach(([key, value]) => {
    card.setAttribute(key, value);
  });

  return card;
}

function createCardHeader(options = {}) {
  const {
    className = '',
    children = '',
    ...props
  } = options;

  const baseClasses = 'grid auto-rows-min grid-rows-[auto_auto] items-start gap-1.5 px-6';
  const classes = [baseClasses, className].filter(Boolean).join(' ');

  const header = document.createElement('div');
  header.className = classes;
  header.innerHTML = children;
  
  Object.entries(props).forEach(([key, value]) => {
    header.setAttribute(key, value);
  });

  return header;
}

function createCardTitle(options = {}) {
  const {
    className = '',
    children = '',
    ...props
  } = options;

  const baseClasses = 'leading-none font-semibold';
  const classes = [baseClasses, className].filter(Boolean).join(' ');

  const title = document.createElement('div');
  title.className = classes;
  title.innerHTML = children;
  
  Object.entries(props).forEach(([key, value]) => {
    title.setAttribute(key, value);
  });

  return title;
}

function createCardDescription(options = {}) {
  const {
    className = '',
    children = '',
    ...props
  } = options;

  const baseClasses = 'text-muted-foreground text-sm';
  const classes = [baseClasses, className].filter(Boolean).join(' ');

  const description = document.createElement('div');
  description.className = classes;
  description.innerHTML = children;
  
  Object.entries(props).forEach(([key, value]) => {
    description.setAttribute(key, value);
  });

  return description;
}

function createCardContent(options = {}) {
  const {
    className = '',
    children = '',
    ...props
  } = options;

  const baseClasses = 'px-6';
  const classes = [baseClasses, className].filter(Boolean).join(' ');

  const content = document.createElement('div');
  content.className = classes;
  content.innerHTML = children;
  
  Object.entries(props).forEach(([key, value]) => {
    content.setAttribute(key, value);
  });

  return content;
}

function createCardFooter(options = {}) {
  const {
    className = '',
    children = '',
    ...props
  } = options;

  const baseClasses = 'flex items-center px-6';
  const classes = [baseClasses, className].filter(Boolean).join(' ');

  const footer = document.createElement('div');
  footer.className = classes;
  footer.innerHTML = children;
  
  Object.entries(props).forEach(([key, value]) => {
    footer.setAttribute(key, value);
  });

  return footer;
}

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { 
    createCard, 
    createCardHeader, 
    createCardTitle, 
    createCardDescription, 
    createCardContent, 
    createCardFooter 
  };
}
