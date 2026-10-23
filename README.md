# 📺 Latino TV Family - Servicio IPTV Serverless Privado

Servicio de IPTV privado, gratuito y de alta disponibilidad alojado en **Vercel** y versionado en **GitHub**, diseñado para reproducir directamente transmisiones HLS (`.m3u8`) en Smart TVs, TV Box y teléfonos móviles sin consumir ancho de banda de tu hogar ni requerir un servidor dedicado.

El catálogo cuenta con **580 canales verificados en vivo**, organizados rigurosamente por **idioma** y **categoría**, libres de geobloqueos y canales caídos.

---

## 📊 Catálogo de Canales Verificados

| Idioma | Canales | Categorías Disponibles |
| :--- | :---: | :--- |
| 🇪🇸 **Español** | **353** | Noticias, Deportes, Cine & Series, Infantil & Familia, Entretenimiento, Cultura & Documentales, Música |
| 🇬🇧 **English** | **166** | News, Sports, Movies & Series, Kids & Family, Entertainment, Culture & Docs, Music |
| 🇯🇵 **Japonés (日本)** | **61** | Noticias (NHK World, 日テレNEWS, MBS, Weathernews), Anime & Kids (TOKYO MX, MAX Anime), Cine & Entretenimiento, Cultura |
| **TOTAL** | **580** | **100% Verificados en tiempo real** |

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
├── vercel.json                 # Configuración de cabeceras HTTP (CORS, Mime-type M3U, Cache)
├── public/
│   ├── canales.m3u             # Lista maestra M3U Plus (580 canales con logos y EPG)
│   └── index.html              # Portal web interactivo con reproductor HLS y filtros
├── api/
│   └── playlist.js             # API Serverless para filtrado dinámico (?idioma=, ?categoria=, ?format=json)
├── scripts/
│   └── fetch_and_verify.js     # Motor automatizado de escaneo y verificación en vivo
└── README.md                   # Documentación completa
```

---

## 🚀 Despliegue en Vercel (Paso a Paso)

### 1. Guardar y subir los cambios a GitHub
```bash
git add .
git commit -m "feat: agregar canales en japones, ingles y espanol (580 verificados)"
git push origin main
```

### 2. Conectar con Vercel
1. Ingresa a [vercel.com](https://vercel.com) e inicia sesión con tu cuenta de GitHub.
2. Haz clic en **Add New...** > **Project**.
3. Selecciona el repositorio **`latino_tv_family`** y pulsa **Import**.
4. Deja los ajustes predeterminados (Framework Preset: *Other*) y haz clic en **Deploy**.

### 3. Obtener tus URLs públicas
En menos de 10 segundos, Vercel generará el dominio de tu proyecto:
* **Web Dashboard & Reproductor:** `https://tu-proyecto.vercel.app/`
* **Lista M3U Completa (580 canales):** `https://tu-proyecto.vercel.app/canales.m3u`
* **Solo Canales en Español:** `https://tu-proyecto.vercel.app/api/playlist?idioma=es`
* **Solo Canales en Japonés:** `https://tu-proyecto.vercel.app/api/playlist?idioma=ja`
* **Solo Canales en Inglés:** `https://tu-proyecto.vercel.app/api/playlist?idioma=en`
* **Solo Deportes:** `https://tu-proyecto.vercel.app/api/playlist?categoria=Deportes`
* **Solo Noticias:** `https://tu-proyecto.vercel.app/api/playlist?categoria=Noticias`
* **Catálogo en formato JSON:** `https://tu-proyecto.vercel.app/api/playlist?format=json`

---

## 🧪 Pruebas y Validación

1. **En el Navegador:**  
   Ingresa a `https://tu-proyecto.vercel.app/` para ver la interfaz interactiva, filtrar por idioma (`🇪🇸 Español`, `🇬🇧 English`, `🇯🇵 Japonés`) y categoría, y probar cualquier canal con el reproductor HLS.
2. **En VLC Media Player (PC / Mac):**  
   * Menú **Medio** > **Abrir emisión de red...** (Ctrl + N)
   * Pega `https://tu-proyecto.vercel.app/canales.m3u` y presiona **Reproducir**.
   * Abre la lista de reproducción (Ctrl + L) para ver los canales organizados en carpetas.
3. **Acortar URL para el control remoto:**  
   Pega tu enlace de Vercel en [tinyurl.com](https://tinyurl.com) para crear un enlace corto y fácil de escribir en el televisor (ejemplo: `tinyurl.com/tv-familia-26`).

---

## 📺 Configuración en Smart TV y Reproductores

| Dispositivo | Aplicación recomendada | Procedimiento |
| :--- | :--- | :--- |
| **Android TV / Fire Stick / Google TV** | **TiviMate IPTV Player** | *Añadir lista* > *Lista M3U* > Escribir la URL de Vercel o TinyURL. |
| **Smart TV Samsung / LG** | **IPTV Smarters Pro** | *Add User* > *Load Your Playlist or File/URL* > Asignar nombre y pegar la URL. |
| **iPhone / iPad / Apple TV** | **IPTV Smarters Lite / Televizo** | *Añadir Playlist* > *M3U URL* > Pegar el enlace. |
| **Celular Android** | **Televizo / IPTV Smarters** | *+ Añadir lista de reproducción* > Pegar el enlace. |

---

## 🔄 Re-verificación y Actualización de Canales

Puedes volver a ejecutar el verificador automatizado en cualquier momento:
```bash
node scripts/fetch_and_verify.js
git commit -am "chore: actualizar canales verificados"
git push origin main
```
Vercel detectará el commit en GitHub y actualizará la lista en 5 segundos sin cambiar tu URL.
