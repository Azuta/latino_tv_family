# 📺 Latino TV Family - Servicio IPTV Serverless Privado

Servicio de IPTV privado, gratuito y de alta disponibilidad alojado en **Vercel** y versionado en **GitHub**, diseñado para reproducir directamente transmisiones HLS (`.m3u8`) en Smart TVs, TV Box y teléfonos móviles sin consumir ancho de banda de tu hogar ni requerir un servidor dedicado.

---

## 🏛️ Arquitectura del Sistema

```
[Cliente: Smart TV / Móvil / VLC]
       │
       │ (1. Solicita la lista M3U una vez al día o al iniciar)
       ▼
[Servidor de Catálogo: Vercel] ──► Entrega archivo de texto (.m3u / JSON)
       │
       │ (2. El dispositivo reproduce directamente desde el origen)
       ▼
[CDN Oficial del Canal] ─────────► Transmite video HLS (.m3u8) directo a pantalla
```

* **Vercel como intermediario:** Únicamente sirve el archivo de texto y gestiona cabeceras CORS (`Access-Control-Allow-Origin: *`).
* **Consumo de recursos:** Ni el video ni el tráfico pesado pasan por Vercel. Cada televisor o dispositivo se conecta de forma directa a la CDN oficial del canal.
* **Logs en tiempo real:** En el panel de Vercel puedes consultar peticiones, IP y `User-Agent` de tus reproductores.

---

## 📂 Estructura del Proyecto

```plaintext
latino_tv_family/
├── vercel.json           # Configuración de cabeceras HTTP (CORS, Mime-type M3U, Cache)
├── public/
│   ├── canales.m3u       # Lista maestra M3U Plus con metadatos y logos
│   └── index.html        # Portal web interactivo con reproductor HLS de prueba
├── api/
│   └── playlist.js       # Función Serverless para filtrado dinámico (?categoria=, ?pais=, ?format=json)
└── README.md             # Guía completa de despliegue y uso
```

---

## 🚀 Despliegue en Vercel (Paso a Paso)

### 1. Guardar y subir los cambios a GitHub
Desde tu terminal en esta carpeta:
```bash
git add .
git commit -m "feat: configuracion inicial iptv con vercel, lista m3u y reproductor web"
git push origin main
```

### 2. Conectar con Vercel
1. Ingresa a [vercel.com](https://vercel.com) e inicia sesión con tu cuenta de GitHub.
2. Haz clic en **Add New...** > **Project**.
3. Selecciona el repositorio **`latino_tv_family`** y pulsa **Import**.
4. Deja los ajustes predeterminados (Framework Preset: *Other*) y haz clic en **Deploy**.

### 3. Obtener tus URLs públicas
En menos de 10 segundos, Vercel generará el dominio de tu proyecto (ejemplo: `https://latino-tv-family.vercel.app`):
* **Web Dashboard & Reproductor:** `https://latino-tv-family.vercel.app/`
* **Enlace M3U para tus Smart TVs:** `https://latino-tv-family.vercel.app/canales.m3u`
* **API Dinámica por Categoría:** `https://latino-tv-family.vercel.app/api/playlist?categoria=Noticias`

---

## 🧪 Pruebas y Validación

1. **En el Navegador:**  
   Ingresa a `https://tu-proyecto.vercel.app/` para ver la interfaz interactiva, probar los canales en tiempo real y copiar el enlace M3U.
2. **En VLC Media Player (PC / Mac):**  
   * Menú **Medio** > **Abrir emisión de red...** (Ctrl + N)
   * Pega `https://tu-proyecto.vercel.app/canales.m3u` y presiona **Reproducir**.
   * Abre la lista de reproducción (Ctrl + L) para ver los canales organizados.
3. **Acortar URL para el control remoto:**  
   Pega tu enlace de Vercel en [tinyurl.com](https://tinyurl.com) para crear un enlace corto y fácil de escribir en el televisor (ejemplo: `tinyurl.com/tv-familia-26`).

---

## 📺 Configuración en Smart TV y Reproductores

| Dispositivo | Aplicación recomendada | Procedimiento |
| :--- | :--- | :--- |
| **Android TV / Fire Stick / Google TV** | **TiviMate IPTV Player** | *Añadir lista* > *Lista M3U* > Escribir la URL de Vercel o TinyURL. |
| **Smart TV Samsung / LG** | **IPTV Smarters Pro** | *Add User* > *Load Your Playlist or File/URL* > Asignar nombre y pegar la URL. |
| **iPhone / iPad / Apple TV** | **IPTV Smarters Lite / GSE Smart IPTV** | *Añadir Playlist* > *M3U URL* > Pegar el enlace. |
| **Celular Android** | **Televizo / IPTV Smarters** | *+ Añadir lista de reproducción* > Pegar el enlace. |

---

## 🔄 Cómo Actualizar Canales (Auto-Deploy)

1. Abre `public/canales.m3u` en tu editor o directamente desde GitHub.
2. Añade un nuevo canal siguiendo el formato:
   ```text
   #EXTINF:-1 tvg-id="CANAL_ID" tvg-name="Nombre" tvg-logo="https://url-del-logo.png" group-title="Noticias",Nombre del Canal
   https://servidor-cdn.com/live/stream.m3u8
   ```
3. Haz commit y push a `main`.
4. Vercel redesplegará los cambios en 5 segundos. **La URL de tu lista nunca cambia**, por lo que en tu Smart TV solo debes pulsar **Actualizar lista** dentro de la app.
