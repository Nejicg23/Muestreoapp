# 📦 Sistema Empresarial de Gestión de Inventarios, Auditoría y Trazabilidad

Aplicación web progresiva (PWA-ready) de alto rendimiento desarrollada con **Next.js 16 (App Router)**, **React 19**, **Drizzle ORM**, **PostgreSQL / Supabase** y **Tailwind CSS 4**. Diseñada con estética **Material Design 3 OLED Black** y arquitectura **Mobile-First** para resolver con precisión matemática y legal la toma de inventarios físicos, conteo inverso con visto bueno (`✓`), reconteos, detección de fechas de vencimiento/cuarentena, captura fotográfica de evidencias e impresión de etiquetas y reportes PDF interactivos con enlace público en línea.

---

## 🔒 Aviso de Seguridad: Omisión de Claves API y Credenciales

> [!IMPORTANT]
> **Por estrictos estándares de seguridad y buenas prácticas de desarrollo, ningún archivo `.env` o `.env.local` con claves API, tokens o contraseñas de bases de datos ha sido incluido en este repositorio.**
>
> Para ejecutar o desplegar el proyecto, debes configurar tus propias credenciales basándote en la plantilla de ejemplo [`.env.example`](./.env.example).

---

## ✨ Módulos y Nuevas Implementaciones del Sistema

### 1. Blindaje de Seguridad, Login Maestro y Protección Anti-Fuerza Bruta
- **Proxy de Seguridad Global (`src/proxy.ts`):** Todas las rutas operativas y administrativas están protegidas a nivel de servidor. Ningún visitante no autenticado puede visualizar menús ni acceder a módulos internos sin iniciar sesión.
- **Protección Anti-Fuerza Bruta Persistente:** Control en base de datos (`failed_attempts` y `locked_until` en PostgreSQL) que bloquea automáticamente la cuenta durante **15 minutos** tras 5 intentos fallidos consecutivos.
- **Sesiones Criptográficas (`HMAC-SHA256`):** Cookies `HttpOnly`, `Secure` y `SameSite=Lax` firmadas con llave maestra (`AUTH_SECRET`) y contraseñas cifradas con `scrypt` + salt aleatorio de 16 bytes.
- **Control de Roles Estrictos:**
  - **Administrador:** Control total del sistema, cambio de contraseñas, desbloqueo de cuentas, reseteo de sesiones y auditoría inmutable.
  - **Auditor:** Autorizado para ejecutar y aprobar **reconteos**, ajustar valores monetarios y factores de empaque.
  - **Operador:** Encargado del conteo físico en piso, conteo rápido/inverso, registro de fechas de caducidad, fotos y novedades.

### 2. Conteo Rápido Móvil con Modalidad de Conteo Inverso (`✓`) y Estándar
El módulo `/inventario-rapido` cuenta con dos flujos de trabajo adaptados a la operación real en bodega:

#### ⚡ A. Modo Conteo Inverso (Buscar y Contar Físico ➔ Comparar con Sistema Externo y Visto `✓`)
1. **Paso 1 — Buscar Ítem y Registrar Conteo Físico al Instante:**
   - El operador busca el producto que va a contar, pulsa **"Contar este Ítem"** y registra en el acto sus **Cajas Físicas (`u`)** y **Fracciones Físicas (`f`)** (además de lote, fecha de vencimiento con atajos `+3M`, `+6M`, `+1A`, `+2A` o fotografía opcional).
   - Al pulsar **"Guardar Conteo e Ir por el Siguiente Producto"**, el ítem queda registrado y el buscador se limpia automáticamente para buscar el siguiente producto.
   - **El operador decide cuándo terminar:** Cuando finaliza de contar los productos deseados, pulsa **"Terminar de Registrar Conteos ➔ Pasar al Conteo del Sistema Externo"**.
