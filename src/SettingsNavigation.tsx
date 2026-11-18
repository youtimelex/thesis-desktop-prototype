import { Sidebar, SidebarHeader, SidebarContent, SidebarMenu, SidebarMenuItem, SidebarMenuButton, SidebarGroup, SidebarGroupLabel, useSidebar, TooltipProvider, Tooltip, TooltipTrigger, TooltipContent } from '@vini-ds/ui';
import { Icon } from './ui.tsx';
import { useNav } from './navigation.tsx';
export const settingsSections = [
 { id: 'connection', label: 'Подключение', icon: 'database' },
 { id: 'appearance', label: 'Оформление', icon: 'settings' },
 { id: 'account', label: 'Аккаунт', icon: 'user' },
 { id: 'recording', label: 'Запись и отправка', icon: 'microphone' },
 { id: 'notifications', label: 'Уведомления', icon: 'bell' },
 { id: 'storage', label: 'Хранилище', icon: 'folder' },
] as const;
export function SettingsSidebar({onBack, compact = false}: {onBack: () => void; compact?: boolean}) {
 const {route,go} = useNav();
 const selected = route.page === 'settings' ? route.section ?? 'connection' : 'connection';
 const items = settingsSections;
 const {setOpenMobile}=useSidebar();
 const navigate=(action:()=>void)=>{action();setOpenMobile(false);};
 return <Sidebar variant="inset" collapsible={compact ? 'none' : 'offcanvas'} className="atlas-sidebar dashboard-settings-sidebar" aria-label="Навигация настроек">
  <TooltipProvider><SidebarContent><nav aria-label="Возврат в приложение"><SidebarGroup><SidebarMenu><SidebarMenuItem><Tooltip><TooltipTrigger render={<SidebarMenuButton onClick={()=>navigate(onBack)} aria-label="Назад в приложение"><Icon name="arrowLeft" size={19}/><span>Назад в приложение</span></SidebarMenuButton>}/><TooltipContent>Назад в приложение</TooltipContent></Tooltip></SidebarMenuItem></SidebarMenu></SidebarGroup></nav><SidebarGroup><SidebarGroupLabel>Настройки</SidebarGroupLabel><nav aria-label="Разделы настроек"><SidebarMenu>{items.map(item=><SidebarMenuItem key={item.id}><Tooltip><TooltipTrigger render={<SidebarMenuButton isActive={selected===item.id} aria-current={selected===item.id?'page':undefined} aria-label={item.label} onClick={()=>navigate(()=>go({page:'settings',section:item.id}))}><Icon name={item.icon} size={19}/><span>{item.label}</span></SidebarMenuButton>}/><TooltipContent>{item.label}</TooltipContent></Tooltip></SidebarMenuItem>)}</SidebarMenu></nav></SidebarGroup></SidebarContent></TooltipProvider>
 </Sidebar>;
}
