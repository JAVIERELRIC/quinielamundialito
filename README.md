# Quiniela Mundial 2026 — Guía de despliegue

## Lo que necesitas (todo gratuito)
- Cuenta en **Supabase**: https://supabase.com
- Cuenta en **Vercel**: https://vercel.com
- Cuenta en **Resend**: https://resend.com
- Tu dominio (el que ya tienes)

---

## PASO 1 — Configurar Supabase (base de datos + login)

1. Ve a https://supabase.com y crea un proyecto nuevo (dale cualquier nombre, ej. "quiniela-2026")
2. Espera ~2 minutos a que arranque
3. En el panel izquierdo, haz clic en **SQL Editor**
4. Copia y pega TODO el contenido de `supabase-schema.sql` y haz clic en **Run**
   - Esto crea todas las tablas y carga los 72 partidos automáticamente
5. Ve a **Settings → API** y copia:
   - `Project URL` → es tu `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` → es tu `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role secret` → es tu `SUPABASE_SERVICE_ROLE_KEY`

### Activar login por email en Supabase
6. Ve a **Authentication → Providers → Email** y activa "Enable Email Provider"
7. Ve a **Authentication → URL Configuration** y agrega tu dominio en "Site URL":
   `https://tu-dominio.com`

---

## PASO 2 — Configurar Resend (correos)

1. Ve a https://resend.com y crea una cuenta
2. En **Domains**, agrega tu dominio y sigue los pasos para verificarlo
   (agrega los DNS records que te piden en donde tienes tu dominio)
3. Una vez verificado, ve a **API Keys** y crea una nueva
4. Guarda: `re_XXXXXXXXXX` → es tu `RESEND_API_KEY`
5. El `RESEND_FROM_EMAIL` será algo como `quiniela@tu-dominio.com`

---

## PASO 3 — Subir el código a GitHub

1. Ve a https://github.com y crea un repositorio nuevo (puede ser privado)
2. Sube todos los archivos de esta carpeta al repositorio
   (puedes arrastrar y soltar en la interfaz web de GitHub)

---

## PASO 4 — Desplegar en Vercel

1. Ve a https://vercel.com y crea una cuenta (puedes entrar con GitHub)
2. Haz clic en **Add New Project**
3. Selecciona el repositorio que acabas de crear
4. En **Environment Variables**, agrega estas variables (una por una):

```
NEXT_PUBLIC_SUPABASE_URL        = (el que copiaste en paso 1)
NEXT_PUBLIC_SUPABASE_ANON_KEY   = (el que copiaste en paso 1)
SUPABASE_SERVICE_ROLE_KEY       = (el que copiaste en paso 1)
NEXTAUTH_SECRET                 = (genera uno en: https://generate-secret.vercel.app/32)
NEXTAUTH_URL                    = https://tu-dominio.com
RESEND_API_KEY                  = (el que copiaste en paso 2)
RESEND_FROM_EMAIL               = quiniela@tu-dominio.com
ADMIN_EMAIL                     = tu@correo.com
```

5. Haz clic en **Deploy** y espera ~3 minutos

---

## PASO 5 — Conectar tu dominio en Vercel

1. En Vercel, ve a tu proyecto → **Settings → Domains**
2. Agrega tu dominio
3. Sigue las instrucciones para apuntar los DNS de tu dominio a Vercel
   (normalmente es agregar un registro CNAME o A en donde compraste el dominio)

---

## PASO 6 — Crear tu cuenta de admin

1. Abre Supabase → **SQL Editor** y ejecuta esto (cambia el email y nombre):

```sql
INSERT INTO public.profiles (id, nombre, email, es_admin)
VALUES (gen_random_uuid(), 'Tu Nombre', 'tu@email.com', true);
```

2. Entra a `https://tu-dominio.com/login`, pon tu email y te llegará el link de acceso

---

## PASO 7 — Invitar a tus amigos

1. Entra a la quiniela con tu cuenta de admin
2. Ve a la pestaña **Admin**
3. Ingresa el nombre y email de cada amigo y haz clic en "Enviar invitación"
   - Les llegará un correo con instrucciones para entrar

---

## Uso diario durante el Mundial

