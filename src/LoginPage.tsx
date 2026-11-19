import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  Button, Card, CardContent, CardDescription, CardFooter, CardHeader, Container,
  Dialog, DialogBackdrop, DialogClose, DialogDescription, DialogPopup,
  DialogPortal, DialogTitle, DialogTrigger, DialogViewport, FieldGroup, FormField,
  Heading, Inline, Input, Item, ItemContent, ItemDescription, ItemMedia, ItemTitle,
  Stack, Text,
} from '@vini-ds/ui';
import { useEffect, useId, useRef, useState } from 'react';
import { SERVER } from './fixtures.ts';
import { isOnServer, normalizeServer } from './model.ts';
import { useNav } from './navigation.tsx';
import { useStore } from './store.tsx';
import { Icon } from './ui.tsx';
import './login-layout.css';

export function ServerChangeDialog({ open, onClose, onConfirm, target }: {
  open: boolean; onClose: () => void; onConfirm: () => void; target: string;
}) {
  const cancel = useRef<HTMLButtonElement>(null);
  return <AlertDialog open={open} onOpenChange={value => { if (!value) onClose(); }}>
    <AlertDialogContent initialFocus={cancel}>
      <AlertDialogHeader>
        <AlertDialogTitle>Сменить сервер?</AlertDialogTitle>
        <AlertDialogDescription>Локальные записи и черновики сохранятся на устройстве и не будут автоматически отправлены на новый сервер. {target}</AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel ref={cancel}>Отмена</AlertDialogCancel>
        <AlertDialogAction variant="secondary" color="main" onClick={onConfirm}>Сменить сервер</AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>;
}

function ServerAddressHelp() {
  const close = useRef<HTMLButtonElement>(null);
  return <Dialog>
    <DialogTrigger render={<Button variant="text" startIcon={<Icon name="info" size={18} />} />}>Как узнать адрес?</DialogTrigger>
    <DialogPortal>
      <DialogBackdrop className="login-help-backdrop" />
      <DialogViewport className="login-help-viewport">
        <DialogPopup className="login-help-popup" initialFocus={close}>
          <Card>
            <CardHeader>
              <DialogTitle className="login-copy vini-text-desktop-subheader-medium-700">Где взять адрес сервера?</DialogTitle>
              <DialogDescription className="login-copy vini-text-desktop-body-regular-500">Он нужен при первом подключении или смене организации.</DialogDescription>
            </CardHeader>
            <CardContent>
              <Stack gap="300">
                <Text as="p" className="login-copy">Запросите адрес у администратора Тезиса. Например, <Text weight="medium">thesis.company.ru</Text>.</Text>
                <Text as="p" className="login-copy">Введите адрес без разделов и параметров. Префикс https:// можно не указывать.</Text>
              </Stack>
            </CardContent>
            <CardFooter>
              <Inline justify="end" className="login-help-actions">
                <DialogClose ref={close} render={<Button variant="secondary" />}>Понятно</DialogClose>
              </Inline>
            </CardFooter>
          </Card>
        </DialogPopup>
      </DialogViewport>
    </DialogPortal>
  </Dialog>;
}

