export type MenuTab = 'options' | 'themes' | 'templates' | 'statistics' | 'data'

export const OPTIONS_MENU_TABS: Array<{ id: MenuTab; label: string }> = [
  { id: 'options', label: 'Options' },
  { id: 'themes', label: 'Themes' },
  { id: 'templates', label: 'Templates' },
  { id: 'statistics', label: 'Statistics' },
  { id: 'data', label: 'Data' },
]
