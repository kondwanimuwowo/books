// Pill-style section tabs (account, admin). Link merges activeProps/inactiveProps into className,
// so colours live only in the state props or they would clash.
export const tabClass = 'pill shrink-0 shadow-sm'
export const activeTab = { className: 'bg-accent text-on-accent hover:bg-accent hover:text-on-accent' }
export const inactiveTab = { className: 'bg-surface text-ink hover:bg-sunken hover:text-ink' }