export default function LoginPage() {
  const { state, dispatch } = useStore();
  const { go } = useNav();
  const [address, setAddress] = useState(SERVER);
  const [error, setError] = useState('');
  const [checking, setChecking] = useState(false);
  const [signingIn, setSigningIn] = useState(false);
  const [change, setChange] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const addressInput = useRef<HTMLInputElement>(null);
  const addressId = useId();
  const headingId = useId();
  const server = state.server;
  const localCount = state.drafts.length + state.records.filter(record => !isOnServer(record)).length;
  useEffect(() => () => { if (timer.current !== null) clearTimeout(timer.current); }, []);

  function verify() {
    if (timer.current !== null) return;
    const normalized = normalizeServer(address);
    if (!normalized) {
      setError(address.trim() ? 'Введите адрес без пути, например thesis.company.ru. Подключение по HTTP не поддерживается.' : 'Введите адрес сервера.');
      addressInput.current?.focus();
      return;
    }
    setChecking(true);
    timer.current = setTimeout(() => {
      timer.current = null;
      dispatch({ type: 'server', server: { address: normalized, organization: normalized.includes('sever') ? 'АО Север' : 'Корпоративный Тезис' } });
      setChecking(false);
    }, 650);
  }

  function signIn() {
    if (!server || timer.current !== null) return;
    setSigningIn(true);
    timer.current = setTimeout(() => {
      timer.current = null;
      dispatch({ type: 'sign-in' });
      go({ page: 'library', scope: { kind: 'all' } }, true);
    }, 650);
  }

  function clearServer() {
    setChange(false);
    setAddress(SERVER);
    setError('');
    dispatch({ type: 'server', server: null });
  }

  return <Stack as="section" aria-labelledby={headingId} className="login-page">
    <Container className="login-container" maxInlineSize="calc(var(--vini-base-spacing-500) * 25)">
      <Stack gap="600">
      <Inline as="header" justify="center" gap="300">
        <Icon name="organization" />
        <Text token="desktop/subheader/medium/600">Тезис VINTEO</Text>
      </Inline>
      <Card>
        <CardHeader className="login-centered">
          <Heading level={1} token="desktop/headline/medium/1000" id={headingId}>
            {server ? 'Войдите в рабочее пространство' : 'Укажите адрес сервера'}
          </Heading>
          <CardDescription>
            {server ? 'Войдите через корпоративную учётную запись.' : 'Адрес выдаёт администратор вашей организации.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {server ?
            <Stack gap="500">
              <Item variant="outline" size="sm">
                <ItemMedia variant="icon"><Icon name="database" /></ItemMedia>
                <ItemContent>
                  <ItemTitle>{server.organization}</ItemTitle>
                  <ItemDescription className="login-server-address">{server.address}</ItemDescription>
                </ItemContent>
              </Item>
              <Stack gap="300" role="group" aria-label="Действия входа">
                <Button autoFocus className="login-action" variant="primary" color="accent" state={signingIn ? 'progress' : undefined} onClick={signIn} startIcon={<Icon name="shield" size={18} />}>
                  {signingIn ? 'Открываем SSO…' : 'Войти через SSO'}
                </Button>
                <Button className="login-action" variant="text" disabled={signingIn} startIcon={<Icon name="edit" size={18} />} onClick={() => localCount ? setChange(true) : clearServer()}>Изменить сервер</Button>
              </Stack>
            </Stack>
          :
          <form aria-labelledby={headingId} noValidate onSubmit={event => { event.preventDefault(); verify(); }}>
            <FieldGroup>
              <FormField label="Адрес сервера" descriptionBottom="Например, thesis.company.ru · https:// можно не указывать"
                error={error || undefined} required controlId={addressId}
                renderControl={bindControl => bindControl(<Input ref={addressInput} data-vini-input="true" autoFocus type="text" name="server"
                  placeholder="thesis.company.ru" autoCapitalize="none" autoCorrect="off" spellCheck={false}
                  readOnly={checking} value={address} onChange={event => { setAddress(event.target.value); setError(''); }} />)}
              />
              <Stack gap="300" role="group" aria-label="Действия подключения">
                <Button className="login-action" type="submit" variant="primary" color="accent" disabled={!checking && !address.trim()} state={checking ? 'progress' : undefined}>
                  {checking ? 'Проверяем сервер…' : 'Продолжить'}
                </Button>
                <ServerAddressHelp />
              </Stack>
            </FieldGroup>
          </form>}
        </CardContent>
      </Card>
      <Stack as="footer" align="center" gap="200" className="login-centered login-muted">
        {!server && <Inline justify="center" gap="200">
          <Icon name="lock" size={16} />
          <Text token="desktop/caption/regular/400">Для подключения нужен HTTPS</Text>
        </Inline>}
        <Text token="desktop/caption/regular/400">VINTEO Тезис · 1.0.0</Text>
      </Stack>
      </Stack>
    </Container>
    <ServerChangeDialog open={change} onClose={() => setChange(false)} onConfirm={clearServer} target={`Локальных материалов: ${localCount}.`} />
  </Stack>;
}
