# 📦 Sistema Empresarial de Gestión de Inventarios, Auditoría y Trazabilidad

Aplicación web progresiva (PWA-ready) de alto rendimiento desarrollada con **Next.js 16 (App Router)**, **React 19**, **Drizzle ORM**, **PostgreSQL / Supabase** y **Tailwind CSS**. Diseñada para resolver con precisión matemática y legal la toma de inventarios físicos, auditoría de stock, reconteos, detección de fechas de vencimiento/cuarentena, captura fotográfica de evidencias e impresión de etiquetas y reportes ejecutivos.

---

## 🔒 Aviso de Seguridad: Omisión de Claves API y Credenciales

> [!IMPORTANT]
> **Por estrictos estándares de seguridad y buenas prácticas de desarrollo, ningún archivo `.env` o `.env.local` con claves API, tokens o contraseñas de bases de datos ha sido incluido en este repositorio.**
>
> Para ejecutar o desplegar el proyecto, debes configurar tus propias credenciales basándote en la plantilla de ejemplo [`.env.example`](./.env.example).

---

## ✨ Módulos y Capacidades del Sistema

### 1. Control de Acceso y Roles Estrictos
- **Administrador:** Acceso y control total del sistema. Capacidad de borrado total para inicializar nuevas bases de datos, gestión de usuarios, visualización de auditoría inmutable de cambios y cierre oficial de sesiones.
- **Auditor:** Autorizado para realizar y autorizar **reconteos**, así como ajustar o modificar valores monetarios y factores de empaque durante la sesión.
- **Operador:** Encargado del escaneo y conteo físico en piso, registro de fracciones/unidades y reporte de novedades (solicitud de revisión de cruces, mercancía en mal estado o producto próximo a vencer).

### 2. Importación Flexible de Bases de Datos
- Algoritmo de mapeo inteligente para hojas de cálculo Excel (`.xlsx`, `.xls`) y archivos `.csv`.
- Detección prioritaria de columnas:
  1. `id` / `sku` / `código` (Identificador único del producto)
  2. `stk-sis` / `stock` (Stock teórico reportado por el ERP)
  3. `producto` / `descripción` (Nombre o detalle de la referencia)
  4. `valor` (Valor monetario del producto o de la caja completa)
- Cálculo automático de costos unitarios cuando el archivo especifica costo total por caja (`costBasis = 'pack'`), derivando el valor unitario con alta precisión para valorizar faltantes y sobrantes.
- Detección de factor de empaque: si el producto no tiene habilitada la venta fraccionada, el sistema bloquea automáticamente la entrada de fracciones en las pantallas de conteo.

### 3. Conteo Rápido Móvil
Flujo optimizado para dispositivos móviles en 3 pasos:
1. **Selección de ítems:** Búsqueda en tiempo real sobre la base de datos para seleccionar 5, 10 o la cantidad requerida de productos a auditar.
2. **Asignación de Stock de Sistema y Costo:** Validación o ingreso manual de stock teórico y asignación de valor monetario si el producto no contaba con precio registrado.
3. **Conteo Físico y Fechas:**
   - Registro de cajas completas (`u`) y fracciones (`f`).
   - Fecha y hora de auditoría configurable.
   - Selector de fecha de caducidad con atajos de horizonte rápido: `+3M`, `+6M`, `+1A`, `+2A`.
   - **Alerta de Cuarentena Automática:** Productos con vencimiento inferior a 90 días son marcados visualmente con etiqueta amarilla indicando traslado a custodia o cuarentena.

### 4. Captura Fotográfica Híbrida (Cámara Móvil y PC)
- Compatible con cámaras de smartphones (Android / iOS) mediante captura nativa trasera (`capture="environment"`) y explorador de archivos en PC.
- **Compresor Inteligente en Cliente:** Mediante Canvas HTML5, comprime imágenes de 5-12 MB a ~60-100 KB en formato Base64 sin pérdida de legibilidad de etiquetas o códigos, permitiendo almacenamiento ultrarrápido y funcionamiento offline.

### 5. Reportes Ejecutivos y Etiquetas Físicas
- **Reporte Detallado y Rápido:** Visualización tabular con filtros por estado (cuadrados, faltantes, sobrantes y en cuarentena).
- **Hojas A6 Tipo Factura:**
  - Hoja A6 independiente para el detalle de productos **Faltantes**.
  - Hoja A6 independiente para el detalle de productos **Sobrantes**.
