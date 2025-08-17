// shadcn/ui Components Utility File
// This file provides access to all shadcn/ui components for the reformately.com app

// Import all component functions
const { createButton } = await import('./components/ui/button.js');
const { createCard, createCardHeader, createCardTitle, createCardDescription, createCardContent, createCardFooter } = await import('./components/ui/card.js');
const { createInput } = await import('./components/ui/input.js');
const { createSelect, createSelectItem } = await import('./components/ui/select.js');
const { createBadge } = await import('./components/ui/badge.js');
const { createLabel } = await import('./components/ui/label.js');

// Export all components for use in other files
window.shadcn = {
  Button: createButton,
  Card: createCard,
  CardHeader: createCardHeader,
  CardTitle: createCardTitle,
  CardDescription: createCardDescription,
  CardContent: createCardContent,
  CardFooter: createCardFooter,
  Input: createInput,
  Select: createSelect,
  SelectItem: createSelectItem,
  Badge: createBadge,
  Label: createLabel
};

// Also make them available globally for easier access
window.createButton = createButton;
window.createCard = createCard;
window.createCardHeader = createCardHeader;
window.createCardTitle = createCardTitle;
window.createCardDescription = createCardDescription;
window.createCardContent = createCardContent;
window.createCardFooter = createCardFooter;
window.createInput = createInput;
window.createSelect = createSelect;
window.createSelectItem = createSelectItem;
window.createBadge = createBadge;
window.createLabel = createLabel;

console.log('shadcn/ui components loaded successfully!');
