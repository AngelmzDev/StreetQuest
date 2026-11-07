export type ServiceWorkerRegistrar = (options: { immediate: boolean }) => unknown

export function registerOfflineShell(register: ServiceWorkerRegistrar): void {
  register({ immediate: true })
}
