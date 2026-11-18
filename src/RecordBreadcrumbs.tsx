import { Fragment, useLayoutEffect, useRef, useState } from 'react';
import { Breadcrumb, BreadcrumbList, BreadcrumbItem, BreadcrumbLink, BreadcrumbPage, BreadcrumbSeparator, BreadcrumbEllipsis, Button as VButton, Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@vini-ds/ui';
import { Menu, MenuItem } from './ui.tsx';

export type RecordBreadcrumbLevel = { label: string; title?: string; onSelect?: () => void; currentOrigin?: boolean };

export function RecordBreadcrumbs({ title, levels, onAllRecords }: { title: string; levels: RecordBreadcrumbLevel[]; onAllRecords: () => void }) {
  const navRef = useRef<HTMLElement>(null);
  const measureRef = useRef<HTMLOListElement>(null);
  const [collapsed, setCollapsed] = useState(false);
  const measureKey = JSON.stringify([title, ...levels.map(level => level.label)]);

  useLayoutEffect(() => {
    const nav = navRef.current; const measure = measureRef.current;
    if (!nav || !measure) return;
    const update = () => setCollapsed(levels.length > 0 && measure.getBoundingClientRect().width > nav.clientWidth + 1);
    update();
    if (typeof ResizeObserver === 'undefined') { window.addEventListener('resize', update); return () => window.removeEventListener('resize', update); }
    const observer = new ResizeObserver(update);
    observer.observe(nav); observer.observe(measure);
    return () => observer.disconnect();
  }, [measureKey]);

  return <Breadcrumb ref={navRef} className="record-breadcrumbs" aria-label="Путь к записи">
    <BreadcrumbList>
      <BreadcrumbItem><BreadcrumbLink render={<button type="button"/>} onClick={onAllRecords}>Все записи</BreadcrumbLink></BreadcrumbItem>
      <BreadcrumbSeparator/>
      {collapsed ? <><BreadcrumbItem><TooltipProvider><Tooltip><Menu label="Промежуточные уровни пути" align="start" trigger={<TooltipTrigger render={<VButton type="button" size="400" variant="text" aria-label="Показать промежуточные уровни пути"/>}><BreadcrumbEllipsis/></TooltipTrigger>}>{levels.map((level, index) => <MenuItem key={index} onSelect={level.onSelect ?? (() => {})} disabled={!level.onSelect}>{level.label}</MenuItem>)}</Menu><TooltipContent>Показать промежуточные уровни пути</TooltipContent></Tooltip></TooltipProvider></BreadcrumbItem><BreadcrumbSeparator/></> : levels.map((level, index) => <Fragment key={index}><BreadcrumbItem>{level.onSelect ? level.title ? <TooltipProvider><Tooltip><TooltipTrigger render={<BreadcrumbLink render={<button type="button"/>} className={level.currentOrigin ? 'card-origin' : undefined} onClick={level.onSelect}/>}>{level.label}</TooltipTrigger><TooltipContent>{level.title}</TooltipContent></Tooltip></TooltipProvider> : <BreadcrumbLink render={<button type="button"/>} className={level.currentOrigin ? 'card-origin' : undefined} onClick={level.onSelect}>{level.label}</BreadcrumbLink> : level.title ? <TooltipProvider><Tooltip><TooltipTrigger render={<span/>}>{level.label}</TooltipTrigger><TooltipContent>{level.title}</TooltipContent></Tooltip></TooltipProvider> : <span>{level.label}</span>}</BreadcrumbItem><BreadcrumbSeparator/></Fragment>)}
      <BreadcrumbItem><TooltipProvider><Tooltip><TooltipTrigger render={<BreadcrumbPage/>}>{title}</TooltipTrigger><TooltipContent>{title}</TooltipContent></Tooltip></TooltipProvider></BreadcrumbItem>
    </BreadcrumbList>
    <BreadcrumbList ref={measureRef} className="record-breadcrumb-measure" aria-hidden="true">
      <BreadcrumbItem><BreadcrumbLink render={<span/>}>Все записи</BreadcrumbLink></BreadcrumbItem><BreadcrumbSeparator/>
      {levels.map((level, index) => <Fragment key={index}><BreadcrumbItem>{level.onSelect ? <BreadcrumbLink render={<span/>}>{level.label}</BreadcrumbLink> : <span>{level.label}</span>}</BreadcrumbItem><BreadcrumbSeparator/></Fragment>)}
      <BreadcrumbItem><BreadcrumbPage>{title}</BreadcrumbPage></BreadcrumbItem>
    </BreadcrumbList>
  </Breadcrumb>;
}
