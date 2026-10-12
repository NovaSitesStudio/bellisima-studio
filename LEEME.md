# Bellissima Studio — cómo poner la nueva versión en línea

## Qué hay en la carpeta

| Archivo | Para qué sirve |
|---|---|
| `index.html` | La página |
| `estilos.css` | El diseño y las animaciones |
| `script.js` | Menú, calendario y reservas |
| `images/` | Fotos comprimidas (reemplaza la carpeta vieja) |
| `supabase/functions/Google-calendar/index.ts` | El servidor de reservas |
| `supabase/sql/001_reservas_seguras.sql` | Cambios en la base de datos |

## Pasos (en este orden)

### 1. Base de datos
Supabase → **SQL Editor** → pega `001_reservas_seguras.sql` → **Run**.
Después, en **Authentication → Policies**, borra las políticas de la tabla `reservas` que dejen insertar o leer a `anon`.

### 2. Clave de administrador
Supabase → **Edge Functions → Secrets** → crea `ADMIN_SECRET` con una clave larga y aleatoria (mínimo 24 caracteres).
Guárdala en un lugar seguro: solo tú la usas.

### 3. Subir la Edge Function
Reemplaza el código de `Google-calendar` por el nuevo `index.ts` y despliega.
Debe seguir con **"Verify JWT" desactivado** (Google necesita entrar a `/callback` sin sesión).

### 4. Volver a conectar el calendario de tu cuñada
Abre en el navegador (con su cuenta de Google a mano):

```
https://gppdrkgtrwbnyrxwtasu.supabase.co/functions/v1/Google-calendar/connect?key=TU_ADMIN_SECRET
```

Para comprobar que quedó bien:

```
https://gppdrkgtrwbnyrxwtasu.supabase.co/functions/v1/Google-calendar/status?key=TU_ADMIN_SECRET
```

### 5. Subir la página
Sube `index.html`, `estilos.css`, `script.js` e `images/` a GitHub Pages.

## Cambiar horario, precios o duraciones
- **Horario y duraciones:** arriba del todo en `index.ts` (`HORARIO` y `SERVICIOS`).
- **Lo que se ve en la página:** en `index.html`, la lista de servicios y las opciones del `<select>` (atributos `data-min` y `data-price`).
- Mantén los dos lugares iguales. El servidor es el que manda: aunque alguien cambie la página, no puede reservar fuera de horario.

## Cómo funciona una reserva
1. La clienta elige tratamiento y día → la página le pide al servidor las horas libres.
2. El servidor mira el **Google Calendar** de Bellissima y las **reservas ya hechas**, y solo devuelve horas donde cabe el tratamiento completo.
3. Al confirmar, el servidor vuelve a verificar, guarda la reserva (la base de datos impide dos citas a la misma hora) y crea el evento en Google Calendar.
4. Después de cada cita quedan 15 minutos libres (`MARGEN_MINUTOS` en `index.ts`) para limpiar y prepararse.
5. La clienta ve la confirmación y un botón para escribir por WhatsApp sobre el depósito.