2. **Paso 2 — Comparación con Sistema Externo y Check / Visto (`✓`):**
   - Se listan **únicamente los ítems que el operador contó** en el Paso 1.
   - Si la cantidad física coincide con lo reflejado en el sistema externo, el operador marca el botón **Check / Visto (`✓ Concuerda con el Sistema Externo`)** individualmente o mediante **"✓ Visto a Todos"**. Si difiere, ingresa la cantidad que muestra su sistema externo para calcular al instante el faltante o sobrante y su impacto en USD.
3. **Contabilización Exclusiva en el Informe Final:**
   - El sistema contabiliza e incluye en el informe final **exclusivamente los ítems en los que el operador registró conteo**. Todo producto de la base de datos que no fue utilizado o no fue contado queda completamente excluido del reporte.

#### 🔄 B. Modo Conteo Estándar (3 Pasos)
1. **Paso 1:** Selección múltiple de ítems del catálogo.
2. **Paso 2:** Asignación de stock desplegado por el sistema y validación de costos por caja/unidad.
3. **Paso 3:** Conteo físico real en estantería y liquidación de diferencias.

### 3. Informes PDF Interactivos con Link Público en Línea y Código QR (`/compartir/[sessionid]`)
- **Enlace Público de Solo Lectura con Firma Criptográfica:** Desde cualquier reporte (`/sesion/[sessionid]/reporte`), el botón **"PDF con Link en Línea"** genera un enlace público seguro (`/compartir/[sessionid]?token=...`) respaldado por **Supabase** y renderizado por **Vercel**.
- **PDF con Hipervínculo Clicable y QR Integrado:** Al imprimir o guardar como PDF (tanto el **Acta Formal Completa** como las **Hojas A6 de Faltantes y Sobrantes**), el documento PDF incluye un **botón/enlace interactivo clicable** y un **Código QR**. Cualquier directivo o auditor que reciba el PDF puede hacer clic dentro del archivo o escanear el QR para abrir en su navegador la vista detallada en línea (con KPIs financieros, tabla completa, lotes, vencimientos y fotografías) sin necesidad de usuario ni contraseña.

### 4. Interfaz Responsiva Mobile-First y Paleta Material Design 3 Black
- **Paleta OLED Dark/Black:** Superficies inspiradas en Material Design 3 (`#0A0A0A`, `#121212`, `#1E1E1E`, `#2C2C2C`) con alto contraste para entornos de bodega y ahorro de batería en dispositivos móviles.
- **Experiencia Móvil Nativa:** Barra de navegación inferior fija de 5 accesos rápidos en smartphones, controles táctiles de gran tamaño (`+` / `-`), pestañas deslizables y prevención de auto-zoom en iOS/Android (`font-size: 16px` en formularios).

### 5. Importación Inteligente de Bases de Datos y Captura Fotográfica Híbrida
- **Mapeo Flexible de Excel (`.xlsx`, `.xls`) y `.csv`:** Detección prioritaria de `id`/`sku`, `stk-sis`/`stock`, `producto`/`descripción`, `valor` y factor de empaque (`1xN`), bloqueando fracciones cuando el producto es `1x1`.
- **Compresor Fotográfico en Cliente:** Captura desde cámara trasera móvil (`capture="environment"`) o PC con compresión inteligente en Canvas HTML5 (~60-100 KB en Base64) para visualización inmediata en reportes y etiquetas térmicas.
- **Alertas de Cuarentena Automáticas:** Identificación visual de productos vencidos o próximos a vencer (< 90 días).

---

## 🛠️ Tecnologías Utilizadas

