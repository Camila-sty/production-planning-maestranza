---

# MANUAL DE USUARIO

## Sistema de Planificación de Maestranza

### ETP Spa — Plataforma Digital de Gestión de Producción

---

**Versión:** 1.0
**Fecha de emisión:** Junio 2026
**Destinatario:** Equipo Operativo y de Gestión — ETP Spa
**Confidencial:** Uso interno

---

---

## ÍNDICE

1. [Introducción](#1-introducción)
2. [Flujo General de Trabajo](#2-flujo-general-de-trabajo)
3. [Sección "Nuevo Registro"](#3-sección-nuevo-registro)
4. [Sección "Historial de Planificación"](#4-sección-historial-de-planificación)
5. [Gestión de Prioridades](#5-gestión-de-prioridades)
6. [Gestión de Atrasos — Buffer](#6-gestión-de-atrasos--buffer)
7. [Días Especiales de Trabajo](#7-días-especiales-de-trabajo)
8. [Motor de Planificación](#8-motor-de-planificación)
9. [Resultados de la Planificación](#9-resultados-de-la-planificación)
10. [Descarga Excel](#10-descarga-excel)
11. [Buenas Prácticas](#11-buenas-prácticas)
12. [Limitaciones y Consideraciones](#12-limitaciones-y-consideraciones)
13. [Preguntas Frecuentes](#13-preguntas-frecuentes)
14. [Conclusiones](#14-conclusiones)

---

---

## 1. Introducción

### 1.1 Objetivo de la plataforma

El **Sistema de Planificación de Maestranza de ETP Spa** es una plataforma digital diseñada para organizar, secuenciar y optimizar el trabajo productivo del taller. Permite registrar los equipos en proceso de fabricación, asignarles prioridad y generar automáticamente un calendario de producción que distribuye la carga de trabajo según la capacidad real de cada proceso.

### 1.2 Qué problema resuelve

En un taller de maestranza con múltiples equipos en producción simultánea, coordinar qué equipo pasa por qué proceso y en qué orden es una tarea compleja. Sin una herramienta dedicada, los criterios de asignación son informales, difíciles de comunicar y propensos a errores.

Este sistema resuelve tres problemas centrales:

| Problema | Solución que ofrece la plataforma |
|---|---|
| No hay visibilidad de fechas de entrega | Calcula y muestra la entrega estimada de cada equipo |
| Los recursos se asignan sin criterio formal | Usa prioridad, fecha de llegada y capacidad para secuenciar |
| No existe trazabilidad histórica | Guarda el historial de cada planificación ejecutada |
| Los atrasos no se reflejan formalmente | Permite registrar buffers de retraso sobre equipos específicos |

### 1.3 Beneficios principales

- **Visibilidad total:** fecha de inicio y término estimados para cada equipo en taller.
- **Planificación basada en datos:** las decisiones se toman con criterios objetivos y reproducibles.
- **Historial auditado:** cada planificación queda registrada, permitiendo comparar versiones.
- **Gestión de imprevistos:** los atrasos y días especiales se incorporan al cálculo sin necesidad de recalcular manualmente.
- **Descarga ejecutiva:** planilla Excel lista para compartir con clientes y jefes de producción.

---

---

## 2. Flujo General de Trabajo

### 2.1 Visión de proceso

La plataforma está diseñada para seguir un flujo natural de operaciones. Se recomienda respetar este orden para obtener resultados correctos:

```
┌─────────────────────────┐
│   1. Registrar equipos  │  ← Ingresar cada OT con sus datos
└────────────┬────────────┘
             ↓
┌─────────────────────────┐
│  2. Asignar prioridades │  ← Definir orden de importancia
└────────────┬────────────┘
             ↓
┌─────────────────────────┐
│  3. Días especiales     │  ← Registrar sábados/feriados trabajables
└────────────┬────────────┘
             ↓
┌─────────────────────────┐
│  4. Ejecutar planner    │  ← Presionar "Planificar"
└────────────┬────────────┘
             ↓
┌─────────────────────────┐
│  5. Revisar resultados  │  ← Validar fechas y secuencias
└────────────┬────────────┘
             ↓
┌─────────────────────────┐
│  6. Descargar Excel     │  ← Exportar para distribución
└────────────┬────────────┘
             ↓
┌─────────────────────────┐
│  7. Gestionar atrasos   │  ← Registrar desvíos y replanificar
└─────────────────────────┘
```

### 2.2 Descripción de cada etapa

| Etapa | Quién la ejecuta | Frecuencia |
|---|---|---|
| Registrar equipos | Jefe de taller / Administrador | Al ingreso de cada OT |
| Asignar prioridades | Jefe de producción | Al registrar o cuando cambia la urgencia |
| Registrar días especiales | Administrador | Cuando se decide trabajar fuera del horario estándar |
| Ejecutar planificación | Administrador | Cada vez que haya cambios relevantes |
| Revisar resultados | Jefe de producción | Después de cada planificación |
| Descargar Excel | Cualquier usuario | Bajo demanda |
| Gestionar atrasos | Jefe de producción | Cuando un equipo presenta retraso real |

---

---

## 3. Sección "Nuevo Registro"

### 3.1 Propósito

Esta sección permite ingresar un nuevo equipo al sistema. Cada equipo ingresado corresponde a una **Orden de Trabajo (OT)** que será considerada en la próxima planificación.

### 3.2 Campos del formulario

#### Campos de identificación

| Campo | Descripción | Obligatorio | Impacto en planificación |
|---|---|---|---|
| **OT** | Número de Orden de Trabajo | ✅ Sí | Identificador único. Aparece en todos los reportes |
| **Cliente Interno** | Área interna solicitante | No | Solo referencial |
| **Cliente** | Nombre del cliente externo | No | Aparece en Excel y reportes |
| **Cotización** | Indica si el equipo está en cotización | No | Solo referencial |
| **Correo** | Email de contacto del cliente | No | Solo referencial |

#### Campos del equipo

| Campo | Descripción | Obligatorio | Impacto en planificación |
|---|---|---|---|
| **Equipo** | Nombre o tipo de equipo a fabricar | No | Aparece en Excel |
| **Modelo** | Modelo específico del equipo | No | Aparece en Excel |
| **Modelo/Capacidad** | Descripción de capacidad (ej: 20 m³) | No | Solo referencial |
| **Camión** | Marca o tipo de camión asociado | No | Solo referencial |
| **VIN** | Número de chasis del vehículo | No | Solo referencial |
| **Patente** | Patente del vehículo | No | Solo referencial |
| **N° Recepción** | Número interno de recepción | No | Solo referencial |
| **Color equipo / Cabina** | Especificaciones de color | No | Solo referencial |
| **Neumático de repuesto** | Dato de neumático | No | Solo referencial |

#### Campos críticos para la planificación

> ⚠️ **Atención:** Los siguientes campos son los más importantes del formulario. Sin ellos, el equipo no puede ser planificado.

| Campo | Descripción | Obligatorio | Impacto |
|---|---|---|---|
| **Código Plazo** | Define el tipo de equipo y sus tiempos de proceso | ✅ Sí | **Directo:** determina cuántos días toma cada proceso |
| **Fecha de Llegada** | Fecha en que el equipo llega o ingresa al taller | ✅ Sí | **Directo:** el equipo no puede iniciar antes de esta fecha |
| **Prioridad** | Número que define el orden de atención | ✅ Sí | **Directo:** determina quién va primero cuando hay competencia |

#### Campos comerciales

| Campo | Descripción |
|---|---|
| **OC** | Número de Orden de Compra del cliente |
| **Factura** | Número de factura asociada |
| **Venta** | Monto o referencia de venta |
| **Próximo a Entrega** | Indica si el equipo está en etapa final |

### 3.3 El campo Código Plazo — clave de la planificación

El **Código Plazo** es el campo más importante para la planificación. Cada código corresponde a un tipo de equipo y define internamente cuántos días hábiles requiere cada proceso de fabricación.

Los códigos disponibles en el sistema son:

| Código | Tipo de equipo |
|---|---|
| 1 | Aljibe 10 m³ |
| 2 | Aljibes 15–30 m³ |
| 3 | Alzahombre |
| 4 | Atmosférico básico |
| 5 | Atmosférico full |
| 6 | Carrocería |
| 7 | Clínicas |
| 8 | Combustible básico |
| 9 | Combustible alto flujo |
| 10 | Combustible med. flujo |
| 11 | Compactador |
| 12 | Lubricador cerrado |
| 13 | Lubricador chico y abierto |
| 14 | Lubricador mediano y abierto |
| 15 | Polibrazo |
| 16 | Tolvas 15–25 m³ mineras |
| 17 | Tolvas 4–15 m³ áridos |

> 💡 Si el código plazo no está disponible o corresponde a un equipo nuevo, contactar al administrador del sistema para registrar los tiempos correspondientes.

### 3.4 Recomendaciones de ingreso

- Registrar el equipo **el mismo día que llega al taller**, o ingresarlo con anticipación usando la fecha real de llegada esperada.
- El campo **Prioridad** debe asignarse con criterio desde el momento del ingreso. Evitar dejarla en blanco o asignar la misma prioridad a todos los equipos.
- El campo **Código Plazo** debe corresponder exactamente al tipo de equipo. Un código incorrecto generará fechas de entrega erróneas.
- Usar el campo **Próximo a Entrega** para marcar equipos en etapa final, aunque este campo no afecta directamente el cálculo.

---

---

## 4. Sección "Historial de Planificación"

### 4.1 Propósito

El Historial de Planificación es la vista central de la plataforma. Muestra todos los equipos registrados junto con su información de seguimiento, estado y fechas estimadas de entrega calculadas por el motor.

### 4.2 Cómo buscar registros

La sección cuenta con tres herramientas de filtrado que pueden combinarse:

| Herramienta | Cómo usarla |
|---|---|
| **Buscador de texto** | Escribir cualquier parte del número OT, nombre del cliente, equipo, VIN o patente |
| **Filtro Llegada** | Filtrar registros según si tienen o no fecha de llegada ingresada |
| **Filtro Estado** | Mostrar solo equipos "Al día" o solo equipos "Atrasado" |

**Ejemplo de uso combinado:**

> Buscar `"SALFA"` + Estado = `"Al día"` → mostrará solo los equipos del cliente SALFA que están al día en su planificación.

> Buscar `"2455"` + Estado = `"Atrasado"` → mostrará la OT 2455 si tiene un atraso registrado.

### 4.3 Columnas de la tabla

| Columna | Descripción |
|---|---|
| **OT** | Número de Orden de Trabajo |
| **Cliente Interno** | Área interna responsable |
| **Cliente** | Cliente externo |
| **Código Plazo** | Tipo de equipo |
| **Equipo / Modelo** | Descripción del equipo |
| **Llegada** | Fecha de ingreso al taller |
| **Entrega Estimada** | Fecha de término calculada por el motor |
| **Prioridad** | Nivel de prioridad asignado |
| **Buffer** | Días de atraso registrados (negativo = retraso) |
| **Estado** | Al día / Atrasado |
| **Acciones** | Editar, eliminar, gestionar buffer |

### 4.4 Estados: Al día y Atrasado

| Estado | Criterio | Significado |
|---|---|---|
| 🟢 **Al día** | No tiene buffer negativo | El equipo sigue el ritmo de planificación esperado |
| 🔴 **Atrasado** | Tiene buffer negativo registrado | Se ha notificado formalmente un retraso en este equipo |

> El estado **Atrasado** no se asigna automáticamente por el sistema al comparar fechas reales. Es un registro **manual e intencional** que el jefe de producción realiza para comunicar al motor que un equipo específico tiene un desvío real.

### 4.5 Historial de Entregas Estimadas

Al hacer clic sobre el badge **Atrasado** de un equipo, se despliega un panel con el historial de fechas de entrega estimadas a lo largo del tiempo.

#### ¿Qué muestra este historial?

| Columna | Significado |
|---|---|
| **Modificación** | Fecha en que se ejecutó esa planificación |
| **Entrega Estimada** | Fecha de término que calculó el motor en esa planificación |

#### ¿Cómo se genera un nuevo registro?

Cada vez que se ejecuta el planificador ("Planificar"), el sistema genera una nueva versión de la planificación. La fecha de entrega estimada de cada equipo puede cambiar entre versiones, y el historial acumula esas variaciones.

#### ¿Cómo interpretar el historial?

```
Modificación   Entrega Estimada
─────────────  ─────────────────
03-06-2026     12-06-2026        ← Planificación sin atraso
03-06-2026     17-06-2026  ★     ← Planificación activa (con buffer -4)
```

La fila destacada en **amarillo** corresponde a la planificación activa actual. Las filas anteriores muestran el historial de cómo fue cambiando la fecha estimada.

> 💡 Si la entrega estimada se desplazó hacia adelante con el tiempo, indica que el equipo acumuló retrasos o la competencia por recursos aumentó. Si se mantuvo igual o mejoró, la producción avanza según lo planificado.

---

---

## 5. Gestión de Prioridades

### 5.1 ¿Qué es la prioridad?

La prioridad es un número entero positivo que determina el **orden en que los equipos acceden a los recursos del taller** cuando dos o más equipos compiten por el mismo proceso en el mismo día.

### 5.2 Escala de prioridades

| Valor | Significado |
|---|---|
| **P1** | Máxima urgencia — el equipo se atiende primero ante cualquier conflicto |
| **P2 – P5** | Alta prioridad |
| **P6 – P15** | Prioridad media |
| **P16 – P30+** | Prioridad baja — se atiende cuando hay capacidad disponible |

> ⚠️ **Regla fundamental:** Un número **más bajo** = **mayor prioridad**. P1 es más urgente que P10.

### 5.3 Cómo afecta la prioridad al motor

Cuando el motor de planificación evalúa un día hábil, para cada proceso disponible identifica todos los equipos que:

1. Han llegado al taller.
2. Tienen ese proceso como siguiente paso pendiente.
3. Han completado el proceso anterior.

Si hay más equipos elegibles que capacidad disponible, el motor **asigna los slots disponibles en orden de prioridad ascendente** (P1 primero, luego P2, etc.).

### 5.4 Ejemplo práctico

> **Situación:** El proceso PINTURA tiene capacidad para 2 equipos por día. En el día evaluado hay 4 equipos listos para pintura:

| Equipo | OT | Prioridad | ¿Entra ese día? |
|---|---|---|---|
| Aljibe 20 m³ | 2372 | P5 | ✅ Sí (1° slot) |
| Lubricador | 2411 | P8 | ✅ Sí (2° slot) |
| Alzahombre | 2412 | P14 | ❌ Espera al día siguiente |
| Carrocería | 2455 | P26 | ❌ Espera al día siguiente |

> Los equipos 2412 y 2455 no entran ese día, pero tampoco bloquean a los de mayor prioridad. Al día siguiente vuelven a ser considerados.

### 5.5 Desempate

Cuando dos equipos tienen la misma prioridad, el motor utiliza los siguientes criterios de desempate en orden:

1. **Fecha de llegada** (llegó antes → va primero)
2. **Identificador interno** (criterio técnico de consistencia)

### 5.6 Recomendaciones

- Revisar y actualizar las prioridades **antes de ejecutar cada planificación**.
- Evitar asignar el mismo número de prioridad a muchos equipos — esto reduce la efectividad del ordenamiento.
- Los equipos con compromisos de entrega inminentes deben tener prioridad **1 o 2**.
- Las prioridades pueden cambiarse en cualquier momento desde el historial.

---

---

## 6. Gestión de Atrasos — Buffer

### 6.1 ¿Qué es un buffer?

Un **buffer** es un ajuste manual que el jefe de producción aplica sobre un equipo específico para comunicarle al motor que ese equipo tiene un **desvío real respecto a lo planificado**.

El buffer se expresa en **días hábiles** con signo:

| Valor | Significado |
|---|---|
| **Negativo (–n)** | El equipo tiene un atraso de n días hábiles |
| **Cero (0)** | Sin ajuste |
| **Positivo (+n)** | El equipo podría adelantarse n días hábiles (uso menos frecuente) |

> En la práctica operativa, el uso más común es el **buffer negativo**, que representa un atraso concreto detectado en terreno.

### 6.2 ¿Cuándo usar un buffer?

| Situación | Acción recomendada |
|---|---|
| Un proveedor de materiales retrasó la entrega | Buffer –n (días de retraso esperado) |
| El equipo fue detenido por inspección no prevista | Buffer –n |
| La cabina llegó con daños y requiere reparación adicional | Buffer –n |
| El equipo avanza más rápido de lo planificado | Buffer +n (opcional) |

> ⚠️ **No usar buffer como ajuste cosmético.** Solo debe registrarse cuando existe un retraso real y cuantificable. Usar buffers incorrectos contamina la planificación.

### 6.3 Cómo funciona el buffer negativo — lógica actual

Esta es la parte más importante de entender correctamente:

> **El atraso se aplica desde el estado actual del equipo, no desde su fecha de llegada.**

#### ¿Qué significa esto?

Cuando se registra un buffer de –4 días hábiles el **03-06-2026** para un equipo que llegó el **04-05-2026**:

1. El motor determina qué procesos ya debería haber completado ese equipo al **03-06-2026** (fecha del buffer).
2. Esos procesos completados se respetan — **no se reprograman**.
3. A partir del **primer proceso pendiente al 03-06-2026**, se aplica un retraso de 4 días hábiles.
4. El equipo puede reanudar su siguiente proceso solo después del **09-06-2026** (03-jun + 4 días hábiles).

#### Ejemplo concreto — OT 2455

| Proceso | Estado al 03-06 | Resultado |
|---|---|---|
| INGENIERÍA | ✅ Completado (04-may al 05-may) | Se respeta |
| CORTE | ✅ Completado | Se respeta |
| PLEGADO | ✅ Completado | Se respeta |
| ARMADO | ✅ Completado | Se respeta |
| REMATE | ✅ Completado | Se respeta |
| MONTAJE | ✅ Completado | Se respeta |
| HIDRÁULICA | ✅ Completado (hasta 02-jun) | Se respeta |
| **PINTURA** | 🔄 Pendiente al 03-jun | **Aplica delay → no antes de 09-jun** |
| TERMINACIONES | Pendiente | Sigue naturalmente |
| CONTROL DE CALIDAD | Pendiente | Sigue naturalmente |

**Resultado:**
- Sin buffer: entrega estimada **12-06-2026**
- Con buffer –4: entrega estimada **17-06-2026** ✅

#### ¿Por qué es importante esta lógica?

Evita que el motor interprete el buffer como "el equipo no ha hecho nada hasta ahora" y recalcule todo desde cero. Solo el tramo pendiente se ve afectado, lo que produce una estimación **realista y precisa**.

### 6.4 Cómo registrar un buffer

1. En el Historial de Planificación, localizar el equipo.
2. En la columna de acciones, hacer clic en el ícono de ajuste (buffer).
3. Ingresar el valor numérico (negativo para atraso).
4. Opcionalmente, agregar una nota descriptiva.
5. Guardar y luego **ejecutar una nueva planificación**.

> ⚠️ El buffer **no tiene efecto** hasta que se ejecute el planificador. Registrar el buffer y planificar son dos pasos separados.

### 6.5 Cómo eliminar un buffer

Para remover un atraso registrado anteriormente:
- Editar el buffer del equipo y establecerlo en **0** o dejarlo vacío.
- Ejecutar una nueva planificación.

---

---

## 7. Días Especiales de Trabajo

### 7.1 Propósito

El sistema considera por defecto solo los **días hábiles de lunes a viernes**. Sin embargo, en ciertos momentos del año o por acuerdo operativo, el taller puede trabajar en días normalmente no hábiles: sábados, domingos o feriados.

Los **Días Especiales de Trabajo** permiten informarle al motor que ciertos días deben incluirse en el calendario de planificación.

### 7.2 Tipos disponibles

| Tipo | Descripción |
|---|---|
| **Fin de semana trabajable** | Un sábado o domingo que se trabaja excepcionalmente |
| **Feriado trabajable** | Un día feriado que se trabaja |
| **Día extra** | Cualquier otro día fuera del calendario estándar |

### 7.3 Columnas de la tabla

| Columna | Descripción |
|---|---|
| **Fecha de registro** | Día en que el administrador ingresó el día especial al sistema |
| **Fecha extra** | Fecha del día hábil adicional que se va a trabajar |
| **Tipo** | Categoría del día especial |
| **Descripción** | Nota opcional (ej: "Sábado de emergencia cliente X") |
| **Estado** | Pendiente / Usado en planificación |

### 7.4 Estados de un día especial

| Estado | Significado |
|---|---|
| 🟡 **Pendiente** | El día fue registrado pero aún no se ha planificado con él |
| 🟢 **Usado en planificación** | El motor lo incorporó en la última planificación activa |

### 7.5 Flujo de uso recomendado

```
1. El jefe de producción decide trabajar el sábado 14-06
        ↓
2. El administrador registra 14-06 como "Fin de semana trabajable"
        ↓
3. Se ejecuta el planificador
        ↓
4. El motor incluye el 14-06 en el calendario de días hábiles
        ↓
5. El día especial cambia a estado "Usado en planificación"
        ↓
6. El Excel exportado muestra una columna para el 14-06
```

### 7.6 Consideraciones importantes

- Los días especiales deben registrarse **antes de ejecutar el planificador**. Si se registran después, no tendrán efecto en la planificación actual.
- Una vez que un día especial ha sido "Usado en planificación", **no puede eliminarse** mientras esa planificación esté activa. Esto protege la integridad de los resultados.
- El Excel Gantt refleja exactamente los mismos días que usó el motor, incluyendo los días especiales.

---

---

## 8. Motor de Planificación

### 8.1 ¿Qué es el motor?

El motor de planificación es el componente central del sistema. Al presionar el botón **"Planificar"**, el motor recorre todo el calendario laboral día a día y asigna el trabajo de cada equipo en cada proceso, respetando las restricciones de capacidad, prioridad y disponibilidad.

### 8.2 Qué considera el motor

| Factor | Descripción |
|---|---|
| **Fecha de llegada** | Un equipo no puede ser procesado antes de su fecha de ingreso al taller |
| **Código Plazo** | Determina los procesos que requiere el equipo y cuántos días toma cada uno |
| **Prioridad** | Cuando varios equipos compiten por un proceso, va primero el de menor número |
| **Capacidad diaria** | Cada proceso tiene una cantidad máxima de equipos simultáneos por día |
| **Secuencia de procesos** | Cada proceso debe completarse antes de que el siguiente pueda comenzar |
| **Días especiales** | Sábados o feriados trabajables se incluyen como días hábiles normales |
| **Buffer de atraso** | Retrasa el inicio del tramo pendiente de equipos con atraso registrado |

### 8.3 Capacidad por proceso

El taller tiene configuradas las siguientes capacidades máximas diarias:

| Proceso | Capacidad máx. por día | Observación |
|---|---|---|
| INGENIERÍA | 2 equipos | Proceso inicial de diseño y cálculo |
| CORTE | 3 equipos | Corte de materiales |
| PLEGADO | 2 equipos | Conformado de chapas |
| ARMADO | 2 equipos | Ensamble estructural |
| REMATE | 2 equipos | Acabado estructural |
| MONTAJE | 3 equipos | Montaje de componentes |
| HIDRÁULICA | 6 equipos | Instalación de sistemas hidráulicos |
| PINTURA | 2 equipos | Preparación y pintura |
| TERMINACIONES | 2 equipos | Acabados finales |
| CONTROL DE CALIDAD | 1 equipo | Inspección y liberación |

> 💡 La capacidad de HIDRÁULICA es la más alta (6 equipos) porque generalmente es el proceso de mayor duración y requiere mayor paralelismo. CONTROL DE CALIDAD, al ser crítico y unitario, es el cuello de botella final.

### 8.4 Cómo trabaja el motor día a día

El motor avanza día hábil por día hábil siguiendo este procedimiento en cada uno:

```
Para cada día hábil del calendario:
  Para cada proceso (en orden INGENIERÍA → CORTE → ... → CONTROL DE CALIDAD):
    1. Contar cuántos equipos ya están en ese proceso hoy
    2. Calcular los slots disponibles (capacidad - ocupados)
    3. Identificar equipos elegibles:
       - Llegaron al taller
       - Su proceso anterior ya terminó
       - No tienen restricción de buffer activa
    4. Ordenar elegibles por prioridad (menor número primero)
    5. Asignar los primeros N equipos (N = slots disponibles)
    6. No dejar capacidad ociosa si hay equipos esperando
```

### 8.5 Principios del motor

> **Ninguna capacidad se desperdicia:** si hay un equipo listo y hay un slot disponible, el motor lo asigna ese mismo día. No espera a un "mejor momento".

> **El motor no reserva recursos futuros:** un equipo de alta prioridad no puede bloquear anticipadamente un slot para el día siguiente. Solo compite el día que está listo.

> **La secuencia de procesos es estricta:** un equipo no puede iniciar PINTURA si TERMINACIONES aún no terminó. La cadena se respeta siempre.

### 8.6 ¿Cuándo replanificar?

Se recomienda ejecutar una nueva planificación cuando ocurra cualquiera de los siguientes eventos:

| Evento | ¿Replanificar? |
|---|---|
| Se ingresa un nuevo equipo | ✅ Sí |
| Cambia la prioridad de un equipo | ✅ Sí |
| Se registra un buffer de atraso | ✅ Sí |
| Se agrega un día especial de trabajo | ✅ Sí |
| Se elimina un equipo del sistema | ✅ Sí |
| Solo se actualizan datos referenciales (color, VIN, etc.) | ❌ No es necesario |

---

---

## 9. Resultados de la Planificación

### 9.1 Tabla de resultados

Después de ejecutar el planificador, la sección **"Motor CP-SAT / Planificación"** muestra la tabla de resultados ordenada por prioridad. Esta tabla refleja el estado activo de la planificación.

### 9.2 Columnas de resultados

| Columna | Descripción |
|---|---|
| **Posición** | Orden en la planificación (1 = más prioritario) |
| **OT** | Número de Orden de Trabajo |
| **Cliente / Equipo** | Identificación del equipo |
| **Código Plazo** | Tipo de equipo planificado |
| **Prioridad** | Prioridad asignada |
| **Inicio** | Primer día hábil en que comienza el primer proceso |
| **Término** | Último día hábil en que concluye el último proceso |

### 9.3 Interpretación de resultados

- La **fecha de inicio** coincide con la fecha de llegada o con la primera oportunidad en que hay un slot disponible para el primer proceso del equipo.
- La **fecha de término** refleja el día en que finaliza el último proceso del equipo, considerando toda la cadena de fabricación.
- Un equipo puede tener un **inicio tardío** si todos los slots del primer proceso están ocupados por equipos de mayor prioridad cuando llega.

### 9.4 Planificación anterior

El sistema mantiene siempre la **versión anterior** de la planificación disponible para consulta y comparación, visible en la sección de resultados y en el Excel exportable.

---

---

## 10. Descarga Excel

### 10.1 Cómo descargar

Desde la pantalla principal, el botón **"Descargar Excel"** genera y descarga un archivo con la planificación completa en formato `.xlsx`, listo para distribución.

### 10.2 Hojas del archivo

El Excel contiene cuatro hojas:

---

#### 📋 Hoja 1 — Planificación

**Propósito:** Resumen tabular de todos los equipos en la planificación activa.

**Columnas incluidas:**

| Columna | Descripción |
|---|---|
| Posición | Orden de prioridad |
| OT | Número de OT |
| Cliente Interno | Área solicitante |
| Cliente | Cliente externo |
| Código Plazo | Tipo de equipo |
| Equipo | Descripción del equipo |
| Modelo/Capacidad | Capacidad del equipo |
| Camión / Modelo / VIN | Datos del vehículo |
| Llegada | Fecha de ingreso al taller |
| Inicio Planif. | Inicio calculado por el motor |
| Fin Planif. | Término calculado por el motor |
| Prioridad | Nivel de prioridad |
| Atraso (días) | Días de atraso registrados |
| Color / OC / Factura | Datos comerciales |

**Uso recomendado:** Compartir con dirección comercial o clientes para informar fechas estimadas.

---

#### 📊 Hoja 2 — Detalle por Proceso

**Propósito:** Vista desagregada de cada equipo por proceso individual.

**Columnas incluidas:**

| Columna | Descripción |
|---|---|
| OT | Número de OT |
| Cliente | Cliente externo |
| Código Plazo | Tipo de equipo |
| Proceso | Nombre del proceso |
| Orden | Secuencia del proceso |
| Slot | Puesto asignado dentro del proceso |
| Proceso+Slot | Etiqueta compuesta (ej: PINT1, PINT2) |
| Inicio / Fin | Fechas de inicio y término del proceso |
| Duración | Días hábiles que ocupa |
| Prioridad | Prioridad del equipo |

**Uso recomendado:** Análisis operativo, verificación de secuencias y resolución de conflictos de capacidad.

---

#### 📅 Hoja 3 — Planificación Óptima (Gantt activo)

**Propósito:** Gráfico de Gantt visual que muestra qué equipo está en qué proceso cada día hábil.

**Estructura:**
- Las **primeras 7 columnas** muestran información del equipo: código, OT, cliente interno, cliente, equipo, modelo y prioridad.
- Las **columnas restantes** representan cada día hábil dentro del rango de la planificación.
- Cada celda con color indica el proceso activo ese día para ese equipo.
- Los días especiales de trabajo aparecen como columnas adicionales (ej: SÁBADO 14-06-2026).

**Código de colores por proceso:**

| Proceso | Color |
|---|---|
| INGENIERÍA | Amarillo claro |
| CORTE | Amarillo pálido |
| PLEGADO | Lavanda |
| ARMADO | Violeta suave |
| MONTAJE | Azul cielo |
| HIDRÁULICA | Azul claro |
| PINTURA | Azul medio |
| TERMINACIONES | Verde menta |
| CONTROL DE CALIDAD | Verde |
| REMATE | Rosa suave |

**Uso recomendado:** Presentación ejecutiva, seguimiento visual del taller, identificación rápida de cuellos de botella.

---

#### 📅 Hoja 4 — Planificación Óptima Anterior

**Propósito:** Gantt de la planificación inmediatamente anterior a la activa.

**Uso recomendado:** Comparar la planificación actual contra la versión previa para identificar cambios en fechas de entrega, impacto de nuevos ingresos o efecto de los buffers registrados.

**Cómo comparar:**

| Si la fecha de término del equipo... | Interpretación |
|---|---|
| Es igual en ambas versiones | El equipo no se vio afectado por los cambios |
| Es más tardía en la versión nueva | El equipo se atrasó (nuevo ingreso de mayor prioridad, buffer, etc.) |
| Es más temprana en la versión nueva | El equipo avanzó (se liberó capacidad, cambió prioridad) |

---

---

## 11. Buenas Prácticas

### 11.1 Ingreso de datos

| Práctica | Por qué importa |
|---|---|
| ✅ Registrar equipos con fecha de llegada real | El motor no puede planificar sin este dato |
| ✅ Asignar Código Plazo correcto desde el inicio | Evita recalcular manualmente los tiempos |
| ✅ Revisar prioridades antes de cada planificación | Las prioridades desactualizadas generan secuencias incorrectas |
| ✅ Registrar todos los equipos antes de planificar | Permite que el motor tome decisiones con visibilidad completa |
| ✅ Ingresar días especiales antes de planificar | Si se registran después, no afectan la planificación activa |

### 11.2 Gestión de prioridades

| Práctica | Por qué importa |
|---|---|
| ✅ Usar números diferentes para cada equipo | Evita empates que reducen la efectividad del ordenamiento |
| ✅ Reservar P1–P3 para urgencias reales | Si todo es P1, nada es P1 |
| ✅ Revisar prioridades cuando llega una OT nueva | Un nuevo equipo urgente puede necesitar P1 o P2 |
| ✅ Replanificar después de cambiar prioridades | Los cambios no tienen efecto hasta que se ejecuta el motor |

### 11.3 Gestión de atrasos

| Práctica | Por qué importa |
|---|---|
| ✅ Registrar buffers solo cuando hay atraso real | Los buffers incorrectos distorsionan la planificación |
| ✅ Documentar el motivo en la nota del buffer | Facilita el seguimiento posterior |
| ✅ Replanificar inmediatamente después del buffer | El efecto solo se aplica al planificar |
| ✅ Remover el buffer cuando el atraso se resuelve | Evitar que el equipo quede permanentemente "atrasado" |

### 11.4 Planificación periódica

| Práctica | Frecuencia recomendada |
|---|---|
| Revisar y actualizar prioridades | Semanal |
| Ejecutar planificación | Semanal o al ocurrir cambios significativos |
| Descargar y distribuir Excel | Posterior a cada planificación |
| Revisar historial de entregas de equipos críticos | Ante cualquier cambio de prioridad o buffer |

---

---

## 12. Limitaciones y Consideraciones

### 12.1 Calidad de los datos

> **El sistema entrega resultados tan buenos como los datos que recibe.**

| Dato incorrecto | Impacto |
|---|---|
| Fecha de llegada incorrecta | El equipo se planifica en la fecha equivocada |
| Código Plazo incorrecto | Los tiempos de proceso son erróneos → fecha de entrega incorrecta |
| Prioridad no actualizada | La secuencia de producción no refleja las urgencias reales |
| Buffer sin base real | La planificación pierde precisión para ese equipo y los que compiten con él |

### 12.2 Días especiales

- Los días especiales deben registrarse **antes** de ejecutar el planificador.
- Si un sábado trabajable se decide el mismo día, la planificación activa no lo considera — hay que replanificar.

### 12.3 Capacidades fijas

- Las capacidades por proceso son parámetros del sistema configurados por el administrador.
- No se pueden modificar desde la interfaz de usuario estándar.
- Cambios en capacidades (contratar un operario más, cambiar turno) deben coordinarse con el administrador del sistema.

### 12.4 Equipos sin Código Plazo

- Los equipos registrados **sin Código Plazo** no son considerados por el motor.
- Siempre deben tener Código Plazo, Fecha de Llegada y Prioridad para aparecer en la planificación.

### 12.5 Planificación no es tiempo real

- La planificación es una **estimación** basada en los datos disponibles al momento de ejecutarla.
- Los imprevistos del día a día (fallas de maquinaria, ausencias, etc.) no se capturan automáticamente.
- Para reflejar esos imprevistos, se debe usar el buffer y replanificar.

### 12.6 Restauración de planificación anterior

- El sistema guarda la versión **inmediatamente anterior** a la activa.
- Solo se puede restaurar la planificación directamente anterior. Las versiones más antiguas son archivadas.

---

---

## 13. Preguntas Frecuentes

---

**1. ¿Qué pasa si cambio la prioridad de un equipo?**

El cambio no tiene efecto inmediato. Las prioridades se aplican en el momento en que se ejecuta el planificador. Después de cambiar una prioridad, presione **"Planificar"** para generar una nueva versión con la prioridad actualizada.

---

**2. ¿Qué pasa si agrego un atraso (buffer) de –5 días a un equipo?**

Al planificar, el motor identifica qué procesos de ese equipo ya deberían estar completados al día en que se registró el buffer. Esos procesos se respetan. El primer proceso pendiente no puede iniciar hasta 5 días hábiles después de la fecha del buffer. Los demás equipos no se ven afectados directamente, aunque pueden ocupar capacidad liberada.

---

**3. ¿Qué pasa si agrego un sábado como día trabajable?**

Si lo registras **antes de planificar**, el motor incluirá ese sábado como un día hábil normal en el calendario. Los equipos podrán avanzar procesos ese día si tienen capacidad disponible y están listos. El Excel también mostrará una columna para ese sábado.

Si lo registras **después de planificar**, no tendrá efecto hasta la próxima ejecución del planificador.

---

**4. ¿Qué pasa si vuelvo a planificar sin haber cambiado nada?**

El resultado debería ser muy similar o idéntico al anterior, ya que los datos de entrada no cambiaron. Sin embargo, pueden existir leves diferencias si la fecha del sistema avanzó y algunos equipos quedaron en el límite de su fecha de llegada.

---

**5. ¿Cómo recupero una planificación anterior?**

En la pantalla principal, si existe una planificación anterior disponible, aparecerá la opción de restaurarla. Al hacerlo, la planificación activa actual pasa a ser la "anterior" y la versión previa se convierte en la activa.

---

**6. ¿Qué significa "Planificación activa v30"?**

La versión (v30, v31, etc.) es un contador que aumenta cada vez que se ejecuta el planificador. La versión activa es la que se muestra en los resultados y en el Excel. Las versiones anteriores quedan en historial.

---

**7. Un equipo llegó hace un mes pero no aparece en la planificación. ¿Por qué?**

Las razones más comunes son:
- No tiene **Código Plazo** asignado.
- No tiene **Prioridad** asignada.
- No tiene **Fecha de Llegada** ingresada.
Los tres campos son obligatorios para que el motor considere el equipo.

---

**8. ¿Puede el sistema planificar dos equipos iguales al mismo tiempo?**

Sí, siempre que haya capacidad disponible en cada proceso. El motor asigna slots independientemente por equipo. Por ejemplo, si PINTURA tiene capacidad para 2 equipos simultáneos, pueden entrar dos lubricadores distintos el mismo día.

---

**9. ¿Qué ocurre si un equipo muy prioritario llega tarde?**

Si un equipo llega después que equipos de menor prioridad, éstos ya estarán en proceso. El equipo prioritario tardío deberá esperar los slots que queden disponibles. La prioridad solo actúa el día en que el equipo está listo para competir por un recurso.

---

**10. ¿El sistema considera feriados nacionales automáticamente?**

No. El calendario base del motor es lunes a viernes. Los feriados nacionales deben configurarse manualmente como **días no laborables** mediante la exclusión del calendario, o simplemente aceptar que el motor los tratará como días hábiles. Si un feriado se va a trabajar, se registra como día especial. Si no se va a trabajar, no se necesita hacer nada (el sistema ya lo descarta por ser un martes-viernes normal; si cae lunes a viernes, el motor lo trataría como hábil — esto es una limitación actual a coordinar con el administrador).

---

**11. ¿Cuántos equipos puede manejar el sistema?**

No hay un límite predefinido por número de equipos. La planificación puede manejar decenas de OTs simultáneas. El tiempo de cálculo aumenta levemente con más equipos, pero permanece dentro de rangos aceptables.

---

**12. ¿Qué pasa si elimino un equipo del historial?**

El equipo deja de existir en el sistema. En la próxima planificación, el motor no lo considerará. Los slots que ese equipo habría ocupado quedan disponibles para otros equipos. No se puede recuperar un equipo eliminado.

---

**13. ¿Puedo cambiar el Código Plazo de un equipo ya registrado?**

Sí, desde la opción de edición en el historial. Si cambias el código, el equipo tendrá tiempos de proceso distintos en la próxima planificación. Se recomienda replanificar inmediatamente después del cambio.

---

**14. ¿Cómo sé si el atraso de un equipo fue incorporado correctamente?**

Después de planificar, verifica en la columna **Entrega Estimada** del equipo. Si el valor cambió respecto a la planificación anterior y el badge del equipo aparece como **Atrasado**, el buffer fue procesado. Puedes también verificar el historial de entregas estimadas haciendo clic en el badge.

---

**15. ¿El Excel se actualiza automáticamente?**

No. El Excel se genera bajo demanda al presionar **"Descargar Excel"**. Siempre refleja el estado de la planificación activa en el momento de la descarga. Si planificas y luego descargas, obtienes el Excel actualizado.

---

**16. ¿Qué es el slot en el Detalle por Proceso?**

El slot indica en qué "puesto" del proceso está trabajando el equipo. Por ejemplo, si PINTURA tiene capacidad para 2 equipos simultáneos, el primer equipo queda en Slot 1 (PINT1) y el segundo en Slot 2 (PINT2). Esto permite identificar visualmente cuántos equipos ocupan simultáneamente cada proceso en el Gantt.

---

**17. ¿Las horas del día afectan la planificación?**

No. El motor trabaja en granularidad de **días hábiles completos**. No distingue entre mañana y tarde dentro de un mismo día. Un proceso con duración de 2 días hábiles ocupa exactamente 2 días calendarios de trabajo, sin importar la hora de inicio.

---

---

## 14. Conclusiones

El **Sistema de Planificación de Maestranza de ETP Spa** representa un avance significativo en la forma en que el taller organiza y gestiona su producción. Al centralizar el ingreso de equipos, automatizar el cálculo de secuencias y generar reportes visuales exportables, la plataforma elimina la dependencia de hojas de cálculo manuales y criterios informales.

### Resultados esperados con uso correcto

| Indicador | Impacto esperado |
|---|---|
| Cumplimiento de fechas de entrega | Mayor precisión en las estimaciones |
| Visibilidad del estado del taller | Acceso inmediato al estado de cada OT |
| Gestión de prioridades | Decisiones basadas en datos, no en intuición |
| Comunicación con clientes | Fechas formales y actualizadas disponibles en Excel |
| Respuesta ante imprevistos | Replanificación ágil mediante buffers y días especiales |

### Claves para el éxito

> **1. Mantener los datos actualizados.** Un sistema de planificación es tan bueno como los datos que consume. Fechas correctas, prioridades actuales y códigos de plazo precisos son la base de resultados confiables.

> **2. Planificar con regularidad.** No esperar semanas para replanificar. Ante cualquier cambio relevante — nuevo equipo, cambio de prioridad, atraso detectado — ejecutar el planificador para mantener el calendario vigente.

> **3. Usar el buffer con responsabilidad.** Es una herramienta poderosa que, usada correctamente, refleja fielmente los desvíos del taller. Usada incorrectamente, distorsiona la planificación de toda la planta.

> **4. Aprovechar el Excel como herramienta de comunicación.** El Gantt visual es una herramienta de alto valor para reuniones de producción, comunicación con clientes y auditorías internas.

---

*Documento generado para ETP Spa — Sistema de Planificación de Maestranza*
*Para soporte técnico o modificaciones al sistema, contactar al administrador.*

---
