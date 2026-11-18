import { Avatar as VAvatar, AvatarFallback, Empty as VEmpty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription, EmptyContent } from '@vini-ds/ui';
import { Combobox, ComboboxInput, ComboboxContent, ComboboxList, ComboboxItem, ComboboxEmpty } from '@vini-ds/ui';
import { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent } from '@vini-ds/ui';
import { Field as VField, FieldLabel, FieldDescription, FieldError, Button as VButton, Select as VSelect, Switch as VSwitch, Badge as VBadge, Dialog as VDialog, DialogPortal, DialogBackdrop, DialogViewport, DialogPopup, DialogClose, DialogTitle, DialogDescription, DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from '@vini-ds/ui';
import { Children, cloneElement, isValidElement, useId, forwardRef, lazy, Suspense, type ButtonHTMLAttributes, type CSSProperties, type ReactElement, type ReactNode } from 'react';
import { areaName, isCreatedWorkspace, workspaceList } from './model.ts';
import { useStore } from './store.tsx';

const MarkdownContent = lazy(() => import('./MarkdownContent.tsx'));

// These ligatures are present in the Material Symbols Rounded font shipped by VINi.
const icons = { download: 'download', panel: 'left_panel_close', arrowLeft: 'arrow_back', arrowRight: 'arrow_forward', rewind: 'replay', forward: 'refresh', sort: 'swap_vert', bell: 'notifications', organization: 'apartment', down: 'keyboard_arrow_down', right: 'chevron_right', up: 'keyboard_arrow_up', chat: 'chat_bubble_outline', check: 'check', success: 'check_circle', spinner: 'progress_activity', clock: 'schedule', upload: 'upload_file', cloudUpload: 'cloud_upload', cloud: 'cloud_done', offline: 'cloud_off', copy: 'content_copy', expand: 'open_in_full', database: 'database', more: 'more_horiz', file: 'description', folder: 'folder_open', settings: 'settings', home: 'home', info: 'info', link: 'link', share: 'ios_share', list: 'list', listAlt: 'list_alt', sensorDoor: 'sensor_door', lock: 'lock', improve: 'auto_fix_high', search: 'search', microphone: 'mic', send: 'send', pause: 'pause', edit: 'edit', play: 'play_arrow', plus: 'add', shield: 'verified_user', logout: 'logout', filters: 'tune', sparkle: 'auto_awesome', stop: 'stop', delete: 'delete', user: 'person', users: 'groups', conference: 'videocam', warning: 'error', waveform: 'graphic_eq', wifi: 'wifi', close: 'close' } as const;
export type IconName = keyof typeof icons;
export function Icon({ name, size = 20, className = '', weight = 'regular', alert = false }: { name: IconName; size?: number; className?: string; weight?: 'regular' | 'bold' | 'fill' | 'light'; alert?: boolean }) { const style = { '--thesis-icon-size': `${size}px`, fontVariationSettings: `"FILL" ${weight === 'fill' ? 1 : 0}, "wght" ${weight === 'bold' ? 700 : weight === 'light' ? 300 : 400}, "GRAD" var(--_vini-icon-grade, 0)` } as CSSProperties; return <span className={`material-symbols-rounded icon ${className}`} data-icon={alert ? 'alert' : ''} data-sidebar-icon="" aria-hidden="true" style={style}>{icons[name]}</span>; }

type ButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'color'> & { variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'record'; icon?: IconName; small?: boolean; state?: 'normal' | 'progress' };
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button({ variant = 'secondary', icon, small, className = '', children, type = 'button', ...props }, ref) {
  return <VButton ref={ref} type={type} size={small ? '400' : '500'} variant={variant === 'ghost' ? 'text' : variant === 'secondary' ? 'secondary' : 'primary'} color={variant === 'record' || variant === 'danger' ? 'error' : variant === 'primary' ? 'accent' : 'main'} className={className} startIcon={icon ? <Icon name={icon} size={18}/> : undefined} {...props}>{children}</VButton>;
});
export const IconButton = forwardRef<HTMLButtonElement, Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'color'> & { icon: IconName; label: string }>(function IconButton({ icon, label, className = '', ...props }, ref) {
  const hasTitle = Object.prototype.hasOwnProperty.call(props, 'title');
  const tooltip = hasTitle ? props.title : label;
  const { title: _title, ...buttonProps } = props;
  const button = <VButton ref={ref} type="button" variant={icon === "more" ? "pseudo" : ["sort", "filters"].includes(icon) ? "secondary" : "text"} size="500" className={className} aria-label={label} startIcon={<Icon name={icon}/>} {...buttonProps} style={props.disabled && tooltip ? { ...props.style, pointerEvents: 'none' } : props.style}/>;
  // An explicit undefined title lets an existing outer Tooltip own the trigger.
  if (!tooltip) return button;
  if (props.disabled) return <TooltipProvider><Tooltip><TooltipTrigger render={(triggerProps) => <span {...triggerProps} data-icon-button-tooltip-wrapper="" role="group" tabIndex={0} aria-disabled="true" aria-label={label}>{button}</span>} /><TooltipContent>{tooltip}</TooltipContent></Tooltip></TooltipProvider>;
  return <TooltipProvider><Tooltip><TooltipTrigger render={button} /><TooltipContent>{tooltip}</TooltipContent></Tooltip></TooltipProvider>;
});

