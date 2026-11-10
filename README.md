# Quiniela de la Liguilla MX

Aplicación Next.js + Supabase para una Liguilla de **8 equipos** y **14 partidos**:

- Cuartos de final: 4 series, ida y vuelta (8 partidos)
- Semifinales: 2 series, ida y vuelta (4 partidos)
- Final: 1 serie, ida y vuelta (2 partidos)

Los ocho equipos, cruces, clasificados, fechas y resultados se administran desde la pestaña **Admin**.

## Cambios principales

- Eliminado el calendario fijo del Mundial.
- Flujo de seis jornadas: CF Ida, CF Vuelta, SF Ida, SF Vuelta, Final Ida y Final Vuelta.
- Los ocho equipos se capturan en orden de siembra; el mejor sembrado cierra los cuartos como local.
- Cada partido permite Local, Empate o Visitante.
- Puntuación: resultado correcto 1 punto, marcador exacto +1, penales +1 y campeón +10.
- Reinicio explícito desde Admin; nunca se ejecuta durante un deployment.
- APIs administrativas protegidas con el token real de Supabase y el campo `es_admin`.
- NextAuth fue retirado porque la aplicación ya usa Supabase Auth; esto también elimina el error de build de `/api/auth/[...nextauth]`.

## 1. Respaldar antes de reiniciar

El archivo `supabase-schema.sql` es destructivo para la competencia anterior. Antes de ejecutarlo, exporta las tablas que quieras conservar desde Supabase.

El script:

- elimina partidos, picks, resultados y tablas del Mundial;
- elimina de Supabase Auth a los participantes que no sean administradores;
- conserva las cuentas cuyo perfil tenga `es_admin = true` para no bloquear el panel;
- crea el modelo de Liguilla y 14 partidos provisionales.

## 2. Aplicar el nuevo esquema

1. Abre **Supabase → SQL Editor**.
2. Copia todo el contenido de `supabase-schema.sql`.
3. Presiona **Run** una sola vez.
4. Confirma que existan estas tablas: `profiles`, `configuracion`, `equipos`, `partidos`, `picks`, `picks_campeon`.
5. Confirma que `partidos` tenga 14 filas.

Si era una instalación nueva y no había administrador, crea primero el usuario en **Authentication → Users** y después ejecuta, cambiando el correo:

```sql
insert into public.profiles (id, nombre, email, es_admin)
select id, 'Administrador', email, true
from auth.users
where email = 'tu@correo.com';
```

## 3. Variables de Vercel

Configura en **Vercel → Settings → Environment Variables**:

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
NEXTAUTH_URL
RESEND_API_KEY          # opcional
RESEND_FROM_EMAIL       # opcional
```

`NEXTAUTH_URL` se conserva solo como la URL base utilizada en los correos. Ya no se requiere `NEXTAUTH_SECRET`.

Nunca expongas `SUPABASE_SERVICE_ROLE_KEY` con el prefijo `NEXT_PUBLIC_`.

## 4. Desplegar

```bash
npm install
npm run typecheck
npm run build
```

Sube los cambios a la rama conectada a Vercel. El build no modifica la base de datos.

## 5. Configurar la Liguilla

1. Inicia sesión con la cuenta administradora.
2. Ve a **Admin → Configurar 8 equipos y cruces**.
3. Captura los equipos del puesto 1 al 8.
4. Presiona **Crear 14 partidos**.
5. Carga las fechas de cada partido.
6. Cuando terminen los cuartos, captura cuatro semifinalistas en el orden de los dos cruces.
7. Después captura los dos finalistas.
8. Carga resultados y, al terminar, confirma el campeón oficial.

Volver a presionar **Crear 14 partidos** borra los picks y resultados de la competencia actual.

## Reinicio completo desde Admin

En **Admin → Zona de peligro**, escribe exactamente:

```text
REINICIAR LIGUILLA
```

El reinicio borra participantes, sesiones de participantes, picks, resultados, equipos y fechas. Conserva únicamente la cuenta administradora que ejecuta la acción para evitar dejar la aplicación sin acceso. Después del reinicio debes volver a capturar los ocho equipos.

## Seguridad operativa

- No incluyas `.env` en GitHub.
- No ejecutes `supabase-schema.sql` en cada deployment.
- El reinicio requiere ser administrador, la frase exacta y una segunda confirmación del navegador.
- Las fechas se guardan en UTC; la interfaz las muestra en `America/Monterrey`.
