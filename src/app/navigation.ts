import type { LucideIcon } from 'lucide-react'
import {
  Camera,
  Crosshair,
  GraduationCap,
  Hand,
  House,
  Image,
  PenLine,
  Settings,
} from 'lucide-react'
import type { MessageKey } from '@/localization/locales/en'

export interface NavItem {
  to: string
  labelKey: MessageKey
  icon: LucideIcon
  /** Key for the breadcrumb / workspace heading. */
  titleKey: MessageKey
}

export interface NavGroup {
  labelKey: MessageKey
  items: NavItem[]
}

export const navigation: NavGroup[] = [
  {
    labelKey: 'nav.workspaceGroup',
    items: [
      { to: '/', labelKey: 'nav.home', titleKey: 'nav.home', icon: House },
      {
        to: '/sign-reader',
        labelKey: 'nav.signReader',
        titleKey: 'page.signReader.title',
        icon: Hand,
      },
      {
        to: '/whiteboard',
        labelKey: 'nav.whiteboard',
        titleKey: 'page.whiteboard.title',
        icon: PenLine,
      },
      { to: '/camera', labelKey: 'nav.camera', titleKey: 'page.camera.title', icon: Camera },
    ],
  },
  {
    labelKey: 'nav.libraryGroup',
    items: [
      { to: '/gallery', labelKey: 'nav.gallery', titleKey: 'page.gallery.title', icon: Image },
      {
        to: '/training',
        labelKey: 'nav.training',
        titleKey: 'page.training.title',
        icon: GraduationCap,
      },
    ],
  },
  {
    labelKey: 'nav.systemGroup',
    items: [
      {
        to: '/calibration',
        labelKey: 'nav.calibration',
        titleKey: 'page.calibration.title',
        icon: Crosshair,
      },
      {
        to: '/settings',
        labelKey: 'nav.settings',
        titleKey: 'settings.title',
        icon: Settings,
      },
    ],
  },
]

export const allNavItems: NavItem[] = navigation.flatMap((group) => group.items)

export function navItemForPath(pathname: string): NavItem | undefined {
  if (pathname === '/') return allNavItems[0]
  return allNavItems.find((item) => item.to !== '/' && pathname.startsWith(item.to))
}
