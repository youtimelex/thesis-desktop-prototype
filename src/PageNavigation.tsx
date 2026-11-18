import {Fragment,useEffect,useState,type ReactNode} from 'react';
import {createPortal} from 'react-dom';
import {Breadcrumb,BreadcrumbList,BreadcrumbItem,BreadcrumbLink,BreadcrumbPage,BreadcrumbSeparator,Tooltip,TooltipContent,TooltipProvider,TooltipTrigger} from '@vini-ds/ui';
import {useNav} from './navigation.tsx';
import {useStore} from './store.tsx';
import {areaName} from './model.ts';
import type {Route} from './types.ts';
export function PageNavigation(){
 const {route,go}=useNav();const {state}=useStore();
 const path:{label:string;route?:Route}[]=[];
 const spaces=()=>path.push({label:'Пространства',route:{page:'workspaces'}});
 const area=(id:string)=>{spaces();path.push({label:areaName(id,state),route:{page:'library',scope:{kind:'area',areaId:id}}});};
 if(route.page==='library'||route.page==='search'){
  if(route.scope.kind==='all')path.push({label:'Все записи',route:{page:'library',scope:{kind:'all'}}});
  else {area(route.scope.areaId??'personal');if(route.scope.kind==='folder')path.push({label:route.scope.folderId==='root'?'Без папки':state.folders.find(f=>f.id===route.scope.folderId)?.name??'Папка'});}
  if(route.page==='search')path.push({label:'Поиск'});
 }else if(route.page==='members'||route.page==='folders'){
  if(route.areaId)area(route.areaId);else path.push({label:'Хранилище',route:{page:'settings',section:'storage'}});
  path.push({label:route.page==='members'?'Участники':'Папки'});
 }else if(route.page==='assistant'){
  path.push({label:'Ассистент',route:route.id?{page:'assistant',listScope:route.listScope,listSearch:route.listSearch}:undefined});
 }else if(route.page==='settings'){
  path.push({label:'Настройки',route:{page:'settings'}});path.push({label:({connection:'Подключение',appearance:'Оформление',account:'Аккаунт',recording:'Запись и отправка',notifications:'Уведомления',storage:'Хранилище'} as Record<string,string>)[route.section??'connection']??'Настройки'});
 }else path.push({label:({home:'Главная',workspaces:'Пространства',record:'Запись',meeting:'Совещание',recorder:'Диктофон'} as Record<string,string>)[route.page]??'Тезис'});
 return <Breadcrumb aria-label="Навигация страницы"><BreadcrumbList>{path.map((part,i)=><Fragment key={i}>{i>0&&<BreadcrumbSeparator/>}<BreadcrumbItem>{part.route&&(i<path.length-1||route.page==='assistant'&&route.id)?<BreadcrumbLink render={<button type="button"/>} onClick={()=>go(part.route!)}>{part.label}</BreadcrumbLink>:<TooltipProvider><Tooltip><TooltipTrigger render={<BreadcrumbPage/>}>{part.label}</TooltipTrigger><TooltipContent>{part.label}</TooltipContent></Tooltip></TooltipProvider>}</BreadcrumbItem></Fragment>)}</BreadcrumbList></Breadcrumb>;
}
// Preserve the record's existing source-aware return handlers and actions in the shared shell.
export function ShellToolbar({children}:{children:ReactNode}){const [host,setHost]=useState<HTMLElement|null>(null);useEffect(()=>{setHost(document.getElementById('page-toolbar-slot'));},[]);return host?createPortal(children,host):null;}
