# Migración multiempresa

## Estado actual

- El respaldo de producción está guardado localmente con manifiesto y SHA-256.
- La aplicación conserva compatibilidad automática con las colecciones raíz existentes.
- No se han creado empresas ni copiado documentos en Firebase.
- El código contiene una capa de rutas compatible con el modelo actual y el futuro.
- La sesión carga opcionalmente `currentBusinessId`; si no existe, conserva las rutas heredadas.
- Todos los servicios operativos usan el constructor de rutas compatible.
- Ventas offline, caché del POS y ventas abiertas están aisladas por empresa.
- Existe un módulo de superadministración para crear empresas y asignar usuarios.
- La barra superior permite cambiar la empresa activa cuando el usuario tiene más de una.

## Garantías durante la transición

- Ningún script de migración contiene operaciones de borrado.
- El plan actual es exclusivamente de simulación y no importa el SDK de Firebase.
- Las colecciones heredadas no se renombran ni se eliminan.
- La aplicación no activa rutas multiempresa hasta que el usuario tenga una empresa asignada.
- No se desplegarán aplicación ni reglas antes de validar una copia completa.

## Modelo objetivo

Los perfiles de autenticación permanecen en `users/{uid}`. Los datos operativos se
aislarán dentro de `businesses/{businessId}/{collection}/{documentId}`.

Cada usuario tendrá `businessIds` y `currentBusinessId`. Las reglas verificarán que
el usuario pertenezca a la empresa solicitada antes de permitir cualquier lectura o
escritura.

## Simulación

La simulación solo lee un archivo local y no se conecta a Firebase:

```bash
npm run migration:plan -- --business-id pollores-millers
```

Para conservar el reporte:

```bash
npm run migration:plan -- \
  --business-id pollores-millers \
  --output backups/firestore/migration-plan-pollores-millers.json
```

## Orden de ejecución previsto

1. Validar el respaldo y ejecutar la simulación.
2. Implementar reglas multiempresa sin desplegarlas.
3. Adaptar el contexto de sesión y los servicios por módulos.
4. Probar el comercio heredado y una segunda empresa localmente.
5. Crear un migrador con escritura explícita, lotes idempotentes y verificación.
6. Copiar los datos sin borrar las colecciones originales.
7. Comparar conteos y muestras antes de activar las nuevas rutas.
8. Desplegar reglas y aplicación en una ventana controlada.

## Secuencia de producción

1. Desplegar únicamente las reglas compatibles. Las colecciones heredadas seguirán funcionando.
2. Ejecutar el migrador de copia para `pollores-millers`.
3. Verificar los 2.575 documentos operativos y 1.949 subdocumentos de ventas.
4. Probar lectura y una venta controlada con la aplicación nueva antes de publicarla.
5. Desplegar Hosting.
6. Crear la segunda empresa desde Administración > Empresas.

El migrador requiere `--execute`, una confirmación que incluye el identificador de la
empresa y credenciales por variables de entorno. Es reanudable, escribe con los mismos
IDs y rechaza reutilizar una empresa creada desde otro respaldo. No elimina documentos.