export function SecondaryPane({ as: Tag = 'section', label, id, className = '', children }: { as?: 'section' | 'aside'; label: string; id?: string; className?: string; children: ReactNode }) {
  return <Tag id={id} className={`secondary-pane ${className}`} aria-label={label}>{children}</Tag>;
}

export function Menu({ trigger, children, label = 'Действия', align = 'end' }: { trigger: ReactElement; children: ReactNode; label?: string; align?: 'start' | 'end' }) {
  return <DropdownMenu modal={false}><DropdownMenuTrigger render={trigger}/><DropdownMenuContent align={align} sideOffset={7} aria-label={label}>{children}</DropdownMenuContent></DropdownMenu>;
}
export function MenuItem({ children, icon, onSelect, disabled, danger, checked }: { children: ReactNode; icon?: IconName; onSelect: () => void; disabled?: boolean; danger?: boolean; checked?: boolean }) {
  return <DropdownMenuItem variant={danger ? "destructive" : "default"} onClick={onSelect} disabled={disabled} aria-current={checked ? 'true' : undefined}>{icon ? <Icon name={icon} size={18} /> : null}<span>{children}</span>{checked ? <Icon name="check" size={17} className="menu-check" /> : null}</DropdownMenuItem>;
}
export function MenuSeparator() { return <DropdownMenuSeparator />; }
export function MenuLabel({ children }: { children: ReactNode }) { return <div className="menu-label">{children}</div>; }
export function Select({ label, value, options, onChange, className = '', disabled = false, variant = 'default', id, 'aria-describedby': describedBy, 'aria-invalid': invalid }: { label: string; value: string; options: { value: string; label: string; disabled?: boolean }[]; onChange: (value: string) => void; className?: string; disabled?: boolean; variant?: 'default' | 'filled' | 'compact'; id?: string; 'aria-describedby'?: string; 'aria-invalid'?: boolean }) {
  return <VSelect id={id} aria-label={label} aria-describedby={describedBy} aria-invalid={invalid} value={value} options={options} onValueChange={v => { if(v !== null) onChange(v); }} disabled={disabled} className={className} variant={variant} size="500" />;
}