### Cargar resultados (tú como admin)
- Entra a la pestaña **Admin → Cargar resultado**
- Pon el ID del partido (1-72) y los goles
- Los puntos se calculan automáticamente para todos

### Enviar recordatorios
- En **Admin → Enviar recordatorio**, elige la jornada
- Solo les llega a quienes tengan picks pendientes

---

## Puntuación
- Cada partido acertado = 1 punto
- Local gana → pick "A" correcto
- Visitante gana → pick "B" correcto  
- Empate → pick "Empate" correcto

---

## IDs de los partidos (para cargar resultados)

| ID | Grupo | Partido |
|----|-------|---------|
| 1 | A | México vs Sudáfrica |
| 2 | A | Rep. de Corea vs Chequia |
| 3 | A | México vs Rep. de Corea |
| 4 | A | Sudáfrica vs Chequia |
| 5 | A | México vs Chequia |
| 6 | A | Sudáfrica vs Rep. de Corea |
| 7 | B | Canadá vs Bosnia y Herzegovina |
| 8 | B | Catar vs Suiza |
| 9 | B | Canadá vs Catar |
| 10 | B | Bosnia y Herzegovina vs Suiza |
| 11 | B | Canadá vs Suiza |
| 12 | B | Bosnia y Herzegovina vs Catar |
| 13 | C | Brasil vs Marruecos |
| 14 | C | Haití vs Escocia |
| 15 | C | Brasil vs Haití |
| 16 | C | Marruecos vs Escocia |
| 17 | C | Brasil vs Escocia |
| 18 | C | Marruecos vs Haití |
| 19 | D | USA vs Paraguay |
| 20 | D | Australia vs Turquía |
| 21 | D | USA vs Australia |
| 22 | D | Paraguay vs Turquía |
| 23 | D | USA vs Turquía |
| 24 | D | Paraguay vs Australia |
| 25 | E | Alemania vs Curazao |
| 26 | E | Costa de Marfil vs Ecuador |
| 27 | E | Alemania vs Costa de Marfil |
| 28 | E | Curazao vs Ecuador |
| 29 | E | Alemania vs Ecuador |
| 30 | E | Curazao vs Costa de Marfil |
| 31 | F | Países Bajos vs Japón |
| 32 | F | Suecia vs Túnez |
| 33 | F | Países Bajos vs Suecia |
| 34 | F | Japón vs Túnez |
| 35 | F | Países Bajos vs Túnez |
| 36 | F | Japón vs Suecia |
| 37 | G | Bélgica vs Egipto |
| 38 | G | Irán vs Nueva Zelanda |
| 39 | G | Bélgica vs Irán |
| 40 | G | Egipto vs Nueva Zelanda |
| 41 | G | Bélgica vs Nueva Zelanda |
| 42 | G | Egipto vs Irán |
| 43 | H | España vs Cabo Verde |
| 44 | H | Arabia Saudita vs Uruguay |
| 45 | H | España vs Arabia Saudita |
| 46 | H | Cabo Verde vs Uruguay |
| 47 | H | España vs Uruguay |
| 48 | H | Cabo Verde vs Arabia Saudita |
| 49 | I | Francia vs Senegal |
| 50 | I | Irak vs Noruega |
| 51 | I | Francia vs Irak |
| 52 | I | Senegal vs Noruega |
| 53 | I | Francia vs Noruega |
| 54 | I | Senegal vs Irak |
| 55 | J | Argentina vs Argelia |
| 56 | J | Austria vs Jordania |
| 57 | J | Argentina vs Austria |
| 58 | J | Argelia vs Jordania |
| 59 | J | Argentina vs Jordania |
| 60 | J | Argelia vs Austria |
| 61 | K | Portugal vs Congo |
| 62 | K | Uzbekistán vs Colombia |
| 63 | K | Portugal vs Uzbekistán |
| 64 | K | Congo vs Colombia |
| 65 | K | Portugal vs Colombia |
| 66 | K | Congo vs Uzbekistán |
| 67 | L | Inglaterra vs Croacia |
| 68 | L | Ghana vs Panamá |
| 69 | L | Inglaterra vs Ghana |
| 70 | L | Croacia vs Panamá |
| 71 | L | Inglaterra vs Panamá |
| 72 | L | Croacia vs Ghana |
