import type { ReactNode } from 'react';
import { Heading, Badge, Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@vini-ds/ui';
import './space-pages.css';

/** Shared product heading composition; typography and counter use VINi components. */
export function PageHeader({ title, count, description, actions, descriptionBelowActions = false, truncateTitle = false }: { title: string; count?: number; description?: string; actions?: ReactNode; descriptionBelowActions?: boolean; truncateTitle?: boolean }) {
  const below = Boolean(description && descriptionBelowActions);
  return <header className={`page-heading shared-page-header${below ? ' shared-page-header--description-below' : ''}${truncateTitle ? ' shared-page-header--truncate-title' : ''}`}><div className="shared-page-header-copy"><div className="title-with-count"><Heading level={1} token="desktop/headline/medium/1000">{truncateTitle ? <TooltipProvider><Tooltip><TooltipTrigger render={<span/>}>{title}</TooltipTrigger><TooltipContent>{title}</TooltipContent></Tooltip></TooltipProvider> : title}</Heading>{count !== undefined && <Badge variant="outline" color="main" aria-label={`Всего: ${count}`}>{count}</Badge>}</div>{description && !below && <p className="page-description">{description}</p>}</div>{actions && <div className="heading-actions">{actions}</div>}{below && <p className="page-description">{description}</p>}</header>;
}

/** Shared section band: heading/actions plus optional search and filters. */
export function PanelHeader({children, className = ""}: {children: ReactNode; className?: string}) {
  return <div className={`section-header ${className}`}>{children}</div>;
}
