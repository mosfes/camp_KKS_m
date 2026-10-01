self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let data = {};

  try {
    data = event.data?.json() || {};
  } catch {
    data = { body: event.data?.text() || "มีการแจ้งเตือนใหม่จาก KKS Camp" };
  }

  const title = data.title || "KKS Camp";
  const options = {
    body: data.body || "มีการแจ้งเตือนใหม่",
    icon: data.icon || "/icons/icon-192.png",
    badge: data.badge || "/icons/icon-192.png",
    tag: data.tag || "kks-camp-notification",
    data: { url: data.url || "/student/dashboard" },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const targetPath = event.notification.data?.url || "/student/dashboard";
  const targetUrl = new URL(targetPath, self.location.origin).href;

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        const matchingClient = clientList.find(
          (client) => new URL(client.url).origin === self.location.origin,
        );

        if (matchingClient) {
          return matchingClient
            .navigate(targetUrl)
            .then(() => matchingClient.focus());
        }

        return self.clients.openWindow(targetUrl);
      }),
  );
});
