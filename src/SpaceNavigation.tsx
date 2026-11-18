import { WorkspaceRenameDialog, WorkspaceRenameMenuItem } from './WorkspaceRename.tsx';
import {useEffect,useRef,useState} from 'react';
import { SidebarMenu, SidebarMenuItem, SidebarMenuButton, SidebarMenuAction, SidebarMenuBadge, DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, useSidebar, TooltipProvider, Tooltip, TooltipTrigger, TooltipContent } from '@vini-ds/ui';
import { areaRecordCount, canManageInvitationDrafts, pluralRecords, workspaceList } from './model.ts';
import { useStore } from './store.tsx';
import { useNav } from './navigation.tsx';
import { Icon, MenuItem } from './ui.tsx';

// VINi Atlas Default / Projects pattern. Product supplies destinations and content.
export function SpaceNavigation({ activeArea }: { activeArea?: string | null }) {
 const {state}=useStore(); const {openList,go,route}=useNav(); const {isMobile,setOpenMobile}=useSidebar();
 const [renameId,setRenameId]=useState<string|null>(null);
 const menuActions=useRef(new Map<string,HTMLElement>());
 const [hover,setHover]=useState(()=>window.matchMedia('(hover:hover) and (pointer:fine)').matches);
 useEffect(()=>{const q=window.matchMedia('(hover:hover) and (pointer:fine)');const sync=()=>setHover(q.matches);q.addEventListener('change',sync);return()=>q.removeEventListener('change',sync);},[]);
 const navigate=(action:()=>void)=>{action();setOpenMobile(false);};
 const spaces=[{id:'personal',name:'Личное',members:[]},...workspaceList(state)];
 return <><TooltipProvider><nav aria-label="Пространства"><SidebarMenu><SidebarMenuItem><SidebarMenuButton isActive={route.page==='workspaces'} aria-current={route.page==='workspaces'?'page':undefined} aria-label="Все пространства" onClick={()=>navigate(()=>go({page:'workspaces'}))}><Icon name="listAlt" size={16}/><span>Все пространства</span></SidebarMenuButton></SidebarMenuItem>{spaces.map(space=>{
  const count=areaRecordCount(state,space.id);
  const folders=state.folders.filter(f=>f.areaId===space.id&&f.server===state.server?.address);
  return <SidebarMenuItem key={space.id} className="space-nav-item" data-action-hover={hover ? 'true' : 'false'}>
   <Tooltip><TooltipTrigger render={<SidebarMenuButton className="atlas-project-link" isActive={activeArea===space.id} aria-current={activeArea===space.id?'page':undefined} aria-label={`Пространство: ${space.name}`} aria-description={pluralRecords(count)} onClick={()=>navigate(()=>openList({kind:'area',areaId:space.id}))}>
    <Icon name={space.id==='personal'?'user':'sensorDoor'} size={16}/><span>{space.name}</span>
   </SidebarMenuButton>}/><TooltipContent>{space.name} · {pluralRecords(count)}</TooltipContent></Tooltip>
   <SidebarMenuBadge className="space-nav-count" aria-hidden="true">{count}</SidebarMenuBadge>
   <DropdownMenu><DropdownMenuTrigger render={<SidebarMenuAction ref={element=>{if(element)menuActions.current.set(space.id,element);else menuActions.current.delete(space.id);}} showOnHover={hover} aria-label={`Действия пространства: ${space.name}`} />}><Icon name="more" size={16}/></DropdownMenuTrigger>
    <DropdownMenuContent side={isMobile?'bottom':'right'} align={isMobile?'end':'start'} className="atlas-project-menu" finalFocus={closeType=>{
     if(closeType!=='mouse'&&closeType!=='touch'&&closeType!=='pen')return true;
     // Pointer dismissal must also release focus from a second click on the trigger.
     // Wait for the menu's focus cleanup so it cannot restore the focus-within state.
     const action=menuActions.current.get(space.id);
     queueMicrotask(()=>action?.blur());
     return false;
    }}>
     <WorkspaceRenameMenuItem workspaceId={space.id} onRename={setRenameId}/>
     <MenuItem icon="folder" onSelect={()=>navigate(()=>go({page:'folders',areaId:space.id}))}>Управление папками</MenuItem>
     {(space.members.length>0 || canManageInvitationDrafts(state,space.id))&&<MenuItem icon="users" onSelect={()=>navigate(()=>go({page:'members',areaId:space.id}))}>Участники</MenuItem>}
     {[{id:'root',name:space.id==='personal'?'Без папки':'В корне пространства'},...folders].map(folder=><MenuItem key={folder.id} icon={folder.id==='root'?'file':'folder'} onSelect={()=>navigate(()=>openList({kind:'folder',areaId:space.id,folderId:folder.id}))}>{folder.name}</MenuItem>)}
    </DropdownMenuContent>
   </DropdownMenu>
  </SidebarMenuItem>;
 })}</SidebarMenu></nav></TooltipProvider><WorkspaceRenameDialog workspaceId={renameId} onClose={()=>setRenameId(null)}/></>;
}