- **Generador e Impresión de Etiquetas Físicas:** Modal con formato de etiqueta adhesiva térmica que incluye código de barras generado, descripción, ubicación, fecha de vencimiento, distintivo de cuarentena y fotografía del ítem.
- **Exportación a Excel:** Descarga de balance consolidado completo o exclusivo de novedades.

### 6. Auditoría y Trazabilidad Legal
- Cada modificación, reconteo, ajuste de stock o cambio de precio genera un registro inmutable en la tabla de auditoría con identificación del usuario, rol, valores anteriores, nuevos valores, motivo y fecha/hora exacta.

---

## 🛠️ Tecnologías Utilizadas

- **Framework:** [Next.js 16](https://nextjs.org/) (App Router, Turbopack, Server Actions)
- **Frontend:** [React 19](https://react.dev/), [Tailwind CSS 4](https://tailwindcss.com/), [Lucide React](https://lucide.dev/)
- **ORM & Base de Datos:** [Drizzle ORM](https://orm.drizzle.team/), [PostgreSQL](https://www.postgresql.org/) hospedado en [Supabase](https://supabase.com/)
- **Procesamiento de Archivos:** [SheetJS (xlsx)](https://docs.sheetjs.com/)
- **Almacenamiento Local Offline:** [Dexie.js](https://dexie.org/) (IndexedDB)

---

## 🚀 Guía Paso a Paso para Ejecución Local

### 1. Clonar el Repositorio
```bash
git clone https://github.com/TU_USUARIO/TU_REPOSITORIO.git
cd inventario-app
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
DATABASE_URL=postgresql://postgres:[TU_CONTRASEÑA]@db.tu-proyecto.supabase.co:5432/postgres
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

Dado que la aplicación está lista para integrarse con Vercel desde GitHub:

### Paso 1: Subir cambios a tu repositorio de GitHub
Asegúrate de que tus cambios locales estén en GitHub:
```bash
git push -u origin main
```

### Paso 2: Importar el proyecto en Vercel
1. Ingresa a tu cuenta en [Vercel](https://vercel.com).
2. Haz clic en **"Add New..."** ➔ **"Project"**.
3. Selecciona tu cuenta de GitHub y busca el repositorio `inventario-app`.
4. Haz clic en **"Import"**.

### Paso 3: Configurar las Variables de Entorno en Vercel
En la sección **"Environment Variables"** antes de presionar Deploy, añade las 3 variables:

| Nombre de la Variable | Valor Requerido | Descripción |
|---|---|---|
| `DATABASE_URL` | `postgresql://postgres:[PASSWORD]@[HOST]:[PORT]/postgres` | URL de conexión directa o pooler de PostgreSQL |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://[ID].supabase.co` | URL pública de tu instancia de Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `eyJhbGci...` | Clave pública anónima de Supabase |

> [!TIP]
> **Recomendación para Supabase en Serverless (Vercel):** En entornos serverless como Vercel, es preferible utilizar la cadena de conexión con **Session Pooling** o **Transaction Pooling** proporcionada por Supabase (puerto `6543` o `5432` con `?pgbouncer=true` o modo directo según tu plan) para optimizar la gestión de conexiones concurrentes.

### Paso 4: Desplegar
Haz clic en **"Deploy"**. Vercel compilará automáticamente el proyecto con Next.js y te proporcionará tu URL pública de producción lista para pruebas y uso en campo.

---

## 📱 Rutas Principales de la Aplicación

- `/` : Menú principal y acceso rápido a módulos de inventario.
- `/login` : Selección interactiva de rol y autenticación del operador/auditor.
- `/onboarding` : Asistente inicial para configuración de roles y carga de primera base de datos.
- `/inventario-rapido` : Flujo en 3 pasos para inventarios móviles ágiles con fechas de caducidad y captura fotográfica.
- `/conteo/[sessionid]` : Terminal de conteo físico formal con soporte offline.
- `/sesion/[sessionid]/reporte` : Reporte detallado, exportación a Excel, impresión de hojas A6 y generador de etiquetas.
- `/admin` : Panel de control maestro, historial legal de auditoría y reseteo general de sesiones.

---

## 📄 Licencia
Este proyecto es de uso privado y corporativo. Todos los derechos reservados.
