self.addEventListener("push", event => {
  let data;
  try { data = event.data.json(); } catch { return; }
  event.waitUntil(self.registration.showNotification(data.title || "Verdant reminder", {
    body: data.body || "An event needs your attention.", tag: data.tag, data: { url: "/events" },
  }));
});
self.addEventListener("notificationclick", event => {
  event.notification.close();
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    const target = new URL("/events", self.location.origin).href;
    const existing = windows.find(client => client.url.startsWith(self.location.origin + "/"));
    if (existing) { await existing.navigate(target); return existing.focus(); }
    return self.clients.openWindow(target);
  })());
});
