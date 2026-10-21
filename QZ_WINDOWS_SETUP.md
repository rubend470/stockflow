# Configuración de QZ Tray en Windows

Esta instalación se realiza una sola vez en cada computadora que imprimirá tickets
o abrirá la gaveta.

## Requisitos

- QZ Tray instalado y abierto.
- La impresora instalada en Windows.
- Permisos de administrador.
- El archivo `digital-certificate.txt` entregado por el administrador del sistema.

## Instalación

1. Cierra QZ Tray desde su icono junto al reloj.
2. Copia `digital-certificate.txt` en `C:\Program Files\QZ Tray\`.
3. Renombra la copia como `override.crt`.
4. Inicia QZ Tray nuevamente como usuario normal.
5. Abre el sistema desde su dirección HTTPS e inicia sesión.
6. Realiza una impresión de prueba.

Si QZ Tray pide autorización la primera vez, comprueba que la ventana muestre
`QZ Tray Demo Cert`, marca `Remember this decision` y presiona `Allow`.

## Seguridad

No copies `private-key.pem` en la computadora del cliente. Esa clave permanece
protegida en Cloudflare y no debe enviarse por correo ni almacenarse en el navegador.
