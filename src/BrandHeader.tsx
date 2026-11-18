import {SidebarHeader,SidebarTrigger,ItemMedia,useSidebar,TooltipProvider,Tooltip,TooltipTrigger,TooltipContent} from '@vini-ds/ui';
import {useStore} from './store.tsx';
import {useNav} from './navigation.tsx';
import {Icon} from './ui.tsx';
export function BrandHeader(){
 const {state}=useStore();const {isMobile,setOpenMobile}=useSidebar();const {go,route}=useNav();
 return <SidebarHeader><div className="atlas-brand-row"><TooltipProvider><Tooltip><TooltipTrigger render={<button type="button" className="atlas-brand" aria-label="Vinteo Тезис — на главную" aria-current={route.page==='home'?'page':undefined} onClick={()=>{go({page:'home'});setOpenMobile(false);}}><ItemMedia variant="icon" aria-hidden="true"><Icon name="organization" size={20}/></ItemMedia><span className="server-copy"><strong>Vinteo Тезис</strong><small>{state.server?.address??'Укажите адрес'}</small></span></button>}/><TooltipContent>На главную</TooltipContent></Tooltip></TooltipProvider>{isMobile&&<SidebarTrigger aria-label="Закрыть навигацию"/>}</div></SidebarHeader>;
}
