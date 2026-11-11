// Service worker de VeciRed: recibe los avisos aunque la página esté
// cerrada y los muestra como notificación del celular o la compu.
// Al tocar la notificación, abre (o trae al frente) la página del aviso.

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

self.addEventListener("push", (e) => {
  let datos = {};
  try {
    datos = e.data ? e.data.json() : {};
  } catch {
    datos = { titulo: e.data ? e.data.text() : "" };
  }
  const titulo = datos.titulo || "VeciRed";
  e.waitUntil(
    self.registration.showNotification(titulo, {
      body: datos.cuerpo || "",
      icon: "/icono-192",
      badge: "/icono-192",
      tag: datos.id ? `aviso-${datos.id}` : undefined,
      lang: "es-AR",
      data: { enlace: datos.enlace || "/" },
    }),
  );
});

self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const destino = new URL(e.notification.data?.enlace || "/", self.location.origin).href;
  e.waitUntil(
    (async () => {
      const ventanas = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const v of ventanas) {
        if (new URL(v.url).origin === self.location.origin) {
          await v.focus();
          return v.navigate(destino);
        }
      }
      return self.clients.openWindow(destino);
    })(),
  );
});
