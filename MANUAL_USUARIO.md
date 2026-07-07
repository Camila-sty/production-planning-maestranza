---

# MANUAL DE USUARIO

## Sistema de Planificación de Maestranza

### ETP Spa — Plataforma Digital de Gestión de Producción

---

**Versión:** 2.0
**Fecha de actualización:** Julio 2026
**Destinatario:** Equipo Operativo y de Gestión — ETP Spa
**Confidencial:** Uso interno

---

## ÍNDICE

1. [Introducción](#1-introducción)
2. [Acceso al Sistema](#2-acceso-al-sistema)
3. [Estructura de la Plataforma](#3-estructura-de-la-plataforma)
4. [Nuevo Registro](#4-nuevo-registro)
5. [Historial de Planificación](#5-historial-de-planificación)
6. [Buffer de Atraso](#6-buffer-de-atraso)
7. [Motor de Planificación CP-SAT](#7-motor-de-planificación-cp-sat)
8. [Exportación Excel](#8-exportación-excel)
9. [Estadísticas](#9-estadísticas)
10. [Reglas del Sistema](#10-reglas-del-sistema)
11. [Gestión de Usuarios](#11-gestión-de-usuarios)
12. [Buenas Prácticas](#12-buenas-prácticas)
13. [Solución de Problemas Frecuentes](#13-solución-de-problemas-frecuentes)
14. [Preguntas Frecuentes](#14-preguntas-frecuentes)

---

## 1. Introducción

### 1.1 Objetivo del sistema

El **Sistema de Planificación de Maestranza de ETP Spa** es una plataforma web diseñada para registrar, secuenciar y optimizar el trabajo del taller. Permite ingresar Órdenes de Trabajo (OT), asignarles prioridades y generar automáticamente un calendario de producción que distribuye la carga según la capacidad real de cada proceso.

### 1.2 Qué resuelve

| Problema | Solución |
|---|---|
| Sin visibilidad de fechas de entrega | Calcula y muestra la entrega estimada por equipo |
| Asignación informal de recursos | Usa prioridad, inicio y capacidad para secuenciar |
| Sin trazabilidad histórica | Guarda cada versión de planificación ejecutada |
| Atrasos no reflejados formalmente | Buffer de días hábiles sobre equipos específicos |
| Sin métricas de gestión | Panel de estadísticas de eventos de atraso |

### 1.3 Flujo general de trabajo

```
1. Registrar equipos (OT, Código Plazo, Inicio, Prioridad)
        ↓
2. Revisar y ajustar prioridades
        ↓
3. Agregar días especiales de trabajo (si corresponde)
        ↓
4. Ejecutar planificador  [solo administradores]
        ↓
5. Revisar resultados y fechas estimadas
        ↓
6. Descargar Excel para distribución
        ↓
7. Registrar buffers cuando hay atrasos reales → volver a planificar
```

---

## 2. Acceso al Sistema

### 2.1 Inicio de sesión

La pantalla de inicio de sesión requiere:

- **Correo electrónico corporativo**
- **Contraseña**

### 2.2 Dominios permitidos

Solo se aceptan correos de los siguientes dominios corporativos:

| Dominio | Empresa |
|---|---|
| `@equiposycamiones.cl` | Equipos y Camiones |
| `@pto.cl` | PTO |
| `@etpequipos.cl` | ETP Equipos |

Correos de otros dominios (Gmail, Hotmail, etc.) son rechazados con el mensaje:

> *"Solo se permiten correos corporativos con los dominios @equiposycamiones.cl, @pto.cl o @etpequipos.cl."*

### 2.3 Crear una cuenta

Si el registro está habilitado, la pantalla de acceso muestra la pestaña **"Crear cuenta"**. Al registrarse:

- El correo debe pertenecer a uno de los dominios permitidos.
- El correo ingresado debe existir realmente — se enviará un enlace de activación. Si el correo no existe, no podrás confirmar la cuenta ni iniciar sesión.
- La contraseña debe tener al menos 6 caracteres.

### 2.4 Recuperación de contraseña

No existe recuperación automática de contraseña. Contactar al administrador del sistema para restablecer el acceso.

### 2.5 Roles del sistema

| Rol | Descripción |
|---|---|
| **Usuario** | Puede ver registros, crear, editar y descargar el Excel |
| **Administrador** | Todo lo anterior + ejecutar planificación, gestionar reglas, usuarios y estadísticas |

---

## 3. Estructura de la Plataforma

### 3.1 Pantalla principal (`/`)

Accesible para todos los usuarios autenticados. Contiene tres secciones:

| Sección | Descripción |
|---|---|
| **Nuevo Registro** | Formulario para ingresar una OT al sistema |
| **Historial de Planificación** | Tabla con todos los registros, búsqueda, filtros y acciones |
| **Motor de Planificación (CP-SAT)** | Ejecuta la planificación. Muestra resultados y gestión de días especiales |

### 3.2 Menú de administrador

Los usuarios con rol **administrador** ven opciones adicionales en el encabezado:

| Opción | Ruta | Descripción |
|---|---|---|
| **Reglas** | `/admin/reglas` | Capacidades por proceso y tiempos por código plazo |
| **Usuarios** | `/admin/usuarios` | Gestión de cuentas de usuario |
| **Estadísticas** | `/admin/estadisticas` | Eventos de atraso y gráficos históricos |

---

## 4. Nuevo Registro

### 4.1 Propósito

El formulario **Nuevo Registro** ingresa una OT al sistema. Cada registro corresponde a un equipo en producción que el motor considerará en la próxima planificación.

### 4.2 Campos del formulario

#### Identificación

| Campo | Descripción | Obligatorio |
|---|---|---|
| **OT** | Número de Orden de Trabajo | No (recomendado) |
| **Cliente Interno** | Área interna responsable | No |
| **Cliente** | Nombre del cliente externo | No |

#### Equipo

| Campo | Descripción |
|---|---|
| **Equipo** | Tipo o nombre del equipo a fabricar |
| **Modelo / Capacidad** | Descripción de capacidad (ej: 20 m³) |
| **Camión** | Marca o tipo de camión asociado |
| **Modelo** | Modelo específico del equipo |
| **VIN** | Número de chasis del vehículo |
| **Patente** | Patente del vehículo |
| **N° Recepción** | Número interno de recepción |
| **Color Equipo** | Color del equipo |
| **Color Cabina** | Color de la cabina |
| **Neumático Repuesto** | Dato del neumático de repuesto |

#### Campos críticos para la planificación

> **Atención:** Los siguientes tres campos determinan si el equipo participa en la planificación. Sin ellos, el motor lo ignorará.

| Campo | Descripción | Impacto |
|---|---|---|
| **Código Plazo** | Define el tipo de equipo y los tiempos por proceso | Determina cuántos días hábiles ocupa cada proceso |
| **Inicio** | Fecha desde la cual el equipo puede comenzar a producirse | Sin fecha de Inicio, el equipo queda excluido de la planificación |
| **Prioridad** | Número entero. Menor valor = mayor urgencia | Define el orden cuando dos equipos compiten por el mismo proceso |

> La **Fecha de Llegada** es solo informativa — sirve como referencia histórica pero no controla la planificación. El campo que sí importa para el motor es **Inicio**.

#### Comercial

| Campo | Descripción |
|---|---|
| **Venta** | Monto o referencia comercial |
| **OC** | Número de Orden de Compra |
| **Factura** | Número de factura asociada |
| **Cotización** | Marca si el equipo está en etapa de cotización (no afecta planificación) |

#### Estado

| Campo | Descripción |
|---|---|
| **Entregado** | Marca el equipo como entregado al cliente. Cuando está activo, el equipo es **excluido automáticamente** del motor de planificación |

### 4.3 El campo Código Plazo

El Código Plazo es el campo más importante para el motor. Define internamente cuántos días hábiles requiere el equipo en cada proceso de fabricación. Los códigos disponibles se administran en la sección **Reglas**.

Ejemplos típicos:

| Código | Tipo de equipo |
|---|---|
| 1 | Aljibe 10 m³ |
| 2 | Aljibes 15–30 m³ |
| 6 | Carrocería |
| 8 | Combustible básico |
| 16 | Tolvas 15–25 m³ mineras |

> Si el código de un equipo nuevo no existe en el sistema, contactar al administrador para registrar los tiempos correspondientes en la sección Reglas.

### 4.4 Prioridad

La prioridad es un número entero positivo. Menor número = mayor urgencia.

| Valor | Significado |
|---|---|
| **1 – 3** | Máxima urgencia |
| **4 – 10** | Alta prioridad |
| **11 – 30** | Prioridad media |
| **30+** | Baja prioridad |

Al crear un registro, el sistema propone automáticamente el siguiente número disponible para evitar duplicados.

---

## 5. Historial de Planificación

### 5.1 Propósito

El Historial muestra todos los equipos registrados junto con su información, estado, fechas estimadas y acciones disponibles.

### 5.2 Búsqueda y filtros

| Herramienta | Uso |
|---|---|
| **Buscador de texto** | Busca por OT, cliente, equipo, VIN, patente o cualquier campo de texto |
| **Filtro Entregado** | Mostrar solo entregados, solo pendientes, o todos |
| **Filtro Estado** | Mostrar solo "Al día", solo "Atrasado", o todos |
| **Ordenamiento de columnas** | Clic en el encabezado de cualquier columna para ordenar ascendente / descendente |

### 5.3 Columnas principales

| Columna | Descripción |
|---|---|
| **OT** | Número de Orden de Trabajo |
| **Cliente Interno** | Área interna |
| **Cliente** | Cliente externo |
| **Código Plazo** | Tipo de equipo |
| **Equipo / Modelo** | Descripción |
| **Llegada** | Fecha de ingreso referencial |
| **Inicio** | Fecha de inicio para planificación |
| **Entrega Estimada** | Calculada por el motor en la planificación activa |
| **Entregado** | Estado de entrega al cliente |
| **Prioridad** | Valor numérico de urgencia |
| **Buffer** | Ajuste de días hábiles (negativo = atraso) |
| **Estado** | Al día / Atrasado |
| **Acciones** | Editar, gestionar buffer, eliminar |

### 5.4 Estado del equipo

| Estado | Criterio | Significado |
|---|---|---|
| **Al día** | Buffer = 0 o no tiene buffer | Sigue el ritmo planificado |
| **Atrasado** | Tiene buffer negativo | Se ha registrado un atraso formal |

### 5.5 Historial de entregas estimadas

Al hacer clic en el badge de estado de un equipo, se despliega un panel con el historial de fechas de entrega estimadas a lo largo del tiempo — una entrada por cada planificación ejecutada.

| Columna | Significado |
|---|---|
| **Versión** | Número de la planificación |
| **Fecha ejecución** | Cuándo se ejecutó esa planificación |
| **Entrega estimada** | Fecha de término calculada en esa versión |

La fila en **amarillo** corresponde a la planificación activa actual.

### 5.6 Editar un registro

Desde la columna **Acciones**, el ícono de edición abre un modal con el formulario completo del registro. Todos los campos son modificables excepto el ID. Después de editar campos que afectan la planificación (Código Plazo, Inicio, Prioridad), se recomienda volver a ejecutar el motor.

### 5.7 Eliminar un registro

La eliminación es permanente. El equipo deja de existir en el sistema y no aparecerá en futuras planificaciones. Los slots que ocupaba quedan liberados.

### 5.8 Marcar como Entregado

Desde la columna Acciones se puede confirmar la entrega de un equipo. Al hacerlo:

- El campo `Entregado` se activa.
- Se registra la **fecha real de entrega** en el sistema.
- El equipo queda **excluido automáticamente** de futuras planificaciones.
- En el Excel, las filas de equipos entregados se destacan en **amarillo**.

---

## 6. Buffer de Atraso

### 6.1 ¿Qué es un buffer?

Un buffer es un ajuste manual en días hábiles que se aplica sobre un equipo específico para indicarle al motor que ese equipo tiene un desvío real respecto a lo planificado.

| Valor | Significado |
|---|---|
| **Negativo (–n)** | El equipo tiene un atraso de n días hábiles |
| **Cero (0)** | Sin ajuste — el equipo sigue el calendario normal |
| **Positivo (+n)** | El equipo puede adelantarse n días (uso menos frecuente) |

### 6.2 Cómo funciona el buffer negativo

El atraso **no reinicia el equipo desde cero**. El motor respeta todos los procesos que ya debería haber completado al día en que se registró el buffer. Solo el tramo pendiente se ve retrasado.

**Ejemplo:**

Un equipo registra buffer –4 el día 03-06:

| Proceso | Estado al 03-06 | Resultado |
|---|---|---|
| INGENIERÍA | Completado | Se respeta |
| CORTE | Completado | Se respeta |
| PLEGADO | Completado | Se respeta |
| ARMADO | Completado | Se respeta |
| HIDRÁULICA | Completado | Se respeta |
| **PINTURA** | **Pendiente** | **No puede iniciar antes del 09-06 (03-jun + 4 días hábiles)** |
| TERMINACIONES | Pendiente | Sigue naturalmente desde PINTURA |
| CONTROL DE CALIDAD | Pendiente | Sigue naturalmente |

### 6.3 El campo Nota

Al registrar o modificar un buffer, se puede ingresar una **nota opcional** que explique el motivo del ajuste.

Esta nota queda guardada en el historial de ajustes y es visible en la pestaña **Estadísticas → Detalle de Eventos**.

> Documentar el motivo del buffer facilita el seguimiento posterior y la auditoría de atrasos.

### 6.4 Cuándo genera un evento estadístico

Un ajuste de buffer genera un **evento de atraso** que aparece en Estadísticas cuando:

- El nuevo valor de buffer es **menor** que el anterior (delta negativo).

Esto significa: solo se registran los cambios que **empeoran** la situación del equipo, no los ajustes que la mejoran o que son cero.

### 6.5 Cómo registrar un buffer

1. En el Historial, localizar el equipo.
2. En la columna Acciones, hacer clic en el ícono de buffer (ajuste).
3. Ingresar el valor en días (negativo para atraso).
4. Opcionalmente agregar una nota descriptiva.
5. Guardar.
6. **Ejecutar una nueva planificación** — el buffer no tiene efecto hasta planificar.

### 6.6 Cómo eliminar un buffer

Editar el buffer del equipo y establecerlo en **0**. Luego volver a planificar.

---

## 7. Motor de Planificación CP-SAT

### 7.1 ¿Qué es?

El motor es el componente central del sistema. Usa el algoritmo **OR-Tools CP-SAT** de Google para asignar el trabajo de cada equipo en cada proceso, respetando capacidades, prioridades y restricciones de disponibilidad.

En producción, el motor corre como un **microservicio Python en Railway**. El botón "Planificar" llama a ese servicio vía HTTP y espera el resultado.

> Solo los **administradores** pueden ejecutar el motor.

### 7.2 Qué considera el motor

| Factor | Descripción |
|---|---|
| **Fecha de Inicio** | El equipo no puede ser procesado antes de su fecha de Inicio |
| **Código Plazo** | Determina qué procesos requiere y cuántos días ocupa cada uno |
| **Prioridad** | Cuando varios equipos compiten por un slot, el menor número va primero |
| **Capacidad diaria** | Cada proceso tiene un máximo de equipos simultáneos por día |
| **Secuencia de procesos** | Cada proceso debe completarse antes que el siguiente pueda iniciar |
| **Días especiales** | Sábados o feriados trabajables se incluyen como días hábiles normales |
| **Buffer de atraso** | Retrasa el inicio del tramo pendiente del equipo afectado |
| **Entregado** | Equipos marcados como entregados son excluidos automáticamente |

### 7.3 Equipos que NO participan en la planificación

Un equipo es excluido del motor si:

- No tiene **Fecha de Inicio** asignada.
- Está marcado como **Entregado**.
- No tiene **Código Plazo** asignado.
- No tiene **Prioridad** asignada.

### 7.4 Capacidades por proceso

Las capacidades se configuran en **Reglas → Capacidades por Proceso**. Los valores actuales son ajustables por el administrador. Ejemplo de estructura:

| Proceso | Capacidad máx. / día |
|---|---|
| INGENIERÍA | configurable |
| CORTE | configurable |
| PLEGADO | configurable |
| ARMADO | configurable |
| REMATE | configurable |
| MONTAJE | configurable |
| HIDRÁULICA | configurable |
| PINTURA | configurable |
| TERMINACIONES | configurable |
| CONTROL DE CALIDAD | configurable |

### 7.5 Resultado de la planificación

Después de ejecutar el motor, la sección **Motor de Planificación (CP-SAT)** muestra la tabla de resultados ordenada por posición (prioridad):

| Columna | Descripción |
|---|---|
| **Posición** | Orden en la planificación (1 = más prioritario) |
| **OT** | Número de OT |
| **Cliente / Equipo** | Identificación del equipo |
| **Código Plazo** | Tipo de equipo planificado |
| **Prioridad** | Prioridad asignada |
| **Inicio** | Primer día hábil en que comienza |
| **Término** | Último día hábil en que concluye |

### 7.6 Restaurar planificación anterior

El sistema guarda la **versión inmediatamente anterior** a la activa. Si el botón "Restaurar anterior" está disponible, al presionarlo:

- La planificación anterior se convierte en la activa.
- La activa actual pasa a estado anterior.

### 7.7 Días especiales de trabajo

El sistema considera por defecto solo días hábiles de lunes a viernes. Los **Días Especiales de Trabajo** permiten agregar sábados, domingos o feriados al calendario.

| Tipo | Descripción |
|---|---|
| Fin de semana trabajable | Sábado o domingo que se trabaja |
| Feriado trabajable | Día feriado que se trabaja |
| Día extra | Cualquier otro día adicional |

**Importante:**

- Los días especiales deben registrarse **antes** de ejecutar el planificador.
- Una vez usados en una planificación activa, no se pueden eliminar hasta que esa planificación sea reemplazada.

### 7.8 Cuándo replanificar

| Evento | ¿Replanificar? |
|---|---|
| Se ingresa un nuevo equipo | Sí |
| Cambia la prioridad de un equipo | Sí |
| Se registra un buffer de atraso | Sí |
| Se agrega un día especial de trabajo | Sí |
| Se elimina un equipo | Sí |
| Se marca un equipo como Entregado | Sí |
| Se actualiza solo datos referenciales (color, VIN, etc.) | No es necesario |

---

## 8. Exportación Excel

### 8.1 Cómo descargar

El botón **"Descargar Excel"** disponible en la pantalla principal genera y descarga un archivo `.xlsx` con la planificación completa.

El archivo está disponible para cualquier usuario autenticado, en cualquier momento.

### 8.2 Estructura del archivo

El archivo Excel contiene **cuatro hojas**:

---

#### Hoja 1 — Registros

**Propósito:** Tabla con todos los equipos registrados en el sistema y sus datos completos.

**Columnas:**

| Columna | Descripción |
|---|---|
| OT | Número de OT |
| Cliente Interno | Área interna |
| Cliente | Cliente externo |
| Código Plazo | Tipo de equipo |
| Equipo | Descripción del equipo |
| Modelo/Capacidad | Capacidad |
| Camión / Modelo / VIN | Datos del vehículo |
| Llegada | Fecha referencial de llegada |
| Inicio | Fecha de inicio para planificación |
| Fecha Entrega | Fecha estimada (desde planificación activa) o fecha real si está entregado |
| Venta / Color / OC / Factura | Datos comerciales |
| Patente / N° Recepción / Color Cabina / Neumático Repuesto | Datos físicos |
| Cotización | Sí / No |
| Entregado | Sí / No |
| Prioridad | Número de prioridad |
| Atraso (días) | Buffer actual |

**Colores:** Las filas de equipos con **Entregado = SÍ** se destacan en amarillo.

---

#### Hoja 2 — Planificación Óptima (Gantt activo)

**Propósito:** Gráfico de Gantt visual. Muestra qué equipo está en qué proceso cada día hábil dentro del período de la planificación activa.

**Estructura:**

- Las primeras columnas contienen datos del equipo: código plazo, OT, cliente interno, cliente, equipo, modelo, prioridad.
- Las columnas restantes representan cada día hábil del período.
- Cada celda con color indica el proceso activo ese día para ese equipo.
- Los días especiales de trabajo aparecen como columnas adicionales con el nombre del día.

**Código de colores por proceso:**

| Proceso | Color |
|---|---|
| INGENIERÍA | Amarillo claro |
| CORTE | Amarillo pálido |
| PLEGADO | Lavanda |
| ARMADO | Violeta suave |
| REMATE | Rosa suave |
| MONTAJE | Azul cielo |
| HIDRÁULICA | Azul claro |
| PINTURA | Azul medio |
| TERMINACIONES | Verde menta |
| CONTROL DE CALIDAD | Verde |

**Uso:** Presentación ejecutiva, seguimiento visual del taller, identificación de cuellos de botella.

---

#### Hoja 3 — Detalle por Proceso

**Propósito:** Vista desagregada de cada equipo por proceso individual.

**Columnas:**

| Columna | Descripción |
|---|---|
| OT | Número de OT |
| Cliente | Cliente externo |
| Código Plazo | Tipo de equipo |
| Proceso | Nombre del proceso |
| Orden | Secuencia del proceso |
| Slot | Puesto dentro del proceso (ej: 1, 2) |
| Proceso+Slot | Etiqueta compuesta (ej: PINT1, PINT2) |
| Inicio | Fecha de inicio del proceso |
| Fin | Fecha de término del proceso |
| Duración | Días hábiles que ocupa |
| Prioridad | Prioridad del equipo |

**Uso:** Análisis operativo, verificación de secuencias, resolución de conflictos de capacidad.

---

#### Hoja 4 — Planificación Óptima Anterior

**Propósito:** Gantt de la planificación inmediatamente anterior a la activa, con el mismo formato que la Hoja 2.

**Uso:** Comparar la planificación actual contra la versión previa para identificar cambios en fechas de entrega, impacto de nuevos ingresos o efecto de buffers registrados.

| Si la fecha de término del equipo… | Interpretación |
|---|---|
| Es igual en ambas versiones | El equipo no se vio afectado |
| Es más tardía en la versión nueva | El equipo se atrasó |
| Es más temprana en la versión nueva | El equipo adelantó |

---

## 9. Estadísticas

> Sección disponible solo para **administradores**.
> Ruta: `/admin/estadisticas`

### 9.1 ¿Qué muestra?

La página de Estadísticas analiza los **eventos de atraso**: ajustes de buffer donde el nuevo valor es **menor** que el anterior (delta negativo). Cada uno de esos ajustes se considera un evento de atraso.

### 9.2 Filtro de fechas

Permite restringir el análisis a un rango específico (Desde / Hasta). Al aplicar un filtro, todos los paneles — totales, gráfico y detalle — se actualizan en tiempo real.

### 9.3 Panel "Atrasos por Proceso"

Tabla resumen que muestra el **total acumulado de eventos de atraso** por proceso para el período filtrado.

El proceso se determina automáticamente según en qué etapa de la planificación activa se encontraba el equipo en la fecha del ajuste.

### 9.4 Gráfico "Evolución de Atrasos por Proceso"

Gráfico de líneas que muestra cómo evolucionaron los eventos de atraso a lo largo del tiempo, separados por proceso. Al pasar el cursor sobre el gráfico, un tooltip muestra los valores de ese día específico.

### 9.5 Tabla "Detalle de Eventos"

Tabla con cada evento de atraso individual. Todas las columnas son **ordenables** haciendo clic en el encabezado (flecha **↑** ascendente, **↓** descendente).

| Columna | Descripción |
|---|---|
| **Fecha** | Fecha en que se registró el ajuste de buffer |
| **OT** | Orden de Trabajo afectada |
| **Proceso** | Proceso en que se encontraba el equipo ese día |
| **Buffer nuevo** | Valor del buffer después del ajuste |
| **Buffer anterior** | Valor del buffer antes del ajuste |
| **Delta** | Diferencia: Buffer nuevo − Buffer anterior (siempre negativo aquí) |
| **Nota** | Nota ingresada al registrar el buffer. Muestra "—" si no hay nota |

### 9.6 Significado del Delta

El Delta indica cuántos días hábiles empeoró la situación del equipo en ese ajuste específico.

Ejemplo: Si el buffer pasó de –2 a –6, el Delta es –4 (el equipo se atrasó 4 días hábiles adicionales ese día).

---

## 10. Reglas del Sistema

> Sección disponible solo para **administradores**.
> Ruta: `/admin/reglas`

### 10.1 Capacidades por Proceso

Define cuántos equipos pueden estar simultáneamente en cada proceso cada día hábil. El administrador puede crear, editar y eliminar capacidades.

| Campo | Descripción |
|---|---|
| **Proceso** | Nombre del proceso (ej: PINTURA) |
| **Orden** | Posición en la secuencia de producción |
| **Capacidad por día** | Máximo de equipos simultáneos |

> Si la capacidad de un proceso cambia (nuevo operario, cambio de turno), actualizar este parámetro **antes** de la próxima planificación.

### 10.2 Tiempos por Código Plazo

Define cuántos días hábiles ocupa cada proceso para cada tipo de equipo (Código Plazo).

| Campo | Descripción |
|---|---|
| **Código Plazo** | Identificador del tipo de equipo |
| **Descripción equipo** | Nombre descriptivo (opcional) |
| **Proceso** | Nombre del proceso |
| **Duración (días)** | Días hábiles que ocupa ese proceso para ese equipo |

> Para agregar un tipo de equipo nuevo, crear un registro por cada proceso que requiera, con el mismo Código Plazo.

---

## 11. Gestión de Usuarios

> Sección disponible solo para **administradores**.
> Ruta: `/admin/usuarios`

### 11.1 Panel de usuarios

Muestra todos los usuarios registrados en el sistema con las siguientes columnas:

| Columna | Descripción |
|---|---|
| **Nombre** | Nombre del usuario |
| **Correo** | Dirección de correo electrónico |
| **Dominio** | Dominio corporativo del correo |
| **Rol** | `user` o `admin` |
| **Estado** | Activo / Inactivo |
| **Creado** | Fecha de creación de la cuenta |
| **Acciones** | Activar / desactivar, restablecer contraseña |

### 11.2 Activar / Desactivar usuarios

Un usuario desactivado no puede iniciar sesión aunque sus credenciales sean correctas. Recibe el mensaje "Cuenta desactivada. Contacta al administrador."

### 11.3 Roles

| Rol | Permisos |
|---|---|
| **user** | Ver registros, crear, editar, descargar Excel |
| **admin** | Todo lo anterior + planificar, reglas, usuarios, estadísticas |

La asignación de rol **admin** se controla por la variable de entorno `ADMIN_EMAILS` configurada por el equipo técnico.

### 11.4 Restablecer contraseña

El administrador puede generar una contraseña temporal para el usuario desde el panel de Usuarios.

---

## 12. Buenas Prácticas

### 12.1 Ingreso de datos

| Práctica | Por qué importa |
|---|---|
| Registrar el equipo con Fecha de Inicio real | Sin Inicio, el equipo es excluido del motor |
| Asignar Código Plazo correcto desde el inicio | Un código incorrecto genera fechas de entrega erróneas |
| Asignar prioridades únicas y diferenciadas | Evita empates que reducen la efectividad del ordenamiento |
| Registrar días especiales antes de planificar | Si se agregan después, no afectan la planificación activa |
| Marcar equipos entregados apenas se confirme | Libera capacidad en el motor para equipos activos |

### 12.2 Gestión de buffers

| Práctica | Por qué importa |
|---|---|
| Registrar buffer solo cuando hay atraso real y cuantificable | Los buffers incorrectos distorsionan la planificación |
| Siempre agregar una nota explicativa | Facilita el seguimiento posterior y la auditoría en Estadísticas |
| Replanificar inmediatamente después de registrar el buffer | El buffer no tiene efecto hasta que se ejecuta el motor |
| Remover el buffer cuando el atraso se resuelve | Evitar que el equipo quede permanentemente "atrasado" |

### 12.3 Ciclo de planificación

| Acción | Frecuencia recomendada |
|---|---|
| Revisar y actualizar prioridades | Semanal |
| Ejecutar planificación | Semanal o ante cualquier cambio significativo |
| Descargar y distribuir Excel | Después de cada planificación |
| Revisar estadísticas de atrasos | Mensual o ante acumulación de eventos |

### 12.4 Calidad de datos

> El motor entrega resultados tan buenos como los datos que recibe.

| Dato incorrecto | Impacto |
|---|---|
| Fecha de Inicio incorrecta | El equipo se planifica en la fecha equivocada |
| Código Plazo incorrecto | Tiempos de proceso erróneos → fecha de entrega incorrecta |
| Prioridad desactualizada | La secuencia no refleja las urgencias reales |
| Buffer sin base real | La planificación pierde precisión para ese equipo y los que compiten con él |

---

## 13. Solución de Problemas Frecuentes

| Síntoma | Causa probable | Solución |
|---|---|---|
| El equipo no aparece en la planificación | Falta Código Plazo, Inicio o Prioridad | Verificar los tres campos y volver a planificar |
| El equipo marcado como Entregado sigue en el Gantt | Se planificó antes de marcarlo | Ejecutar nueva planificación |
| La fecha de entrega no cambia después de modificar prioridad | No se ejecutó el motor después del cambio | Presionar "Planificar" |
| El buffer no tiene efecto | Se registró pero no se replanificó | Ejecutar el motor después de guardar el buffer |
| Un día especial no aparece en el Excel | Se registró después de la última planificación | Replanificar con el día especial ya registrado |
| No puedo iniciar sesión | Correo de dominio no permitido o cuenta desactivada | Verificar dominio o contactar al administrador |
| El motor tarda más de lo normal | Muchos equipos activos en el sistema | Esperar — el motor puede tardar hasta 2 minutos |
| "El planificador falló" al ejecutar | Error de conexión con el servicio Railway | Reintentar en unos minutos o contactar al equipo técnico |

---

## 14. Preguntas Frecuentes

**1. ¿Qué pasa si cambio la prioridad de un equipo?**

El cambio no tiene efecto inmediato. Después de cambiar la prioridad, ejecutar **"Planificar"** para generar una nueva versión con la prioridad actualizada.

---

**2. ¿Cuál es la diferencia entre Llegada e Inicio?**

- **Llegada** es un campo informativo — referencia histórica de cuándo llegó el equipo al taller. No controla la planificación.
- **Inicio** es el campo que el motor usa para saber desde cuándo puede trabajar el equipo. Sin Inicio, el equipo queda excluido.

---

**3. ¿Qué pasa si agrego un buffer de –5 días?**

Al planificar, el motor identifica qué procesos del equipo ya deberían estar completados al día en que se registró el buffer. Esos procesos se respetan. El primer proceso pendiente no puede iniciar hasta 5 días hábiles después de la fecha del buffer.

---

**4. ¿Por qué el Excel no refleja los últimos cambios?**

El Excel se genera bajo demanda. Presionar **"Descargar Excel"** después de la última planificación para obtener el archivo actualizado.

---

**5. ¿Cómo sé si el atraso se incorporó correctamente?**

Después de planificar, verificar en la columna **Entrega Estimada**. Si el valor cambió respecto a la planificación anterior y el badge aparece como **Atrasado**, el buffer fue procesado. El historial de entregas estimadas (clic en el badge) muestra la evolución.

---

**6. ¿Qué significa "Planificación activa v30"?**

La versión es un contador que aumenta cada vez que se ejecuta el planificador. La versión activa es la que se muestra en resultados y en el Excel.

---

**7. ¿El sistema considera feriados nacionales?**

No automáticamente. El calendario base es lunes a viernes. Los feriados que caen en días hábiles (lunes a viernes) son tratados como días normales por el motor. Si ese día NO se trabaja, no hay acción requerida — simplemente la producción real no avanzará. Si SÍ se trabaja en ese feriado, registrarlo como **Día Especial de Trabajo** antes de planificar.

---

**8. ¿Cuántos equipos puede manejar el sistema?**

No hay un límite predefinido. La planificación puede manejar decenas de OTs simultáneas. El tiempo de cálculo aumenta levemente con más equipos pero permanece dentro de rangos aceptables.

---

**9. ¿Qué ocurre si dos equipos tienen la misma prioridad?**

El motor usa como criterio de desempate la **Fecha de Inicio** (el que llegó antes va primero). Si también coinciden, usa el identificador interno del registro.

---

**10. ¿Puedo editar los tiempos de proceso de un tipo de equipo?**

Sí, pero solo los administradores pueden hacerlo desde **Reglas → Tiempos por Código Plazo**. Después de modificar los tiempos, replanificar para que los cambios tengan efecto.

---

**11. ¿Por qué la nota del buffer no aparece en Estadísticas?**

Solo aparecen en Estadísticas los ajustes de buffer donde el nuevo valor es **menor** que el anterior (delta negativo). Si el buffer se mantuvo igual o mejoró, no genera un evento estadístico.

---

**12. ¿Qué pasa si elimino un equipo del historial?**

El equipo desaparece del sistema. La próxima planificación no lo considerará. Los slots que habría ocupado quedan disponibles para otros equipos. La eliminación es permanente.

---

*Documento generado para ETP Spa — Sistema de Planificación de Maestranza*
*Para soporte técnico o modificaciones al sistema, contactar al administrador.*

---
