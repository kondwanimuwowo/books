// Pill-style section tabs (account, admin). Link merges activeProps/inactiveProps into className,
// so colours live only in the state props or they would clash.
export const tabClass = 'pill shrink-0 shadow-sm'
export const activeTab = { className: 'bg-accent-700 text-white hover:bg-accent-700 hover:text-white' }
export const inactiveTab = { className: 'bg-white text-ink hover:bg-neutral-100 hover:text-ink' }