export function Modal({ open, onClose, title, description, children, footer, className = '', wide = false }: { open: boolean; onClose: () => void; title: string; description?: string; children: ReactNode; footer?: ReactNode; className?: string; wide?: boolean }) {
  return <VDialog open={open} onOpenChange={value => { if (!value) onClose(); }}><DialogPortal><DialogBackdrop className="modal-overlay" /><DialogViewport><DialogPopup className={`modal ${wide ? 'modal--wide' : ''} ${className}`}>
    <div className="modal-heading"><div><DialogTitle className="modal-title">{title}</DialogTitle>{description ? <DialogDescription className="modal-description">{description}</DialogDescription> : <DialogDescription className="sr-only">{title}</DialogDescription>}</div><DialogClose render={<IconButton icon="close" label="Закрыть" />} /></div>
    <div className="modal-body">{children}</div>{footer}
  </DialogPopup></DialogViewport></DialogPortal></VDialog>;
}
export function Confirm({ open, onClose, title, description, target, confirm = 'Подтвердить', onConfirm, danger = false, children, disabled = false }: { open: boolean; onClose: () => void; title: string; description: string; target?: string; confirm?: string; onConfirm: () => void; danger?: boolean; children?: ReactNode; disabled?: boolean }) {
  return <Modal open={open} onClose={onClose} title={title} description={description}>{target ? <div className="confirmation-target"><Icon name={danger ? 'warning' : 'info'} /><strong>{target}</strong></div> : null}{children}<div className="modal-actions"><Button variant="ghost" onClick={onClose}>{danger ? 'Не удалять' : 'Отмена'}</Button><Button variant={danger ? 'danger' : 'primary'} disabled={disabled} onClick={onConfirm}>{confirm}</Button></div></Modal>;
}
export function Field({ label, hint, error, children, optional = false }: { label: string; hint?: string; error?: string; children: ReactNode; optional?: boolean }) {
 const id = useId(); const descriptionId = `${id}-description`;
 const controls = Children.map(children, child => isValidElement(child) ? cloneElement(child as ReactElement<Record<string, unknown>>, {id, 'aria-invalid': Boolean(error), 'aria-describedby': error || hint ? descriptionId : undefined}) : child);
 return <VField invalid={Boolean(error)}><FieldLabel htmlFor={id}>{label}{optional && <span className="field-optional">Необязательно</span>}</FieldLabel>{controls}{error ? <FieldError id={descriptionId} role="alert">{error}</FieldError> : hint ? <FieldDescription id={descriptionId}>{hint}</FieldDescription> : null}</VField>;
}
export function Toggle({ title, description, checked, onChange, disabled = false }: { title: string; description: string; checked: boolean; onChange: (value: boolean) => void; disabled?: boolean }) { const descriptionId = useId(); return <div className="toggle-row"><div><strong>{title}</strong><p id={descriptionId}>{description}</p></div><VSwitch aria-label={title} aria-describedby={descriptionId} checked={checked} disabled={disabled} onCheckedChange={onChange}/></div>; }
export function Badge({ children, tone = 'neutral', dot = false, icon }: { children: ReactNode; tone?: string; dot?: boolean; icon?: IconName }) { return <VBadge variant="secondary" color={tone === "danger" ? "error" : tone === "accent" ? "accent" : tone === "success" || tone === "warning" ? tone : "main"}>{icon && <Icon name={icon} size={14} />}{children}</VBadge>; }
export function Avatar({ name, size = 'normal', color }: { name: string; size?: 'small' | 'normal' | 'large'; color?: string }) { const initials = name.split(' ').slice(0, 2).map(s => s[0]).join(''); return <VAvatar size={size === 'small' ? 'sm' : size === 'large' ? 'lg' : 'default'} aria-hidden="true"><AvatarFallback style={color ? {color, background: `${color}17`} : undefined}>{initials}</AvatarFallback></VAvatar>; }
export function Empty({ icon = 'waveform', title, description, children }: { icon?: IconName; title: string; description: string; children?: ReactNode }) { return <VEmpty className="vini-empty"><EmptyHeader><EmptyMedia variant="icon"><Icon name={icon} size={30} weight="light"/></EmptyMedia><EmptyTitle><h2>{title}</h2></EmptyTitle><EmptyDescription>{description}</EmptyDescription></EmptyHeader>{children && <EmptyContent>{children}</EmptyContent>}</VEmpty>; }
export function Markdown({ children }: { children: string }) { return <div className="markdown"><Suspense fallback={<span className="muted-copy" role="status">Загружаем материалы…</span>}><MarkdownContent>{children}</MarkdownContent></Suspense></div>; }
export function AreaPicker({ value, onChange, local = false, destinationServer, showAudience = true }: { value: string; onChange: (id: string) => void; local?: boolean; destinationServer?: string; showAudience?: boolean }) {
  const { state } = useStore(); const audienceId = useId(); const inputId = useId();
  const unavailable = Boolean(destinationServer && destinationServer !== state.server?.address) || (value !== 'personal' && !workspaceList(state).some(w => w.id === value));
  const created = isCreatedWorkspace(state, value); const name = areaName(value, state);
  const audience = unavailable ? `Исходный сервер: ${destinationServer ?? state.server?.address}. Выберите доступное место отправки.` : value === 'personal' ? 'Запись и материалы будут доступны только вам.' : created ? local ? `Черновик виден только вам. После отправки — пространство «${name}».` : `Место отправки — пространство «${name}». Доступ определяется правами пространства.` : local ? `Черновик виден только вам. После отправки запись получат участники «${name}».` : `Запись и материалы будут доступны участникам «${name}».`;
  const options = [{ value: 'personal', label: 'Личное' }, ...workspaceList(state).map(w => ({ value: w.id, label: w.name }))];
  const selected = unavailable ? { value: '__unavailable', label: 'Место отправки недоступно' } : options.find(option => option.value === value) ?? null;
  return <VField className="area-picker"><FieldLabel htmlFor={inputId}>Пространство</FieldLabel><Combobox items={options} value={selected} itemToStringLabel={option => option.label} itemToStringValue={option => option.value} isItemEqualToValue={(a, b) => a.value === b.value} onValueChange={option => { if (option) onChange(option.value); }}><ComboboxInput id={inputId} data-vini-input="true" aria-describedby={showAudience || unavailable ? audienceId : undefined} triggerLabel="Выбрать пространство" placeholder="Найти пространство"/><ComboboxContent><ComboboxEmpty>Пространства не найдены</ComboboxEmpty><ComboboxList>{(option: { value: string; label: string }) => <ComboboxItem key={option.value} value={option}>{option.label}</ComboboxItem>}</ComboboxList></ComboboxContent></Combobox>{(showAudience || unavailable) && <FieldDescription id={audienceId}><span className={`audience-note${unavailable ? ' is-warning' : ''}`}><Icon name={unavailable ? 'warning' : value === 'personal' ? 'lock' : 'users'} size={15} />{audience}</span></FieldDescription>}</VField>;
}
export function Brand({ compact = false }: { compact?: boolean }) { return <div className={`brand${compact ? ' brand--compact' : ''}`}><span className="brand-mark"><svg viewBox="0 0 32 32" aria-hidden="true"><path d="m5 8 7.5 18H20l7.5-18h-7L16 20 11.5 8Z" fill="currentColor" /></svg></span><div><strong>Тезис</strong><span>VINTEO</span></div></div>; }
