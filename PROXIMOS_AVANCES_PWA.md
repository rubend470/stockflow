# Resumen de Discusión: Sistema de Ventas React

## 1. Impresión de Tickets
- Utilizamos una impresora Jaltech POS de 58 mm.
- La impresora se conecta por USB.
- Desde React Web, la impresión se puede gestionar con una herramienta como QZ Tray para enviar comandos ESC/POS y abrir la gaveta.
- Implementado: después de registrar una venta, el sistema pregunta si se desea imprimir ticket, solo abrir la gaveta u omitir la acción.
- La opción de imprimir ticket envía comandos ESC/POS raw por QZ Tray y también manda el pulso de apertura de gaveta.
- La opción de solo abrir gaveta envía únicamente el pulso ESC/POS.
- Si QZ Tray no está instalado, abierto o no encuentra la impresora, la venta queda registrada y se muestra un error de conexión/impresora.
- Para pruebas en Mac con una impresora WiFi normal, si no se encuentra una impresora "Jaltech", el sistema imprime el ticket en modo HTML usando la impresora predeterminada. Esto permite probar tickets aunque no exista gaveta de dinero.

## 2. Apertura de la Gaveta de Dinero
- La gaveta se conecta a la impresora (puerto RJ11/RJ12).
- Para abrir la caja sin imprimir, el sistema envía un comando ESC/POS a través de QZ Tray.
- El cliente instala QZ Tray una vez, y luego el sistema web se comunica sin intervención adicional.
- Recomendación inicial: dejar la impresora Jaltech configurada como impresora predeterminada del equipo o con un nombre que incluya "Jaltech".
- La apertura de gaveta requiere una impresora/ticketera compatible con ESC/POS y gaveta conectada por RJ11/RJ12. Una impresora WiFi común sirve para probar ticket, pero no para abrir caja.

## 3. PWA (Aplicación Web Progresiva)
- Una PWA permite que el sistema web se instale como una “app” en computadoras o móviles.
- La PWA funciona offline si se almacenan datos en caché.
- Se puede adaptar la interfaz para que en móvil se vea como una app nativa, con diseño responsivo y navegación simplificada.

## 4. Modo Offline
- Se pueden guardar compras en IndexedDB (caché) cuando no hay internet.
- Al volver la conexión, se sincronizan con Firebase.

## 5. Transición de React Native a PWA
- La lógica de React Native se puede reutilizar al migrar a React web.
- Al adaptar el diseño para móvil, la PWA se sentirá como una app nativa.
- En Mac o cualquier dispositivo, la PWA se puede instalar desde navegadores compatibles.

## 6. Sincronización de Datos
- Si la página se actualiza o se navega a otra sección, las partes que no dependan de datos del servidor seguirán funcionando offline. Solo las secciones que necesiten datos nuevos requerirán conexión.

## Objetivo inmediato de la PWA
- La aplicación se instalará principalmente en un ordenador para trabajar en caja y ventas de forma normal.
- El jefe podrá monitorear el negocio desde un dispositivo móvil usando la misma web/PWA.
- La prioridad visual debe ser: escritorio cómodo para operación diaria y móvil optimizado para supervisión rápida.
