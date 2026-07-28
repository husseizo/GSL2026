// One interface, swappable per channel — the same pattern as
// DgxClientService/VectorIndexProvider from earlier phases: build the real
// integration point now, swap in a real credentialed provider later
// without touching NotificationService itself. See
// docs/architecture/notifications.md.
export interface NotificationProvider {
  readonly channel: string;
  send(recipient: string, subject: string | undefined, body: string): Promise<void>;
}