- **Framework:** [Next.js 16](https://nextjs.org/) (App Router, Turbopack, Server Actions, Proxy Security)
- **Frontend:** [React 19](https://react.dev/), [Tailwind CSS 4](https://tailwindcss.com/), [Lucide React](https://lucide.dev/)
- **ORM & Base de Datos:** [Drizzle ORM](https://orm.drizzle.team/), [PostgreSQL](https://www.postgresql.org/) hospedado en [Supabase](https://supabase.com/)
- **Procesamiento de Archivos:** [SheetJS (xlsx)](https://docs.sheetjs.com/)
- **Almacenamiento Local Offline:** [Dexie.js](https://dexie.org/) (IndexedDB)

---

## 🚀 Guía Paso a Paso para Ejecución Local

### 1. Clonar el Repositorio
```bash
git clone https://github.com/Nejicg23/Muestreoapp.git
cd Muestreoapp
```

### 2. Instalar Dependencias
```bash
npm install
```

### 3. Configurar Variables de Entorno
Copia el archivo de plantilla `.env.example` y nómbralo `.env.local`:
```bash
cp .env.example .env.local
```

Abre `.env.local` y coloca las credenciales de tu proyecto en Supabase / PostgreSQL:
```env
NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu-clave-publica-anon
DATABASE_URL=postgresql://postgres:TU_PASSWORD@db.tu-proyecto.supabase.co:5432/postgres
AUTH_SECRET=una-clave-secreta-larga-y-segura-para-firmar-sesiones-y-links
```

### 4. Sincronizar el Esquema de Base de Datos
Para generar y aplicar las tablas en tu base de datos PostgreSQL:
```bash
npx drizzle-kit push
```

### 5. Iniciar Servidor de Desarrollo
```bash
npm run dev
```
Abre tu navegador en [http://localhost:3000](http://localhost:3000).

---

## ☁️ Guía Paso a Paso para Despliegue en Vercel

### Paso 1: Subir cambios a tu repositorio de GitHub
```bash
git push -u origin main
```

### Paso 2: Importar el proyecto en Vercel
1. Ingresa a tu cuenta en [Vercel](https://vercel.com).
2. Haz clic en **"Add New..."** ➔ **"Project"**.
3. Selecciona el repositorio `Nejicg23/Muestreoapp` y haz clic en **"Import"**.

### Paso 3: Configurar las Variables de Entorno en Vercel
En la sección **"Environment Variables"**, añade las siguientes variables:

| Nombre de la Variable | Valor Requerido | Descripción |
|---|---|---|
| `DATABASE_URL` | `postgresql://postgres:PASSWORD@HOST:PORT/postgres` | URL de conexión de PostgreSQL / Supabase (el sistema sanitiza automáticamente corchetes o caracteres especiales) |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://[ID].supabase.co` | URL pública de tu instancia de Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `eyJhbGci...` | Clave pública anónima de Supabase |
| `AUTH_SECRET` | `clave-secreta-produccion` | Llave criptográfica para firmar sesiones y enlaces públicos de reportes |

### Paso 4: Desplegar
Haz clic en **"Deploy"**. Vercel compilará automáticamente el proyecto con Next.js 16 y publicará tu entorno de producción.

---

## 📱 Rutas Principales de la Aplicación

- `/login` : Portal blindado de inicio de sesión con protección anti-fuerza bruta.
- `/` : Panel principal y acceso rápido a módulos de inventario.
- `/inventario-rapido` : Conteo Rápido Móvil con **Modo Conteo Inverso (Físico ➔ Visto `✓` Sistema)** y **Modo Estándar**.
- `/importar` : Importador inteligente de catálogos Excel (`.xlsx`, `.csv`) y creación de sesiones.
- `/conteo/[sessionid]` : Terminal de conteo físico formal con soporte offline (IndexedDB).
- `/sesion/[sessionid]/reporte` : Reporte ejecutivo, generador de **PDF con Link en Línea y QR**, hojas A6 de faltantes/sobrantes, etiquetas térmicas y exportación a Excel.
- `/compartir/[sessionid]` : Vista pública interactiva de solo lectura (accesible mediante el link o código QR incrustado en el PDF).
- `/admin` : Panel de control maestro, gestión de usuarios/contraseñas, desbloqueo de cuentas y bitácora legal inmutable.

---

## 📄 Licencia
Este proyecto es de uso privado y corporativo. Todos los derechos reservados.
